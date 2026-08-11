import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from pymongo import MongoClient
import yaml

from ai.engine.telecom_digital_twin_engine import (
    TelecomDigitalTwinEngine,
)


AVAILABLE_ACTIONS = {
    "increase_smsc_queue": {
        "label": "Increase SMSC queue capacity",
        "description": "Increase SMSC queue capacity to absorb traffic spikes",
        "parameters": {
            "capacity_boost_pct": {
                "type": "float",
                "default": 50,
                "min": 10,
                "max": 200,
            }
        },
        "targets": ["SMSC"],
    },
    "restart_smpp_sessions": {
        "label": "Restart SMPP sessions",
        "description": "Restart SMPPS and SMPPC sessions to recover connectivity",
        "parameters": {
            "grace_period_sec": {
                "type": "int",
                "default": 30,
                "min": 5,
                "max": 120,
            }
        },
        "targets": ["SMPPS", "SMPPC"],
    },
    "reduce_retry_interval": {
        "label": "Reduce retry interval",
        "description": "Reduce retry interval to speed up service recovery",
        "parameters": {
            "retry_reduction_pct": {
                "type": "float",
                "default": 40,
                "min": 10,
                "max": 70,
            }
        },
        "targets": ["SMSC", "SMPPS"],
    },
    "enable_load_balancing": {
        "label": "Enable MMG load balancing",
        "description": "Distribute traffic across MMG nodes to avoid saturation",
        "parameters": {
            "nodes_count": {
                "type": "int",
                "default": 3,
                "min": 2,
                "max": 8,
            }
        },
        "targets": ["MMG"],
    },
    "increase_timeout": {
        "label": "Increase SMPP timeout",
        "description": "Increase SMPP timeout to reduce disconnect storms",
        "parameters": {
            "timeout_boost_pct": {
                "type": "float",
                "default": 30,
                "min": 10,
                "max": 100,
            }
        },
        "targets": ["SMPPS", "SMPPC"],
    },
    "scale_dmc_workers": {
        "label": "Scale DMC workers",
        "description": "Add DMC workers to process the backlog faster",
        "parameters": {
            "workers_boost_pct": {
                "type": "float",
                "default": 100,
                "min": 50,
                "max": 300,
            }
        },
        "targets": ["DMC"],
    },
    "isolate_platform": {
        "label": "Isolate failing platform",
        "description": "Isolate a failing platform to protect the rest of the chain",
        "parameters": {
            "platform": {
                "type": "str",
                "default": "MMG",
            }
        },
        "targets": ["MMG", "SMSC", "SMPPS", "SMPPC", "DMC"],
    },
    "combined_recovery": {
        "label": "Combined recovery plan",
        "description": "Apply queue, retry, and timeout improvements together",
        "parameters": {
            "queue_boost_pct": {"type": "float", "default": 50},
            "retry_reduction_pct": {"type": "float", "default": 40},
            "timeout_boost_pct": {"type": "float", "default": 30},
        },
        "targets": ["SMSC", "SMPPS"],
    },
}


