import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from pymongo import MongoClient

from services.anomaly_feedback_engine import AnomalyFeedbackEngine
import jwt as pyjwt



SECRET_KEY = os.environ.get("JWT_SECRET", "telecom_pfe_secret_2026")
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 8

ROLES = {
    "noc": {"label": "Operateur NOC", "color": "#e74c3c"},
    "manager": {"label": "Manager", "color": "#2ecc71"},
    "engineer": {"label": "Ingenieur Systeme", "color": "#3498db"},
}

DEMO_USERS = {
    "noc_operator": {"password": "noc123", "role": "noc"},
    "manager_demo": {"password": "mgr123", "role": "manager"},
    "engineer_demo": {"password": "eng123", "role": "engineer"},
}

SEVERITY_ORDER = {
    "CRITICAL": 0,
    "HIGH": 1,
    "MEDIUM": 2,
    "LOW": 3,
}

FEEDBACK_LABELS = [
    "true_positive",
    "false_positive",
    "uncertain",
    "corrected_cause",
]

router = APIRouter(tags=["multi-role-dashboard"])
security = HTTPBearer()
mongo = MongoClient(
    os.getenv("MONGO_URI", "mongodb://localhost:27017/"),
    serverSelectionTimeoutMS=5000,
)
db = mongo[os.getenv("DATABASE_NAME", "telecom_logs")]
feedback_engine = AnomalyFeedbackEngine()


class LoginRequest(BaseModel):
    username: str
    password: str


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_value(value):
    if isinstance(value, dict):
        return {
            key: _serialize_value(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [_serialize_value(item) for item in value]

    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    return value


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def _encode_token(payload: dict) -> str:
    if pyjwt is not None:
        return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def _decode_token(token: str) -> dict:
    if pyjwt is not None:
        return pyjwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as error:
        raise HTTPException(
            status_code=401,
            detail="Token invalide",
        ) from error

    signing_input = f"{header_b64}.{payload_b64}"
    expected_signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    provided_signature = _b64url_decode(signature_b64)

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise HTTPException(
            status_code=401,
            detail="Token invalide",
        )

    payload = json.loads(_b64url_decode(payload_b64))
    exp = int(payload.get("exp", 0))

    if exp and exp < int(_now_utc().timestamp()):
        raise HTTPException(
            status_code=401,
            detail="Token expire",
        )

    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    try:
        payload = _decode_token(credentials.credentials)
        return {
            "username": payload["sub"],
            "role": payload["role"],
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=401,
            detail="Token invalide",
        ) from error


def require_role(*allowed_roles: str):
    def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Acces refuse. Roles autorises : "
                    + ", ".join(allowed_roles)
                ),
            )

        return user

    return checker


def _safe_count(collection_name: str, query: Optional[dict] = None) -> int:
    try:
        return db[collection_name].count_documents(query or {})
    except Exception:
        return 0


def _safe_find(
    collection_name: str,
    query: Optional[dict] = None,
    projection: Optional[dict] = None,
    sort: Optional[list] = None,
    limit: Optional[int] = None,
) -> list:
    try:
        cursor = db[collection_name].find(query or {}, projection)

        if sort:
            cursor = cursor.sort(sort)

        if limit is not None:
            cursor = cursor.limit(limit)

        return list(cursor)
    except Exception:
        return []


def _safe_find_one(
    collection_name: str,
    query: Optional[dict] = None,
    projection: Optional[dict] = None,
    sort: Optional[list] = None,
):
    try:
        return db[collection_name].find_one(
            query or {},
            projection,
            sort=sort,
        )
    except Exception:
        return None


def _collection_exists(collection_name: str) -> bool:
    try:
        return collection_name in db.list_collection_names()
    except Exception:
        return False


def _to_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value)
    except Exception:
        return None


def _extract_anomaly_score(document: dict) -> float:
    raw_score = (
        document.get("anomaly_score")
        or document.get("score")
        or document.get("model", {}).get("score")
        or 0.0
    )

    try:
        return float(raw_score)
    except Exception:
        return 0.0


