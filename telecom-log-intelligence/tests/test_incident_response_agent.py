from agent.incident_response_agent import IncidentResponseAgent
from agent.schemas import InvestigationRequest


class FakeDashboardService:
    def __init__(
        self,
        fail_faiss=False,
        fail_mongodb=False,
        empty=False,
        anomaly_count=5,
        log_count=5,
        similar_cause="timeout",
        similarity=0.9,
        stored_severity=None,
    ):
        self.fail_faiss = fail_faiss
        self.fail_mongodb = fail_mongodb
        self.empty = empty
        self.anomaly_count = anomaly_count
        self.log_count = log_count
        self.similar_cause = similar_cause
        self.similarity = similarity
        self.stored_severity = stored_severity
        self.incident_anomaly_calls = []

    def search_similar_logs_by_text(self, **kwargs):
        if self.fail_faiss:
            raise RuntimeError("FAISS unavailable")
        if self.empty:
            return {"results": []}
        return {"results": [
            {
                "log_index": index,
                "message": "SMSC timeout while acquiring database connection",
                "similarity_score": 0.8,
            }
            for index in range(1, self.log_count + 1)
        ]}

    def get_incident_context(self, incident_id):
        if self.fail_mongodb:
            raise RuntimeError("MongoDB unavailable")
        context = {"_id": incident_id, "propagation_path": ["SMSC"]}
        if self.stored_severity:
            context["severity"] = {"label": self.stored_severity}
        return context

    def get_anomalies(self):
        if self.fail_mongodb:
            raise RuntimeError("MongoDB unavailable")
        if self.empty:
            return []
        return [
            {"incident_id": "INC-1", "platform": "SMSC"}
            for _ in range(self.anomaly_count)
        ]

    def get_incident_anomalies(self, incident_id):
        self.incident_anomaly_calls.append(incident_id)
        if self.fail_mongodb:
            raise RuntimeError("MongoDB unavailable")
        if self.empty:
            return []
        return [
            {"incident_id": incident_id, "platform": "SMSC"}
            for _ in range(self.anomaly_count)
        ]

    def get_rca(self):
        if self.fail_mongodb:
            raise RuntimeError("MongoDB unavailable")
        return []

    def get_similar_incidents_by_id(self, incident_id, k):
        if self.fail_faiss:
            raise RuntimeError("FAISS unavailable")
        if self.empty:
            return {"similar_incidents": []}
        return {"similar_incidents": [{
            "incident_id": "INC-OLD",
            "top_causes": [self.similar_cause],
            "similarity": self.similarity,
        }]}


class FakeSimilarityEngine:
    dry_run_values = []
    severities = []

    def find_similar_incidents(self, **kwargs):
        self.__class__.dry_run_values.append(kwargs.get("dry_run"))
        self.__class__.severities.append(kwargs.get("severity"))
        return {"matched_incidents": []}


class FakeRemediationRecommender:
    dry_run_values = []

    def recommend_actions(self, **kwargs):
        self.__class__.dry_run_values.append(kwargs.get("dry_run"))
        return {"recommended_actions": ["Restart SMPP sessions"]}


class FallbackSimilarityEngine:
    calls = []

    def find_similar_incidents(self, **kwargs):
        self.__class__.calls.append(kwargs)
        if kwargs["severity"] == "CRITICAL":
            return {"matched_incidents": [{"incident_id": "INC-FALLBACK"}]}
        return {"matched_incidents": []}


class FakeCopilot:
    def __init__(self, fail=False):
        self.fail = fail

    def ask(self, **kwargs):
        if self.fail:
            raise RuntimeError("LLM unavailable")
        if kwargs.get("structured"):
            evidence = kwargs["incident_data"].get("agent_evidence", [])
            return {
                "source": "ollama",
                "structured_reasoning": {
                    "proposed_explanation": "The evidence indicates a timeout root-cause signal.",
                    "supporting_evidence_references": [item["reference"] for item in evidence[:1]],
                    "uncertainty": "The explanation is limited to retrieved evidence.",
                    "unsupported_claims": [],
                },
            }
        return {"answer": "The evidence indicates a timeout root-cause signal."}


def make_agent(service, copilot=None):
    return IncidentResponseAgent(
        dashboard_service=service,
        copilot=copilot or FakeCopilot(),
        remediation_factory=FakeRemediationRecommender,
        similarity_factory=FakeSimilarityEngine,
    )


def request():
    return InvestigationRequest(
        incident_id="INC-1",
        service="SMSC",
        alert="SMSC error rate increased during the last 10 minutes",
        severity="high",
    )


def test_agent_returns_evidence_backed_report():
    report = make_agent(FakeDashboardService()).investigate(request())

    assert report.status == "investigated"
    assert report.confidence > 0.6
    assert report.evidence
    assert report.requires_approval is True
    assert report.approval_status == "pending"
    assert all(item.source and item.reference and item.detail for item in report.evidence)


def test_agent_uses_incident_specific_anomalies():
    service = FakeDashboardService()

    report = make_agent(service).investigate(request())

    assert service.incident_anomaly_calls == ["INC-1"]
    assert any(item.type == "metric" for item in report.evidence)


def test_agent_keeps_empty_anomalies_empty_when_incident_has_none():
    report = make_agent(FakeDashboardService(empty=True)).investigate(request())

    assert not any(item.type == "metric" for item in report.evidence)