class WhatIfEngine:

    def __init__(
        self,
        mongo_uri: Optional[str] = None,
        db_name: Optional[str] = None,
        topology_path: Optional[str] = None,
    ):
        self.mongo = MongoClient(
            mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017/"),
            serverSelectionTimeoutMS=5000,
        )
        self.db = self.mongo[
            db_name or os.getenv("DATABASE_NAME", "telecom_logs")
        ]
        self.col_sims = self.db["whatif_simulations"]
        self.topology_path = Path(topology_path or "config/topology.yaml")
        self.topology = self._load_topology()
        self.digital_twin = TelecomDigitalTwinEngine()
        self._build_digital_twin()
        self._ensure_indexes()

    def list_available_actions(self) -> list:
        return [
            {
                "id": action_id,
                "label": action["label"],
                "description": action["description"],
                "targets": action["targets"],
                "parameters": action["parameters"],
            }
            for action_id, action in AVAILABLE_ACTIONS.items()
        ]

    def get_overview(self) -> dict:
        latest_simulations = list(
            self.col_sims.find().sort("created_at", -1).limit(5)
        )
        return self._serialize_value(
            {
                "available_actions": self.list_available_actions(),
                "latest_simulations": latest_simulations,
                "simulation_count": self.col_sims.count_documents({}),
            }
        )

    def get_incident_by_id(self, incident_id: str) -> Optional[dict]:
        object_id = self._to_object_id(incident_id)
        if object_id is not None:
            document = self.db.incidents.find_one({"_id": object_id})
            if document is not None:
                return self._prepare_incident_document(document)

        document = self.db.incidents.find_one({"_id": incident_id})
        if document is not None:
            return self._prepare_incident_document(document)

        return None

    def get_simulation_history(
        self,
        incident_id: str,
        limit: int = 10,
    ) -> dict:
        simulations = list(
            self.col_sims.find({"incident_id": str(incident_id)})
            .sort("created_at", -1)
            .limit(limit)
        )
        return self._serialize_value(
            {
                "incident_id": str(incident_id),
                "simulations": simulations,
                "count": len(simulations),
            }
        )

    def simulate(
        self,
        action_id: str,
        incident_data: dict,
        parameters: Optional[dict] = None,
    ) -> dict:
        return self._simulate_action(
            action_id=action_id,
            incident_data=incident_data,
            parameters=parameters,
            persist=True,
        )

    def compare_actions(
        self,
        incident_data: dict,
        action_ids: Optional[list] = None,
    ) -> dict:
        affected = self._normalize_platform_list(
            incident_data.get("platforms")
            or incident_data.get("affected_platforms")
            or incident_data.get("incident_intelligence", {}).get(
                "affected_platforms",
                [],
            )
        )
        root_causes = self._extract_root_cause_keywords(incident_data)

        if action_ids:
            candidates = [
                action_id
                for action_id in action_ids
                if action_id in AVAILABLE_ACTIONS
            ]
        else:
            candidates = self._select_relevant_actions(
                affected,
                root_causes,
            )

        simulations = []

        for action_id in candidates:
            simulation = self._simulate_action(
                action_id=action_id,
                incident_data=incident_data,
                parameters=None,
                persist=False,
            )

            if "error" in simulation:
                continue

            simulations.append(
                {
                    "action_id": simulation["action_id"],
                    "action_label": simulation["action_label"],
                    "mttr_before": simulation["before"]["mttr_minutes"],
                    "mttr_after": simulation["after"]["mttr_minutes"],
                    "mttr_reduction_pct": simulation["after"][
                        "mttr_reduction_pct"
                    ],
                    "confidence": simulation["confidence"],
                    "confidence_label": simulation[
                        "confidence_label"
                    ],
                    "risk_level": simulation["risk_level"],
                    "recommendation": simulation["recommendation"],
                }
            )

        simulations.sort(key=lambda item: item["mttr_after"])

        return self._serialize_value(
            {
                "incident_mttr_baseline": self._estimate_current_mttr(
                    incident_data
                ),
                "actions_compared": len(simulations),
                "best_action": simulations[0] if simulations else None,
                "comparison_table": simulations,
                "timestamp": self._now_iso(),
            }
        )

    def get_best_action(
        self,
        incident_data: dict,
        action_ids: Optional[list] = None,
    ) -> dict:
        comparison = self.compare_actions(
            incident_data=incident_data,
            action_ids=action_ids,
        )

        return self._serialize_value(
            {
                "incident_id": str(
                    incident_data.get("_id")
                    or incident_data.get("incident_id")
                    or ""
                ),
                "incident_mttr_baseline": comparison.get(
                    "incident_mttr_baseline"
                ),
                "actions_compared": comparison.get("actions_compared", 0),
                "best_action": comparison.get("best_action"),
                "top_actions": comparison.get("comparison_table", [])[:3],
                "timestamp": comparison.get("timestamp", self._now_iso()),
            }
        )

    def _simulate_action(
        self,
        action_id: str,
        incident_data: dict,
        parameters: Optional[dict],
        persist: bool,
        include_alternatives: bool = True,
    ) -> dict:
        if action_id not in AVAILABLE_ACTIONS:
            return {
                "error": f"Unknown action: {action_id}",
                "available_actions": list(AVAILABLE_ACTIONS.keys()),
            }

        action = AVAILABLE_ACTIONS[action_id]
        params = {
            key: config.get("default")
            for key, config in action["parameters"].items()
        }
        params.update(parameters or {})

        current_mttr = self._estimate_current_mttr(incident_data)
        severity = self._extract_incident_severity(incident_data)
        affected_platforms = self._normalize_platform_list(
            incident_data.get("platforms")
            or incident_data.get("affected_platforms")
            or incident_data.get("incident_intelligence", {}).get(
                "affected_platforms",
                [],
            )
        )
        root_causes = self._extract_root_cause_keywords(incident_data)
        anomaly_count = int(
            incident_data.get("total_anomalies")
            or incident_data.get("incident_intelligence", {}).get(
                "total_anomalies",
                0,
            )
            or 0
        )
        impact = self._compute_action_impact(
            action_id=action_id,
            params=params,
            incident=incident_data,
        )
        mttr_after = max(
            5,
            round(
                current_mttr * (1 - impact["mttr_reduction_rate"])
            ),
        )
        confidence = self._compute_confidence(
            action_id=action_id,
            root_causes=root_causes,
            affected=affected_platforms,
        )
        risks = self._assess_risks(action_id=action_id)
        protected_platforms = self._estimate_protected_platforms(
            incident_data=incident_data,
            action_id=action_id,
            impact=impact,
        )

        result = {
            "simulation_id": (
                "sim_"
                + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            ),
            "action_id": action_id,
            "action_label": action["label"],
            "parameters_used": params,
            "timestamp": self._now_iso(),
            "before": {
                "mttr_minutes": current_mttr,
                "severity": severity,
                "anomaly_count": anomaly_count,
                "affected_platforms": affected_platforms,
                "sms_degradation": self._extract_sms_degradation(
                    incident_data
                ),
            },
            "after": {
                "mttr_minutes": mttr_after,
                "mttr_reduction": current_mttr - mttr_after,
                "mttr_reduction_pct": round(
                    (current_mttr - mttr_after)
                    / max(current_mttr, 1)
                    * 100,
                    1,
                ),
                "expected_severity": impact["expected_severity"],
                "anomaly_reduction_pct": impact[
                    "anomaly_reduction_pct"
                ],
                "sms_recovery_pct": impact["sms_recovery_pct"],
                "platforms_recovered": impact["platforms_recovered"],
                "platforms_protected": protected_platforms,
            },
            "confidence": confidence["score"],
            "confidence_label": confidence["label"],
            "confidence_reason": confidence["reason"],
            "risks": risks,
            "risk_level": risks[0]["level"] if risks else "LOW",
            "recommendation": self._build_recommendation(
                mttr_before=current_mttr,
                mttr_after=mttr_after,
                confidence=confidence,
                risks=risks,
            ),
            "top_alternatives": (
                self._get_top_alternatives(
                    incident_data=incident_data,
                    exclude=action_id,
                )
                if include_alternatives
                else []
            ),
        }

        if persist:
            self.col_sims.insert_one(
                {
                    **result,
                    "incident_id": str(
                        incident_data.get("_id")
                        or incident_data.get("incident_id")
                        or ""
                    ),
                    "created_at": datetime.now(timezone.utc),
                }
            )

        return self._serialize_value(result)

    def _compute_action_impact(
        self,
        action_id: str,
        params: dict,
        incident: dict,
    ) -> dict:
        severity = self._extract_incident_severity(incident)
        root_causes = self._extract_root_cause_keywords(incident)
        impact_profiles = {
            "increase_smsc_queue": {
                "mttr_reduction_rate": self._scale(
                    params.get("capacity_boost_pct", 50),
                    10,
                    200,
                    0.20,
                    0.65,
                ),
                "anomaly_reduction_pct": self._scale(
                    params.get("capacity_boost_pct", 50),
                    10,
                    200,
                    10,
                    55,
                ),
                "sms_recovery_pct": self._scale(
                    params.get("capacity_boost_pct", 50),
                    10,
                    200,
                    15,
                    70,
                ),
                "platforms_recovered": ["SMSC"],
                "expected_severity": (
                    "HIGH" if severity == "CRITICAL" else "MEDIUM"
                ),
            },
            "restart_smpp_sessions": {
                "mttr_reduction_rate": 0.45,
                "anomaly_reduction_pct": 35,
                "sms_recovery_pct": 50,
                "platforms_recovered": ["SMPPS", "SMPPC"],
                "expected_severity": "MEDIUM",
            },
            "reduce_retry_interval": {
                "mttr_reduction_rate": self._scale(
                    params.get("retry_reduction_pct", 40),
                    10,
                    70,
                    0.15,
                    0.40,
                ),
                "anomaly_reduction_pct": self._scale(
                    params.get("retry_reduction_pct", 40),
                    10,
                    70,
                    10,
                    30,
                ),
                "sms_recovery_pct": self._scale(
                    params.get("retry_reduction_pct", 40),
                    10,
                    70,
                    10,
                    35,
                ),
                "platforms_recovered": ["SMSC", "SMPPS"],
                "expected_severity": severity,
            },
            "enable_load_balancing": {
                "mttr_reduction_rate": self._scale(
                    params.get("nodes_count", 3),
                    2,
                    8,
                    0.20,
                    0.55,
                ),
                "anomaly_reduction_pct": self._scale(
                    params.get("nodes_count", 3),
                    2,
                    8,
                    15,
                    50,
                ),
                "sms_recovery_pct": self._scale(
                    params.get("nodes_count", 3),
                    2,
                    8,
                    20,
                    60,
                ),
                "platforms_recovered": ["MMG"],
                "expected_severity": (
                    "HIGH" if severity == "CRITICAL" else "MEDIUM"
                ),
            },
            "increase_timeout": {
                "mttr_reduction_rate": self._scale(
                    params.get("timeout_boost_pct", 30),
                    10,
                    100,
                    0.10,
                    0.30,
                ),
                "anomaly_reduction_pct": self._scale(
                    params.get("timeout_boost_pct", 30),
                    10,
                    100,
                    5,
                    25,
                ),
                "sms_recovery_pct": self._scale(
                    params.get("timeout_boost_pct", 30),
                    10,
                    100,
                    5,
                    20,
                ),
                "platforms_recovered": ["SMPPS", "SMPPC"],
                "expected_severity": severity,
            },
            "scale_dmc_workers": {
                "mttr_reduction_rate": self._scale(
                    params.get("workers_boost_pct", 100),
                    50,
                    300,
                    0.20,
                    0.50,
                ),
                "anomaly_reduction_pct": self._scale(
                    params.get("workers_boost_pct", 100),
                    50,
                    300,
                    15,
                    45,
                ),
                "sms_recovery_pct": self._scale(
                    params.get("workers_boost_pct", 100),
                    50,
                    300,
                    20,
                    50,
                ),
                "platforms_recovered": ["DMC"],
                "expected_severity": "MEDIUM",
            },
            "isolate_platform": {
                "mttr_reduction_rate": 0.30,
                "anomaly_reduction_pct": 40,
                "sms_recovery_pct": 30,
                "platforms_recovered": [],
                "expected_severity": "MEDIUM",
            },
            "combined_recovery": {
                "mttr_reduction_rate": 0.65,
                "anomaly_reduction_pct": 55,
                "sms_recovery_pct": 70,
                "platforms_recovered": ["SMSC", "SMPPS", "DMC"],
                "expected_severity": "MEDIUM",
            },
        }
        profile = dict(impact_profiles[action_id])

        if "queue full" in root_causes and action_id == "increase_smsc_queue":
            profile["mttr_reduction_rate"] = min(
                0.80,
                profile["mttr_reduction_rate"] * 1.25,
            )
        if "timeout" in root_causes and action_id == "increase_timeout":
            profile["mttr_reduction_rate"] = min(
                0.80,
                profile["mttr_reduction_rate"] * 1.20,
            )
        if "retry" in root_causes and action_id == "reduce_retry_interval":
            profile["mttr_reduction_rate"] = min(
                0.80,
                profile["mttr_reduction_rate"] * 1.20,
            )

        return profile

    def _estimate_current_mttr(self, incident: dict) -> int:
        if incident.get("predicted_resolution_minutes"):
            return int(incident["predicted_resolution_minutes"])

        duration_data = incident.get("duration_prediction", {})

        if duration_data.get("estimated_resolution_minutes"):
            return int(duration_data["estimated_resolution_minutes"])

        severity_label = self._extract_incident_severity(incident)
        severity_mttr = {
            "CRITICAL": 90,
            "HIGH": 60,
            "MEDIUM": 30,
            "LOW": 15,
        }
        baseline = severity_mttr.get(severity_label, 60)
        affected_platforms = self._normalize_platform_list(
            incident.get("platforms")
            or incident.get("affected_platforms")
            or incident.get("incident_intelligence", {}).get(
                "affected_platforms",
                [],
            )
        )
        factor = 1 + max(0, len(affected_platforms) - 1) * 0.15

        return round(baseline * factor)

    def _compute_confidence(
        self,
        action_id: str,
        root_causes: list,
        affected: list,
    ) -> dict:
        score = 0.60
        cause_action_map = {
            "queue full": ["increase_smsc_queue", "combined_recovery"],
            "timeout": ["increase_timeout", "restart_smpp_sessions"],
            "retry": ["reduce_retry_interval", "combined_recovery"],
            "fail": ["restart_smpp_sessions", "combined_recovery", "isolate_platform"],
            "disconnect": ["restart_smpp_sessions", "increase_timeout"],
            "refused": ["enable_load_balancing", "increase_smsc_queue"],
        }

        for cause in root_causes[:5]:
            if action_id in cause_action_map.get(cause, []):
                score += 0.15
                break

        targets = [
            target.upper()
            for target in AVAILABLE_ACTIONS[action_id]["targets"]
        ]

        if any(platform in targets for platform in affected):
            score += 0.10

        score = min(0.95, score)

        if score >= 0.85:
            label = "HIGH"
            reason = "Action is directly aligned with detected root causes"
        elif score >= 0.70:
            label = "MEDIUM"
            reason = "Action is relevant but other variables may influence the outcome"
        else:
            label = "LOW"
            reason = "Action is only partially aligned with the incident context"

        return {
            "score": round(score, 2),
            "label": label,
            "reason": reason,
        }

    def _assess_risks(self, action_id: str) -> list:
        risk_profiles = {
            "restart_smpp_sessions": [
                {
                    "level": "MEDIUM",
                    "description": "Short SMPP interruption during reconnection",
                    "mitigation": "Apply during a controlled maintenance window",
                }
            ],
            "isolate_platform": [
                {
                    "level": "HIGH",
                    "description": "Temporary service loss on the isolated platform",
                    "mitigation": "Enable backup routing before isolation",
                }
            ],
            "increase_smsc_queue": [
                {
                    "level": "LOW",
                    "description": "Higher memory usage on SMSC nodes",
                    "mitigation": "Check SMSC memory headroom before rollout",
                }
            ],
            "scale_dmc_workers": [
                {
                    "level": "LOW",
                    "description": "Higher CPU usage while workers scale",
                    "mitigation": "Monitor CPU and queue backlog during scaling",
                }
            ],
            "combined_recovery": [
                {
                    "level": "MEDIUM",
                    "description": "Multiple simultaneous changes can create instability",
                    "mitigation": "Apply the plan in sequence instead of all at once",
                }
            ],
        }

        return risk_profiles.get(
            action_id,
            [
                {
                    "level": "LOW",
                    "description": "Minimal operational risk",
                    "mitigation": "Monitor service metrics after rollout",
                }
            ],
        )

    def _get_top_alternatives(
        self,
        incident_data: dict,
        exclude: str,
        limit: int = 2,
    ) -> list:
        affected = self._normalize_platform_list(
            incident_data.get("platforms")
            or incident_data.get("affected_platforms")
            or incident_data.get("incident_intelligence", {}).get(
                "affected_platforms",
                [],
            )
        )
        root_causes = self._extract_root_cause_keywords(incident_data)
        candidates = [
            action_id
            for action_id in self._select_relevant_actions(affected, root_causes)
            if action_id != exclude
        ][:limit]
        alternatives = []

        for action_id in candidates:
            simulation = self._simulate_action(
                action_id=action_id,
                incident_data=incident_data,
                parameters=None,
                persist=False,
                include_alternatives=False,
            )

            if "error" in simulation:
                continue

            alternatives.append(
                {
                    "action_id": action_id,
                    "action_label": simulation["action_label"],
                    "mttr_after": simulation["after"]["mttr_minutes"],
                    "mttr_reduction_pct": simulation["after"]["mttr_reduction_pct"],
                }
            )

        return alternatives

    def _select_relevant_actions(self, affected: list, root_causes: list) -> list:
        scores = {}
        cause_map = {
            "queue full": ["increase_smsc_queue"],
            "timeout": ["increase_timeout", "restart_smpp_sessions"],
            "retry": ["reduce_retry_interval"],
            "fail": ["restart_smpp_sessions", "combined_recovery"],
            "disconnect": ["restart_smpp_sessions"],
            "refused": ["enable_load_balancing"],
        }

        for action_id, action in AVAILABLE_ACTIONS.items():
            score = 0

            for target in action["targets"]:
                if target.upper() in affected:
                    score += 2

            for cause in root_causes:
                if action_id in cause_map.get(cause, []):
                    score += 3

            scores[action_id] = score

        return [
            action_id
            for action_id, _score in sorted(
                scores.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        ]

    def _build_recommendation(
        self,
        mttr_before: int,
        mttr_after: int,
        confidence: dict,
        risks: list,
    ) -> str:
        reduction = mttr_before - mttr_after
        risk_level = risks[0]["level"] if risks else "LOW"

        if confidence["label"] == "HIGH" and risk_level == "LOW":
            return (
                f"Action strongly recommended - reduces MTTR by {reduction} minutes with low risk"
            )

        if confidence["label"] == "HIGH" and risk_level == "MEDIUM":
            return (
                f"Recommended with caution - MTTR gain of {reduction} minutes but apply during a controlled window"
            )

        if risk_level == "HIGH":
            return "High-risk action - use only as a last resort"

        return f"Viable action - estimated MTTR gain of {reduction} minutes"

    def _estimate_protected_platforms(
        self,
        incident_data: dict,
        action_id: str,
        impact: dict,
    ) -> list:
        affected = self._normalize_platform_list(
            incident_data.get("platforms")
            or incident_data.get("affected_platforms")
            or incident_data.get("incident_intelligence", {}).get(
                "affected_platforms",
                [],
            )
        )
        protected = set(
            platform.upper()
            for platform in impact.get("platforms_recovered", [])
        )

        for target in AVAILABLE_ACTIONS[action_id]["targets"]:
            try:
                impacted_nodes = self.digital_twin.simulate_failure(
                    target.upper()
                ).get("impacted_nodes", [])
            except Exception:
                impacted_nodes = []

            protected.update(node.upper() for node in impacted_nodes)

        return [
            platform
            for platform in affected
            if platform in protected or not protected
        ]

    def _extract_incident_severity(self, incident: dict) -> str:
        severity = incident.get("severity", {})

        if isinstance(severity, dict) and severity.get("label"):
            return str(severity["label"]).upper()

        if incident.get("severity_label"):
            return str(incident["severity_label"]).upper()

        intelligence = incident.get("incident_intelligence", {})

        if intelligence.get("severity_label"):
            return str(intelligence["severity_label"]).upper()

        return "HIGH"

    def _extract_root_cause_keywords(self, incident: dict) -> list:
        root_cause = incident.get("root_cause", {})
        items = []

        if isinstance(root_cause, dict):
            items = root_cause.get("root_causes", [])

        if not items:
            intelligence = incident.get("incident_intelligence", {})
            items = intelligence.get("top_root_causes", [])

        normalized = []

        for item in items:
            keyword = item[0] if isinstance(item, (list, tuple)) and item else item
            text = str(keyword or "").strip().lower()

            if text and text not in normalized:
                normalized.append(text)

        return normalized

    def _extract_sms_degradation(self, incident: dict) -> str:
        impact = incident.get("impact", {})

        if impact.get("sms_delivery_degradation"):
            return str(impact["sms_delivery_degradation"])

        intelligence = incident.get("incident_intelligence", {})

        if intelligence.get("sms_delivery_degradation"):
            return str(intelligence["sms_delivery_degradation"])

        return "N/A"

    def _normalize_platform_list(self, value) -> list:
        platforms = []

        for platform in value or []:
            text = str(platform or "").strip().upper()

            if text and text not in platforms:
                platforms.append(text)

        return platforms

    def _load_topology(self) -> dict:
        if not self.topology_path.exists():
            return {}

        with self.topology_path.open("r", encoding="utf-8") as file_handle:
            return yaml.safe_load(file_handle) or {}

    def _build_digital_twin(self):
        for source, config in self.topology.get("platforms", {}).items():
            for target in config.get("impacts", []):
                self.digital_twin.add_link(source.upper(), str(target).upper())

    def _prepare_incident_document(self, document: dict) -> dict:
        prepared = dict(document)
        prepared["_id"] = str(prepared.get("_id"))
        return prepared

    def _ensure_indexes(self):
        try:
            self.col_sims.create_index("incident_id")
            self.col_sims.create_index("created_at")
        except Exception:
            pass

    def _to_object_id(self, value):
        try:
            return ObjectId(str(value))
        except Exception:
            return None

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _serialize_value(self, value):
        if isinstance(value, dict):
            return {
                key: self._serialize_value(item)
                for key, item in value.items()
            }

        if isinstance(value, list):
            return [self._serialize_value(item) for item in value]

        if isinstance(value, ObjectId):
            return str(value)

        if isinstance(value, datetime):
            return value.isoformat()

        return value

    @staticmethod
    def _scale(value, in_min, in_max, out_min, out_max):
        ratio = (float(value) - in_min) / (in_max - in_min)
        ratio = max(0.0, min(1.0, ratio))

        return round(out_min + ratio * (out_max - out_min), 3)