def _get_feedback_summary() -> dict:
    stats = feedback_engine.get_feedback_stats()
    labeled = stats.get("true_positives", 0) + stats.get(
        "false_positives",
        0,
    )
    false_positive_rate = (
        round(stats.get("false_positives", 0) / labeled, 4)
        if labeled
        else None
    )

    return {
        "total": stats.get("total_feedbacks", 0),
        "true_positives": stats.get("true_positives", 0),
        "false_positives": stats.get("false_positives", 0),
        "precision_pct": stats.get("precision_pct", "N/A"),
        "false_positive_rate": (
            f"{false_positive_rate * 100:.1f}%"
            if false_positive_rate is not None
            else "N/A"
        ),
        "retrain_ready": stats.get("retrain_ready", False),
        "unused_for_training": stats.get("unused_for_training", 0),
    }


def _time_ago(value) -> str:
    if not value:
        return "N/A"

    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return "N/A"

    if not isinstance(value, datetime):
        return "N/A"

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    delta = _now_utc() - value.astimezone(timezone.utc)

    if delta.total_seconds() < 60:
        return "A l'instant"

    if delta.total_seconds() < 3600:
        return f"Il y a {int(delta.total_seconds() // 60)} min"

    if delta.days == 0:
        return f"Il y a {int(delta.total_seconds() // 3600)} h"

    return f"Il y a {delta.days} j"


def _get_role_endpoints(role: str) -> list[str]:
    return {
        "noc": [
            "GET /dashboard/noc/alerts",
            "GET /dashboard/noc/queue",
            "GET /dashboard/noc/realtime",
            "GET /dashboard/copilot/panel",
            "POST /dashboard/feedback/anomaly/{anomaly_id}",
            "GET /dashboard/similar-logs/{log_index}",
        ],
        "manager": [
            "GET /dashboard/manager/kpis",
            "GET /dashboard/manager/trends",
            "GET /dashboard/manager/sla-report",
            "GET /dashboard/copilot/panel",
            "POST /dashboard/explain",
        ],
        "engineer": [
            "GET /dashboard/engineer/ml-metrics",
            "GET /dashboard/engineer/details/{incident_id}",
            "GET /dashboard/engineer/logs/raw",
            "GET /dashboard/copilot/panel",
            "GET /dashboard/model-drift/latest",
            "GET /dashboard/model-drift/history",
            "GET /dashboard/faiss/stats",
            "GET /dashboard/what-if/best-action/{incident_id}",
            "POST /dashboard/explain",
            "POST /dashboard/copilot/ask",
            "POST /dashboard/what-if/compare",
            "POST /dashboard/feedback/retrain",
        ],
    }.get(role, [])


@router.post("/auth/login")
def login(request: LoginRequest):
    user = DEMO_USERS.get(request.username)

    if not user or user["password"] != request.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides",
        )

    now = _now_utc()
    payload = {
        "sub": request.username,
        "role": user["role"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_EXPIRY_HOURS)).timestamp()),
    }
    token = _encode_token(payload)

    return {
        "access_token": token,
        "token_type": "Bearer",
        "role": user["role"],
        "role_label": ROLES[user["role"]]["label"],
        "username": request.username,
        "expires_in": f"{TOKEN_EXPIRY_HOURS}h",
    }


@router.get("/dashboard/me")
def get_my_dashboard(user: dict = Depends(get_current_user)):
    role = user["role"]

    return {
        "role": role,
        "role_label": ROLES[role]["label"],
        "role_color": ROLES[role]["color"],
        "username": user["username"],
        "dashboard_url": (
            "/dashboard/noc/alerts"
            if role == "noc"
            else "/dashboard/manager/kpis"
            if role == "manager"
            else "/dashboard/engineer/ml-metrics"
        ),
        "available_endpoints": _get_role_endpoints(role),
    }