def test_agent_handles_missing_incident_without_fabricating_anomalies():
    class MissingIncidentDashboard(FakeDashboardService):
        def get_incident_context(self, incident_id):
            del incident_id
            return {}

        def get_incident_anomalies(self, incident_id):
            del incident_id
            return []

    report = make_agent(MissingIncidentDashboard()).investigate(request())

    assert not any(item.type == "metric" for item in report.evidence)


def test_similarity_falls_back_to_stored_incident_severity_with_weaker_score():
    FallbackSimilarityEngine.calls = []
    agent = IncidentResponseAgent(
        dashboard_service=FakeDashboardService(stored_severity="CRITICAL"),
        copilot=FakeCopilot(),
        remediation_factory=FakeRemediationRecommender,
        similarity_factory=FallbackSimilarityEngine,
    )
    degraded = []

    matches = agent.search_similar_incidents(
        request(),
        {"propagation_path": ["SMSC"], "severity": {"label": "CRITICAL"}},
        degraded,
    )

    assert [call["severity"] for call in FallbackSimilarityEngine.calls] == ["HIGH", "CRITICAL"]
    fallback_match = next(item for item in matches if item["incident_id"] == "INC-FALLBACK")
    assert fallback_match["similarity"] == 0.35
    assert degraded == []


def test_agent_returns_medium_confidence_with_partial_evidence():
    service = FakeDashboardService(anomaly_count=2, log_count=2, similarity=0.4)

    report = make_agent(service).investigate(request())

    assert report.status == "investigated"
    assert 0.2 < report.confidence < 0.7


def test_agent_reduces_confidence_for_contradictory_evidence():
    service = FakeDashboardService(similar_cause="disconnect")

    report = make_agent(service).investigate(request())
    coherent_report = make_agent(FakeDashboardService()).investigate(request())

    assert report.status == "investigated"
    assert report.confidence < coherent_report.confidence


def test_confidence_recognizes_rca_log_and_recommender_rule_alignment():
    report = make_agent(FakeDashboardService()).investigate(request())

    assert report.confidence >= 0.9


def test_confidence_breakdown_matches_reported_score_and_is_deterministic():
    first = make_agent(FakeDashboardService()).investigate(request())
    second = make_agent(FakeDashboardService()).investigate(request())

    assert first.confidence_breakdown.final_score == first.confidence
    assert first.confidence_breakdown == second.confidence_breakdown
    assert 0.0 <= first.confidence <= 1.0
    assert all(component.weight <= 0 for component in first.confidence_breakdown.penalties)


def test_llm_reasoning_is_non_authoritative_and_validates_references():
    class UnsupportedCopilot(FakeCopilot):
        def ask(self, **kwargs):
            return {
                "source": "ollama",
                "structured_reasoning": {
                    "proposed_explanation": "A network outage caused the incident.",
                    "supporting_evidence_references": ["invented-log"],
                    "uncertainty": "Uncertain.",
                    "unsupported_claims": [],
                },
            }

    report = make_agent(FakeDashboardService(), UnsupportedCopilot()).investigate(request())

    assert report.root_cause == "[('timeout', 7.5)]"
    assert report.llm_reasoning.supporting_evidence_references == []
    assert report.llm_reasoning.unsupported_claims


def test_malformed_llm_reasoning_degrades_without_bypassing_approval():
    class MalformedCopilot(FakeCopilot):
        def ask(self, **kwargs):
            return {"source": "ollama", "structured_reasoning": {"proposed_explanation": "timeout"}}

    report = make_agent(FakeDashboardService(), MalformedCopilot()).investigate(request())

    assert "llm" in report.degraded_components
    assert report.llm_reasoning is None
    assert report.requires_approval is True
    assert report.approval_status == "pending"


def test_agent_reports_insufficient_data_without_invented_evidence():
    report = make_agent(FakeDashboardService(empty=True)).investigate(request())

    assert report.status == "insufficient_data"
    assert report.confidence <= 0.2
    assert report.evidence == []


def test_agent_returns_low_confidence_when_only_sparse_evidence_exists():
    service = FakeDashboardService(anomaly_count=1, log_count=0, similarity=0.0)

    report = make_agent(service).investigate(request())

    assert report.confidence <= 0.3


def test_agent_degrades_when_faiss_fails():
    report = make_agent(FakeDashboardService(fail_faiss=True)).investigate(request())

    assert report.status == "degraded"
    assert "faiss" in report.degraded_components
    assert report.evidence


def test_agent_degrades_when_mongodb_fails():
    report = make_agent(FakeDashboardService(fail_mongodb=True)).investigate(request())

    assert report.status in {"degraded", "insufficient_data"}
    assert "mongodb" in report.degraded_components


def test_agent_degrades_when_llm_fails_but_keeps_structured_report():
    report = make_agent(
        FakeDashboardService(),
        copilot=FakeCopilot(fail=True),
    ).investigate(request())

    assert report.status == "degraded"
    assert "llm" in report.degraded_components
    assert report.root_cause
    assert report.evidence


def test_action_always_requires_human_approval():
    report = make_agent(FakeDashboardService()).investigate(request())

    assert report.recommended_action
    assert report.requires_approval is True
    assert report.approval_status == "pending"


def test_investigation_uses_read_only_dry_run_tools():
    FakeSimilarityEngine.dry_run_values = []
    FakeRemediationRecommender.dry_run_values = []

    make_agent(FakeDashboardService()).investigate(request())

    assert FakeSimilarityEngine.dry_run_values == [True]
    assert FakeRemediationRecommender.dry_run_values == [True]
