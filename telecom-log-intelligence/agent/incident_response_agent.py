from __future__ import annotations

from datetime import datetime
from typing import Any, Callable

from agent.schemas import (
    ConfidenceBreakdown,
    ConfidenceComponent,
    EvidenceItem,
    InvestigationReport,
    InvestigationRequest,
    LLMReasoning,
)
from ai.engine.rca_engine import RCAEngine
from ai.prediction.auto_remediation_recommender import AutoRemediationRecommender
from ai.prediction.incident_similarity_engine import IncidentSimilarityEngine


class IncidentResponseAgent:
    """Coordinate existing AIOps engines into a traceable incident investigation."""

    def __init__(self, dashboard_service: Any, copilot: Any, rca_engine: Any | None = None,
                 remediation_factory: Callable[[], Any] | None = None,
                 similarity_factory: Callable[[], Any] | None = None):
        self.dashboard_service = dashboard_service
        self.copilot = copilot
        self.rca_engine = rca_engine or RCAEngine()
        self.remediation_factory = remediation_factory or AutoRemediationRecommender
        self.similarity_factory = similarity_factory or IncidentSimilarityEngine

    def investigate(self, request: InvestigationRequest) -> InvestigationReport:
        """Run every tool independently so unavailable sources degrade safely."""
        degraded: list[str] = []
        logs = self.search_logs(request, degraded)
        context = self.get_incident_context(request, degraded)
        similar = self.search_similar_incidents(request, context, degraded)
        rca, action = self.retrieve_rca_and_recommendation(request, logs, context, degraded)
        evidence = self._build_evidence(request, logs, context, similar, rca)
        root_cause = self._deterministic_root_cause(rca)
        llm_reasoning = self._formulate_llm_reasoning(
            request, rca, evidence, 0.0, degraded
        )
        confidence, confidence_breakdown = self._calculate_confidence(
            context, logs, similar, rca, degraded, action
        )
        if confidence > 0.4 and not evidence:
            confidence = 0.4
            confidence_breakdown.final_score = confidence

        return InvestigationReport(
            incident_id=request.incident_id,
            root_cause=root_cause,
            confidence=confidence,
            evidence=evidence,
            recommended_action=action,
            requires_approval=True,
            approval_status="pending",
            status=self._status(evidence, confidence, degraded),
            degraded_components=degraded,
            llm_reasoning=llm_reasoning,
            confidence_breakdown=confidence_breakdown,
        )

    def search_logs(self, request: InvestigationRequest, degraded: list[str]) -> list[dict]:
        """Use the existing FAISS text-search wrapper exposed by DashboardService."""
        try:
            result = self.dashboard_service.search_similar_logs_by_text(
                query=request.alert, k=5, platform_filter=request.service,
            )
            return list(result.get("results", [])) if isinstance(result, dict) else []
        except Exception:
            self._degrade(degraded, "faiss")
            return []

    def get_incident_context(self, request: InvestigationRequest, degraded: list[str]) -> dict:
        """Reuse the DashboardService sources behind /dashboard/anomalies and /dashboard/rca."""
        try:
            context = self.dashboard_service.get_incident_context(request.incident_id)
            if hasattr(self.dashboard_service, "get_incident_anomalies"):
                anomalies = self.dashboard_service.get_incident_anomalies(
                    request.incident_id
                )
            else:
                anomalies = self.dashboard_service.get_anomalies()
            rca_documents = self.dashboard_service.get_rca()
        except Exception:
            self._degrade(degraded, "mongodb")
            return {}
        incident_anomalies = [
            item for item in anomalies or []
            if str(item.get("incident_id", "")) == request.incident_id
        ]
        return {**(context or {}), "incident_anomalies": incident_anomalies,
                "rca_documents": rca_documents or []}

    def search_similar_incidents(self, request: InvestigationRequest, context: dict,
                                 degraded: list[str]) -> list[dict]:
        """Use FAISS first, then the existing Mongo incident-similarity engine."""
        matches: list[dict] = []
        try:
            result = self.dashboard_service.get_similar_incidents_by_id(request.incident_id, k=3)
            matches.extend(result.get("similar_incidents", []))
        except Exception:
            self._degrade(degraded, "faiss")
        try:
            similarity_engine = self.similarity_factory()
            result = similarity_engine.find_similar_incidents(
                propagation_path=context.get("propagation_path", []),
                severity=request.severity.upper(),
                root_causes=context.get("root_cause", {}),
                dry_run=True,
            )
            strict_matches = result.get("matched_incidents", [])
            matches.extend(self._with_similarity(strict_matches, 0.6))

            stored_severity = self._severity_label(context.get("severity"))
            if not strict_matches and stored_severity and stored_severity != request.severity.upper():
                fallback = similarity_engine.find_similar_incidents(
                    propagation_path=context.get("propagation_path", []),
                    severity=stored_severity,
                    root_causes=context.get("root_cause", {}),
                    dry_run=True,
                )
                matches.extend(self._with_similarity(
                    fallback.get("matched_incidents", []), 0.35
                ))
        except Exception:
            self._degrade(degraded, "mongodb")
        return self._dedupe_similar(matches, request.incident_id)

    def retrieve_rca_and_recommendation(self, request: InvestigationRequest, logs: list[dict],
                                        context: dict, degraded: list[str]) -> tuple[dict, str]:
        try:
            rca = self.rca_engine.find_root_cause(logs)
        except Exception:
            self._degrade(degraded, "rca_engine")
            rca = {}
        try:
            recommendation = self.remediation_factory().recommend_actions(
                root_causes=rca.get("root_causes", []),
                propagation_path=rca.get("affected_platforms", []) or context.get("propagation_path", []),
                severity=request.severity.upper(),
                dry_run=True,
            )
            actions = recommendation.get("recommended_actions", [])
            action = str(actions[0]) if actions else "No remediation recommendation available."
        except Exception:
            self._degrade(degraded, "mongodb")
            action = "No remediation recommendation available."
        return rca, action

    def _build_evidence(self, request: InvestigationRequest, logs: list[dict], context: dict,
                        similar: list[dict], rca: dict) -> list[EvidenceItem]:
        evidence: list[EvidenceItem] = []
        for log in logs[:3]:
            message = str(log.get("message", "")).strip()
            reference = log.get("log_index") or log.get("_id") or log.get("timestamp")
            if message and reference is not None:
                evidence.append(EvidenceItem(type="log", source="faiss:telecom_log_index",
                    reference=str(reference), detail=message[:300], content=message[:300],
                    timestamp=self._parse_datetime(log.get("timestamp")),
                    relevance=self._relevance(log)))
        anomaly_count = len(context.get("incident_anomalies", []))
        if anomaly_count:
            evidence.append(EvidenceItem(type="metric", source="mongodb:telecom_logs.anomalies",
                reference=f"incident_id:{request.incident_id}",
                detail=(f"{anomaly_count} matching anomaly records were returned by "
                        "DashboardService.get_incident_anomalies."),
                relevance=min(anomaly_count / 5, 1.0)))
        for item in similar[:2]:
            reference = item.get("incident_id") or item.get("_id")
            causes = item.get("top_causes") or item.get("root_cause")
            if reference is not None and causes:
                evidence.append(EvidenceItem(type="similar_incident",
                    source=str(item.get("_source", "faiss:incident_index")), reference=str(reference),
                    detail=f"Recorded root-cause data: {self._as_text(causes)[:240]}",
                    timestamp=self._parse_datetime(item.get("created_at") or item.get("timestamp")),
                    relevance=self._float(item.get("similarity")) or None))
        causes = rca.get("root_causes", [])
        if causes:
            evidence.append(EvidenceItem(type="rca_signal", source="rca:RCAEngine.find_root_cause",
                reference=request.incident_id, detail=f"RCAEngine signals: {self._as_text(causes)[:280]}",
                relevance=min(len(causes) / 5, 1.0)))
        return evidence

    def _calculate_confidence(self, context: dict, logs: list[dict], similar: list[dict], rca: dict,
                              degraded: list[str], recommendation: str | None = None) -> tuple[float, ConfidenceBreakdown]:
        """Deterministic backend score.

        The weights favor traceable data over language generation: anomalies (.30),
        FAISS/log evidence (.20), similar incidents (.20), RCA agreement (.20), and
        recommendation alignment (.10). Contradictions and degraded dependencies
        reduce confidence. The LLM is never used to calculate this score.
        """
        anomaly_signal = min(len(context.get("incident_anomalies", [])) / 5, 1.0)
        log_signal = min(len(logs) / 5, 1.0)
        similar_signal = max(
            (
                self._float(item.get("similarity"))
                for item in similar
                if self._cause_tokens(
                    item.get("top_causes") or item.get("root_cause") or []
                )
            ),
            default=0.0,
        )
        rca_causes = set(self._cause_tokens(rca.get("root_causes", [])))
        similar_causes = set()
        for item in similar:
            similar_causes.update(self._cause_tokens(item.get("top_causes") or item.get("root_cause") or []))
        similar_coherence = (
            len(rca_causes & similar_causes) / len(rca_causes)
            if rca_causes and similar_causes else 0.0
        )
        log_coherence = self._log_coherence(logs, rca_causes)
        coherence = max(similar_coherence, log_coherence)
        contradictions = int(bool(rca_causes and similar_causes and not (rca_causes & similar_causes)))
        recommendation_signal = self._recommendation_alignment(recommendation, rca_causes)
        signals = [
            ConfidenceComponent(name="incident_anomalies", value=anomaly_signal, weight=.30,
                                contribution=.30 * anomaly_signal),
            ConfidenceComponent(name="retrieved_logs", value=log_signal, weight=.20,
                                contribution=.20 * log_signal),
            ConfidenceComponent(name="similar_incidents", value=min(similar_signal, 1.0), weight=.20,
                                contribution=.20 * min(similar_signal, 1.0)),
            ConfidenceComponent(name="evidence_coherence", value=coherence, weight=.20,
                                contribution=.20 * coherence),
            ConfidenceComponent(name="recommendation_alignment", value=recommendation_signal, weight=.10,
                                contribution=.10 * recommendation_signal),
        ]
        penalties = [
            ConfidenceComponent(name="contradictory_root_cause_evidence", value=float(contradictions), weight=-.20,
                                contribution=-.20 * contradictions),
            ConfidenceComponent(name="degraded_dependency", value=float(bool(degraded)), weight=-.15,
                                contribution=-.15 * int(bool(degraded))),
        ]
        raw_score = sum(item.contribution for item in signals + penalties)
        final_score = round(max(0.0, min(1.0, raw_score)), 2)
        return final_score, ConfidenceBreakdown(
            signals=signals,
            penalties=penalties,
            raw_score=round(raw_score, 4),
            final_score=final_score,
        )

    def _deterministic_root_cause(self, rca: dict) -> str:
        causes = rca.get("root_causes", [])
        return self._as_text(causes) if causes else "No root-cause signal was found in the available evidence."

    def _formulate_llm_reasoning(self, request: InvestigationRequest, rca: dict,
                                 evidence: list[EvidenceItem], confidence: float,
                                 degraded: list[str]) -> LLMReasoning | None:
        causes = rca.get("root_causes", [])
        context = {"_id": request.incident_id, "incident_summary": request.alert,
                   "root_cause": {"root_causes": causes},
                   "agent_evidence": [item.model_dump() for item in evidence],
                   "confidence": confidence, "degraded_components": degraded}
        question = ("Summarize the root cause using only supplied evidence. Do not invent facts, "
                    "clearly separate evidence from inference, do not confirm or trigger an action, "
                    "and state when evidence is insufficient or contradictory.")
        try:
            response = self.copilot.ask(
                question=question, incident_data=context, structured=True
            )
            reasoning = response.get("structured_reasoning")
            if not isinstance(reasoning, dict):
                raise ValueError("LLM did not return structured reasoning")
            allowed_references = {item.reference for item in evidence}
            cited = [str(reference) for reference in reasoning["supporting_evidence_references"]]
            unknown_references = [reference for reference in cited if reference not in allowed_references]
            unsupported_claims = list(reasoning["unsupported_claims"])
            unsupported_claims.extend(
                f"Unsupported evidence reference: {reference}" for reference in unknown_references
            )
            cause_tokens = self._cause_tokens(causes)
            explanation = str(reasoning["proposed_explanation"])
            if not cited or unknown_references or not any(token in explanation.lower() for token in cause_tokens):
                unsupported_claims.append("Proposed explanation is not fully supported by deterministic RCA evidence.")
            return LLMReasoning(
                proposed_explanation=explanation,
                supporting_evidence_references=[ref for ref in cited if ref in allowed_references],
                uncertainty=str(reasoning["uncertainty"]),
                unsupported_claims=unsupported_claims,
                source=response.get("source", "ollama") if response.get("source") in {"ollama", "heuristic"} else "ollama",
            )
        except Exception:
            self._degrade(degraded, "llm")
        return None

    @staticmethod
    def _status(evidence: list[EvidenceItem], confidence: float, degraded: list[str]) -> str:
        if not evidence:
            return "insufficient_data"
        if degraded:
            return "degraded"
        return "insufficient_data" if confidence <= 0.2 else "investigated"

    @staticmethod
    def _degrade(degraded: list[str], component: str) -> None:
        if component not in degraded:
            degraded.append(component)

    @staticmethod
    def _float(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _as_text(value: Any) -> str:
        return str(value)

    @staticmethod
    def _cause_tokens(causes: Any) -> list[str]:
        if isinstance(causes, dict):
            causes = causes.get("root_causes", [])
        tokens = []
        for cause in causes or []:
            value = cause[0] if isinstance(cause, (list, tuple)) and cause else cause
            if value:
                tokens.append(str(value).lower())
        return tokens

    @staticmethod
    def _recommendation_alignment(recommendation: str | None, rca_causes: set[str]) -> float:
        if not recommendation or not rca_causes:
            return 0.0
        expected_actions = {
            action for cause, action in AutoRemediationRecommender.ACTION_RULES
            if cause in rca_causes
        }
        return 1.0 if str(recommendation) in expected_actions else 0.0

    @staticmethod
    def _log_coherence(logs: list[dict], rca_causes: set[str]) -> float:
        """Measure explicit RCA token agreement in retrieved log messages only."""
        if not logs or not rca_causes:
            return 0.0
        matched = 0
        for log in logs:
            message = str(log.get("message", "")).lower()
            if any(token in message for token in rca_causes):
                matched += 1
        return matched / len(logs)

    @staticmethod
    def _severity_label(value: Any) -> str:
        if isinstance(value, dict):
            value = value.get("label")
        return str(value or "").upper()

    @staticmethod
    def _with_similarity(matches: list[dict], score: float) -> list[dict]:
        return [
            {**item, "similarity": item.get("similarity", score)}
            for item in matches
        ]

    @staticmethod
    def _relevance(item: dict) -> float | None:
        for key in ["similarity", "similarity_score"]:
            if item.get(key) is not None:
                try:
                    return max(0.0, min(1.0, float(item[key])))
                except (TypeError, ValueError):
                    return None
        return None

    @staticmethod
    def _parse_datetime(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None

    @staticmethod
    def _dedupe_similar(matches: list[dict], current_incident_id: str) -> list[dict]:
        results, seen = [], {str(current_incident_id)}
        for item in matches:
            key = str(item.get("incident_id") or item.get("_id") or "")
            if key and key not in seen:
                seen.add(key)
                results.append(item)
        return results