@router.get("/dashboard/noc/alerts")
def get_noc_alerts(
    limit: int = Query(default=20, ge=1, le=100),
    platform: str | None = Query(default=None),
    user: dict = Depends(require_role("noc", "engineer")),
):
    del user
    query = {
        "severity": {"$in": ["CRITICAL", "HIGH"]},
        "status": "new",
    }

    if platform:
        query["metadata.platform"] = platform.upper()

    alerts = _safe_find(
        "alerts",
        query=query,
        projection={
            "severity": 1,
            "type": 1,
            "message": 1,
            "metadata": 1,
            "created_at": 1,
            "status": 1,
        },
        sort=[("created_at", -1)],
        limit=limit * 2,
    )

    action_map = {
        "SMSC": [
            "Augmenter la capacite queue SMSC",
            "Verifier les sessions SMPP actives",
        ],
        "MMG": [
            "Verifier la connectivite MMG",
            "Activer le load balancing",
        ],
        "SMPPS": [
            "Redemarrer les sessions SMPP",
            "Verifier les timeouts",
        ],
        "SMPPC": [
            "Verifier les connexions sortantes",
            "Analyser les retries",
        ],
        "DMC": [
            "Scaler les workers DMC",
            "Verifier le backlog",
        ],
    }

    alerts.sort(
        key=lambda item: (
            SEVERITY_ORDER.get(str(item.get("severity")).upper(), 99),
            -(item.get("created_at") or datetime.min.replace(
                tzinfo=timezone.utc
            )).timestamp()
            if isinstance(item.get("created_at"), datetime)
            else 0,
        )
    )

    enriched_alerts = []

    for alert in alerts[:limit]:
        platform_name = (
            str(alert.get("metadata", {}).get("platform", ""))
            or str(alert.get("platform", ""))
        ).upper()
        
        # ═══════════════════════════════════════════════════════════════════
        # 🔧 CORRECTION: Ajouter predicted_resolution_minutes depuis incidents
        # ═══════════════════════════════════════════════════════════════════
        metadata = alert.get("metadata", {})
        
        # Chercher un incident associé pour obtenir predicted_resolution_minutes
        predicted_resolution_minutes = metadata.get("predicted_resolution_minutes")
        
        # Si pas dans metadata, chercher dans incidents collection
        if not predicted_resolution_minutes:
            # Essayer de trouver l'incident correspondant par fingerprint ou path
            fingerprint = metadata.get("dedup_fingerprint")
            if fingerprint:
                incident = _safe_find_one(
                    "incidents",
                    query={"incident_intelligence.dedup_fingerprint": fingerprint},
                    sort=[("created_at", -1)]
                )
                if incident:
                    predicted_resolution_minutes = incident.get("predicted_duration_minutes")
            
            # Fallback: chercher le dernier incident
            if not predicted_resolution_minutes:
                latest_incident = _safe_find_one(
                    "incidents",
                    sort=[("created_at", -1)]
                )
                if latest_incident:
                    predicted_resolution_minutes = latest_incident.get("predicted_duration_minutes")
        
        # Valeur par défaut pour test (15 minutes)
        if not predicted_resolution_minutes:
            predicted_resolution_minutes = 15
        
        # Mettre à jour metadata
        metadata["predicted_resolution_minutes"] = predicted_resolution_minutes
        metadata["operator_priority"] = metadata.get("operator_priority", "IMMEDIATE ACTION")
        
        enriched_alerts.append(
            {
                **alert,
                "platform": platform_name or None,
                "immediate_actions": action_map.get(
                    platform_name,
                    ["Investigation manuelle requise"],
                ),
                "time_ago": _time_ago(alert.get("created_at")),
                "metadata": metadata,  # Maintenant avec predicted_resolution_minutes
            }
        )

    return _serialize_value(
        {
            "role": "noc",
            "generated_at": _now_utc(),
            "active_alerts": len(enriched_alerts),
            "critical_count": sum(
                1
                for alert in enriched_alerts
                if alert.get("severity") == "CRITICAL"
            ),
            "high_count": sum(
                1
                for alert in enriched_alerts
                if alert.get("severity") == "HIGH"
            ),
            "alerts": enriched_alerts,
        }
    )

@router.get("/dashboard/noc/queue")
def get_noc_queue(
    limit: int = Query(default=30, ge=1, le=200),
    platform: str | None = Query(default=None),
    user: dict = Depends(require_role("noc", "engineer")),
):
    del user
    query = {"feedback_label": {"$exists": False}}

    if platform:
        query["platform"] = platform.upper()

    anomalies = _safe_find(
        "anomalies",
        query=query,
        projection={
            "platform": 1,
            "message": 1,
            "anomaly_score": 1,
            "model": 1,
            "timestamp": 1,
            "level": 1,
            "threshold_used": 1,
            "threshold_type": 1,
        },
        sort=[("created_at", -1)],
        limit=limit * 3,
    )

    queue = []

    for anomaly in anomalies:
        score = _extract_anomaly_score(anomaly)
        urgency = (
            "URGENT"
            if score >= 0.85
            else "HIGH"
            if score >= 0.70
            else "NORMAL"
        )
        queue.append(
            {
                **anomaly,
                "_id": str(anomaly.get("_id")),
                "anomaly_score": round(score, 4),
                "urgency": urgency,
                "feedback_labels": FEEDBACK_LABELS,
            }
        )

    queue.sort(
        key=lambda item: item.get("anomaly_score", 0.0),
        reverse=True,
    )

    queue = queue[:limit]

    return _serialize_value(
        {
            "role": "noc",
            "pending_count": len(queue),
            "urgent_count": sum(
                1 for item in queue if item["urgency"] == "URGENT"
            ),
            "queue": queue,
        }
    )


@router.get("/dashboard/noc/realtime")
def get_noc_realtime(
    user: dict = Depends(require_role("noc", "engineer")),
):
    del user
    platforms     = ["MMG", "SMSC", "SMPPS", "SMPPC", "DMC"]
    one_hour_ago  = _now_utc() - timedelta(hours=1)
    statuses      = []
 
    for platform in platforms:
        platform_upper = platform.upper()
        platform_lower = platform.lower()
 
        # ── Anomalies/1h ─────────────────────────────────────────────────────
        # Filtre sur created_at (date réelle d'insertion) pas timestamp (date du log)
        # Case-insensitive car les anomalies stockent "smsc" ou "MMG" indifféremment
        recent_anomalies = _safe_count(
            "anomalies",
            {
                "$or": [
                    {"platform": platform_upper},
                    {"platform": platform_lower},
                ],
                "created_at": {"$gte": one_hour_ago},
            },
        )
 
        # ── Alertes actives ──────────────────────────────────────────────────
        recent_alerts = _safe_count(
            "alerts",
            {
                "metadata.platform": platform_upper,
                "status": "new",
            },
        )
 
        # ── Status opérationnel ──────────────────────────────────────────────
        status_label = (
            "CRITICAL"  if recent_alerts >= 3
            else "DEGRADED" if recent_alerts > 0
            else "WARNING"  if recent_anomalies >= 50
            else "OK"
        )
 
        statuses.append({
            "platform":      platform,
            "status":        status_label,
            "anomalies_1h":  recent_anomalies,
            "active_alerts": recent_alerts,
            "last_checked":  _now_utc(),
        })
 
    overall_status = (
        "CRITICAL" if any(s["status"] == "CRITICAL"  for s in statuses) else
        "DEGRADED" if any(s["status"] == "DEGRADED"  for s in statuses) else
        "WARNING"  if any(s["status"] == "WARNING"   for s in statuses) else
        "OK"
    )
 
    return _serialize_value({
        "role":           "noc",
        "overall_status": overall_status,
        "platforms":      statuses,
        "generated_at":   _now_utc(),
    })


@router.get("/dashboard/manager/kpis")
def get_manager_kpis(
    user: dict = Depends(require_role("manager", "engineer")),
):
    del user
    month_start = _now_utc().replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    incidents = _safe_find(
        "incidents",
        query={"created_at": {"$gte": month_start}},
        projection={
            "created_at": 1,
            "severity": 1,
            "predicted_duration_minutes": 1,
        },
        sort=[("created_at", -1)],
        limit=500,
    )
    mttrs = [
        int(item.get("predicted_duration_minutes"))
        for item in incidents
        if item.get("predicted_duration_minutes") is not None
    ]
    mttr_avg = round(sum(mttrs) / len(mttrs)) if mttrs else 90
    sla_target_minutes = 60
    within_sla = sum(1 for duration in mttrs if duration <= sla_target_minutes)
    sla_compliance = (
        round(within_sla / len(mttrs) * 100, 1)
        if mttrs
        else 0.0
    )
    feedback = _get_feedback_summary()
    total_anomalies = _safe_count("anomalies")
    auto_detected = _safe_count("anomalies", {"source": {"$ne": "manual"}})
    detection_rate = (
        round(auto_detected / total_anomalies, 4)
        if total_anomalies
        else 0.0
    )
    baseline_mttr = 120
    cost_per_minute = 50
    estimated_savings = max(
        0,
        (baseline_mttr - mttr_avg) * cost_per_minute * max(len(incidents), 1),
    )

    return _serialize_value(
        {
            "role": "manager",
            "period": month_start.strftime("%B %Y"),
            "generated_at": _now_utc(),
            "incidents": {
                "total": len(incidents),
                "critical": sum(
                    1
                    for item in incidents
                    if item.get("severity", {}).get("label") == "CRITICAL"
                ),
                "high": sum(
                    1
                    for item in incidents
                    if item.get("severity", {}).get("label") == "HIGH"
                ),
            },
            "performance": {
                "mttr_avg_minutes": mttr_avg,
                "mttr_target_minutes": sla_target_minutes,
                "sla_compliance_pct": sla_compliance,
                "sla_status": (
                    "Conforme" if sla_compliance >= 90 else "A ameliorer"
                ),
            },
            "financial": {
                "baseline_mttr_minutes": baseline_mttr,
                "estimated_savings_eur": estimated_savings,
            },
            "ai_quality": {
                "model_precision_pct": feedback["precision_pct"],
                "false_positive_rate": feedback["false_positive_rate"],
                "feedbacks_collected": feedback["total"],
                "anomaly_detection_rate": f"{detection_rate * 100:.1f}%",
            },
            "platforms_health": {
                "healthy": max(
                    0,
                    5 - _safe_count("alerts", {"severity": {"$in": ["HIGH", "CRITICAL"]}}),
                ),
                "degraded": _safe_count("alerts", {"severity": "HIGH"}),
                "critical": _safe_count("alerts", {"severity": "CRITICAL"}),
            },
        }
    )


@router.get("/dashboard/manager/trends")
def get_manager_trends(
    days: int = Query(default=30, ge=1, le=180),
    user: dict = Depends(require_role("manager", "engineer")),
):
    del user
    since = _now_utc() - timedelta(days=days)
 
    # ── Incidents par jour ───────────────────────────────────────────────────
    try:
        daily_incidents = list(db.incidents.aggregate([
            {"$match": {"created_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count":    {"$sum": 1},
                    "critical": {
                        "$sum": {
                            "$cond": [{"$eq": ["$severity.label", "CRITICAL"]}, 1, 0]
                        }
                    },
                }
            },
            {"$sort": {"_id": 1}},
        ]))
    except Exception:
        daily_incidents = []
 
    # ── Anomalies par plateforme ─────────────────────────────────────────────
    # Utiliser created_at (insertion réelle 2026) pas timestamp (date du log 2023)
    try:
        anomalies_by_platform = list(db.anomalies.aggregate([
            {"$match": {"created_at": {"$gte": since}}},
            {
                "$group": {
                    "_id": {
                        "$toUpper": "$platform"   # normaliser en uppercase
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$match": {"_id": {"$in": ["MMG", "SMSC", "SMPPS", "SMPPC", "DMC"]}}},
            {"$sort": {"count": -1}},
        ]))
    except Exception:
        anomalies_by_platform = []
 
    # Fallback : si aucune anomalie dans la fenêtre, prendre all-time
    if not anomalies_by_platform:
        try:
            anomalies_by_platform = list(db.anomalies.aggregate([
                {
                    "$group": {
                        "_id":   {"$toUpper": "$platform"},
                        "count": {"$sum": 1},
                    }
                },
                {"$match": {"_id": {"$in": ["MMG", "SMSC", "SMPPS", "SMPPC", "DMC"]}}},
                {"$sort": {"count": -1}},
            ]))
        except Exception:
            anomalies_by_platform = []
 
    return _serialize_value({
        "role":        "manager",
        "period_days": days,
        "daily_incidents": [
            {"date": item["_id"], "total": item["count"], "critical": item["critical"]}
            for item in daily_incidents
        ],
        "anomalies_by_platform": [
            {"platform": item["_id"], "count": item["count"]}
            for item in anomalies_by_platform
        ],
        "generated_at": _now_utc(),
    })


@router.get("/dashboard/manager/sla-report")
def get_manager_sla_report(
    user: dict = Depends(require_role("manager", "engineer")),
):
    del user
    incidents = _safe_find(
        "incidents",
        projection={
            "severity": 1,
            "created_at": 1,
            "predicted_duration_minutes": 1,
            "platforms": 1,
        },
        sort=[("created_at", -1)],
        limit=100,
    )
    sla_targets = {
        "CRITICAL": 30,
        "HIGH": 60,
        "MEDIUM": 120,
        "LOW": 240,
    }
    details = []

    for incident in incidents:
        severity = incident.get("severity", {}).get("label", "HIGH")
        actual_mttr = int(
            incident.get("predicted_duration_minutes") or 90
        )
        target = sla_targets.get(severity, 60)
        details.append(
            {
                "incident_id": str(incident.get("_id")),
                "severity": severity,
                "sla_target": target,
                "actual_mttr": actual_mttr,
                "sla_met": actual_mttr <= target,
                "platforms": incident.get("platforms", []),
            }
        )

    total = len(details)
    sla_met = sum(1 for item in details if item["sla_met"])
    compliance = round(sla_met / total * 100, 1) if total else 0.0

    return _serialize_value(
        {
            "role": "manager",
            "sla_compliance": compliance,
            "total_incidents": total,
            "sla_met": sla_met,
            "sla_missed": total - sla_met,
            "by_severity": {
                severity: {
                    "count": sum(
                        1
                        for item in details
                        if item["severity"] == severity
                    ),
                    "met": sum(
                        1
                        for item in details
                        if item["severity"] == severity
                        and item["sla_met"]
                    ),
                }
                for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
            },
            "details": details[:20],
            "generated_at": _now_utc(),
        }
    )


@router.get("/dashboard/engineer/ml-metrics")
def get_engineer_ml_metrics(
    user: dict = Depends(require_role("engineer")),
):
    del user
    realtime_logs = _safe_count("logs")
    historical_logs = _safe_count("log_features")
    total_logs = historical_logs or realtime_logs
    total_anomalies = _safe_count("anomalies")
    anomaly_rate = (
        round(total_anomalies / total_logs * 100, 3)
        if total_logs
        else 0.0
    )
    drift = _safe_find_one(
        "model_drift_reports",
        sort=[("timestamp", -1)],
    ) or {}
    feedback = _get_feedback_summary()

    return _serialize_value(
        {
            "role": "engineer",
            "dataset": {
                "total_logs": total_logs,
                "historical_logs": historical_logs,
                "realtime_logs": realtime_logs,
                "total_anomalies": total_anomalies,
                "anomaly_rate_pct": anomaly_rate,
                "anomaly_rate_scope": (
                    "historical_batch"
                    if historical_logs
                    else "realtime_buffer"
                    if realtime_logs
                    else "unavailable"
                ),
                "clusters": _safe_count("clusters")
                if _collection_exists("clusters")
                else 0,
                "embedding_dim": 384,
            },
            "models": {
                "isolation_forest": {
                    "path": "ml/models/isolation_forest.pkl",
                    "available": os.path.exists(
                        "ml/models/isolation_forest.pkl"
                    ),
                },
                "lof": {
                    "path": "ml/models/lof.pkl",
                    "available": os.path.exists("ml/models/lof.pkl"),
                },
                "tfidf": {
                    "path": "ml/models/tfidf.pkl",
                    "available": os.path.exists("ml/models/tfidf.pkl"),
                },
            },
            "drift": {
                "severity": drift.get("drift_severity", "UNKNOWN"),
                "score": drift.get("drift_score", 0),
                "drifted_tests": drift.get("drifted_tests", []),
                "retrain_needed": drift.get("retrain_required", False),
            },
            "feedback": feedback,
            "generated_at": _now_utc(),
        }
    )


@router.get("/dashboard/engineer/details/{incident_id}")
def get_engineer_incident_details(
    incident_id: str,
    user: dict = Depends(require_role("engineer")),
):
    del user
    object_id = _to_object_id(incident_id)
    incident = None

    if object_id is not None:
        incident = _safe_find_one("incidents", {"_id": object_id})

    if incident is None:
        incident = _safe_find_one("incidents", {"_id": incident_id})

    if incident is None:
        raise HTTPException(status_code=404, detail="Incident non trouve")

    anomaly_query = {"incident_id": {"$in": [incident_id]}}

    if object_id is not None:
        anomaly_query["incident_id"]["$in"].append(object_id)

    anomalies = _safe_find(
        "anomalies",
        query=anomaly_query,
        projection={
            "platform": 1,
            "message": 1,
            "anomaly_score": 1,
            "model": 1,
            "timestamp": 1,
            "status": 1,
            "feedback_label": 1,
        },
        sort=[("created_at", -1)],
        limit=200,
    )

    if not anomalies and incident.get("anomaly_ids"):
        anomalies = _safe_find(
            "anomalies",
            query={"log_index": {"$in": incident.get("anomaly_ids", [])}},
            projection={
                "platform": 1,
                "message": 1,
                "anomaly_score": 1,
                "model": 1,
                "timestamp": 1,
                "status": 1,
                "feedback_label": 1,
            },
            sort=[("created_at", -1)],
            limit=200,
        )

    for anomaly in anomalies:
        anomaly["anomaly_score"] = round(
            _extract_anomaly_score(anomaly),
            4,
        )

    anomalies.sort(
        key=lambda item: item.get("anomaly_score", 0.0),
        reverse=True,
    )

    drift = _safe_find_one(
        "model_drift_reports",
        sort=[("timestamp", -1)],
    ) or {}
    feedback = _get_feedback_summary()

    return _serialize_value(
        {
            "role": "engineer",
            "incident": incident,
            "top_anomalies": anomalies[:50],
            "ml_metrics": {
                "model_precision": feedback["precision_pct"],
                "false_positive_rate": feedback["false_positive_rate"],
                "total_feedbacks": feedback["total"],
                "retrain_ready": feedback["retrain_ready"],
            },
            "drift_status": {
                "severity": drift.get("drift_severity", "UNKNOWN"),
                "retrain_needed": drift.get("retrain_required", False),
                "last_check": drift.get("timestamp"),
            },
            "generated_at": _now_utc(),
        }
    )


@router.get("/dashboard/engineer/logs/raw")
def get_engineer_raw_logs(
    platform: str | None = Query(default=None),
    level: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(require_role("engineer")),
):
    del user
    collection_name = "logs" if _collection_exists("logs") else "log_features"
    query = {}

    if platform:
        query["platform"] = platform.upper()

    if level:
        query["level"] = level.upper()

    logs = _safe_find(
        collection_name,
        query=query,
        projection={
            "platform": 1,
            "level": 1,
            "message": 1,
            "timestamp": 1,
        },
        sort=[("timestamp", -1)],
        limit=limit,
    )

    return _serialize_value(
        {
            "role": "engineer",
            "collection": collection_name,
            "filters": {
                "platform": platform,
                "level": level,
            },
            "count": len(logs),
            "logs": logs,
            "generated_at": _now_utc(),
        }
    )
