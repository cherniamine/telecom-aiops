from llm.explainer import IncidentExplainer
from llm.telecom_ai_copilot import TelecomAICopilot
from similarity.faiss_similarity_engine import FaissSimilarityEngine


class _FakeResponse:

    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests

            raise requests.exceptions.HTTPError(
                f"{self.status_code} error",
                response=self,
            )


class _FakeSlice:

    def __init__(self, payload):
        self._payload = payload

    def to_pydict(self):
        return self._payload


class _FakeTable:

    def __init__(self, columns):
        self._columns = columns

    def slice(self, offset, length):
        del length
        return _FakeSlice(
            {
                key: [values[offset]]
                for key, values in self._columns.items()
            }
        )


class _FakeDatasetFile:

    def __init__(self, columns):
        self._table = _FakeTable(columns)

    def read_row_group(self, row_group_index, columns=None):
        del row_group_index
        del columns
        return self._table


def test_incident_explainer_build_context_supports_realtime_shape():

    explainer = IncidentExplainer(timeout_seconds=1)
    context = explainer.build_context(
        {
            "_id": "rt-1",
            "rca": {
                "root_causes": [
                    ["timeout", 12],
                    ["retry", 3],
                ]
            },
            "telecom_rca": {
                "propagation_path": ["SMSC", "SMPPS"]
            },
            "impact_prediction": {
                "severity_label": "HIGH",
                "customer_impact": "MEDIUM",
                "sms_delivery_degradation": "LOW",
                "propagation_risk": "LOW",
            },
            "auto_remediation": {
                "recommended_actions": [
                    "Restart SMPP sessions"
                ]
            },
            "duration_prediction": {
                "estimated_resolution_minutes": 12
            },
            "anomalies": [1, 2, 3],
        }
    )

    assert context["incident_id"] == "rt-1"
    assert context["severity"] == "HIGH"
    assert context["root_cause"] == "timeout, retry"
    assert context["propagation_path"] == ["SMSC", "SMPPS"]
    assert context["recommended_actions"] == ["Restart SMPP sessions"]
    assert context["predicted_resolution_minutes"] == 12
    assert context["total_anomalies"] == 3


def test_incident_explainer_build_context_accepts_string_incident_summary():
    explainer = IncidentExplainer(timeout_seconds=1)

    context = explainer.build_context(
        {
            "_id": "agent-1",
            "incident_summary": "SMSC timeout alert",
            "root_cause": {"root_causes": [["timeout", 4]]},
        }
    )

    assert context["incident_id"] == "agent-1"
    assert context["propagation_path"] == []
    assert context["root_cause"] == "timeout"


def test_incident_explainer_build_context_accepts_dict_incident_summary():
    explainer = IncidentExplainer(timeout_seconds=1)

    context = explainer.build_context(
        {
            "_id": "agent-2",
            "incident_summary": {"propagation_path": ["SMSC", "SMPPS"]},
        }
    )

    assert context["propagation_path"] == ["SMSC", "SMPPS"]


def test_incident_explainer_build_context_accepts_missing_incident_summary():
    explainer = IncidentExplainer(timeout_seconds=1)

    context = explainer.build_context({"_id": "agent-3"})

    assert context["incident_id"] == "agent-3"
    assert context["propagation_path"] == []


def test_telecom_ai_copilot_fallback_combines_root_cause_and_action():

    explainer = IncidentExplainer(timeout_seconds=1)
    copilot = TelecomAICopilot(explainer=explainer)
    context = {
        "root_cause": "timeout, retry",
        "impact": {"customer_impact": "MEDIUM"},
        "propagation_path": ["SMSC"],
        "recommended_actions": ["Restart SMPP sessions"],
    }

    answer = copilot._fallback_answer(
        "What is the root cause and the best action?",
        context,
        "general",
    )

    assert "Cause probable" in answer
    assert "Action recommandee" in answer
    assert "Restart SMPP sessions" in answer


def test_incident_explainer_falls_back_to_available_model_alias(
    monkeypatch,
):

    def fake_get(url, timeout):
        del url
        del timeout
        return _FakeResponse(
            {
                "models": [
                    {"name": "phi3:mini"},
                    {"name": "mistral:latest"},
                ]
            }
        )

    def fake_post(url, json, timeout):
        del url
        del timeout

        if json["model"] == "phi3:mini":
            return _FakeResponse({}, status_code=500)

        if json["model"] == "mistral:latest" and "format" in json:
            return _FakeResponse({}, status_code=500)

        return _FakeResponse(
            {"response": '{"answer":"Action prioritaire: restart SMSC"}'}
        )

    monkeypatch.setattr("requests.get", fake_get)
    monkeypatch.setattr("requests.post", fake_post)

    explainer = IncidentExplainer(model="phi3:mini", timeout_seconds=1)
    response_text = explainer.generate_text("Explain this incident")

    assert "restart SMSC" in response_text
    assert explainer.model == "mistral:latest"


def test_telecom_ai_copilot_parses_wrapped_json_from_llm(monkeypatch):

    monkeypatch.setattr(
        IncidentExplainer,
        "_test_connection",
        lambda self: None,
    )

    explainer = IncidentExplainer(timeout_seconds=1)
    monkeypatch.setattr(
        explainer,
        "generate_text",
        lambda prompt: 'Result:\n{"answer":"Action prioritaire: restart SMSC"}',
    )
    copilot = TelecomAICopilot(explainer=explainer)

    result = copilot.ask(
        "What is the best action?",
        {
            "_id": "inc-1",
            "recommended_actions": ["Restart SMPP sessions"],
            "telecom_rca": {"propagation_path": ["SMSC", "SMPPS"]},
            "severity": {"label": "HIGH"},
            "root_cause": {"root_causes": [["timeout", 7]]},
        },
    )

    assert result["source"] == "ollama"
    assert result["used_fallback"] is False
    assert "restart SMSC" in result["answer"]


def test_telecom_ai_copilot_parses_structured_reasoning(monkeypatch):
    monkeypatch.setattr(IncidentExplainer, "_test_connection", lambda self: None)
    explainer = IncidentExplainer(timeout_seconds=1)
    monkeypatch.setattr(
        explainer,
        "generate_text",
        lambda prompt: ('{"proposed_explanation":"Timeout observed",'
                        '"supporting_evidence_references":["42"],'
                        '"uncertainty":"Limited sample",'
                        '"unsupported_claims":[]}'),
    )
    result = TelecomAICopilot(explainer=explainer).ask(
        "What is the root cause?",
        {"_id": "inc-1", "agent_evidence": [{"reference": "42"}]},
        structured=True,
    )

    assert result["source"] == "ollama"
    assert result["structured_reasoning"]["supporting_evidence_references"] == ["42"]


def test_telecom_ai_copilot_structured_response_missing_fields_uses_fallback(monkeypatch):
    monkeypatch.setattr(IncidentExplainer, "_test_connection", lambda self: None)
    explainer = IncidentExplainer(timeout_seconds=1)
    monkeypatch.setattr(explainer, "generate_text", lambda prompt: '{"answer":"timeout"}')

    result = TelecomAICopilot(explainer=explainer).ask(
        "What is the root cause?", {"_id": "inc-1"}, structured=True
    )

    assert result["source"] == "heuristic"
    assert result["used_fallback"] is True


def test_telecom_ai_copilot_structured_malformed_json_uses_fallback(monkeypatch):
    monkeypatch.setattr(IncidentExplainer, "_test_connection", lambda self: None)
    explainer = IncidentExplainer(timeout_seconds=1)
    monkeypatch.setattr(explainer, "generate_text", lambda prompt: "not json at all")

    result = TelecomAICopilot(explainer=explainer).ask(
        "What is the root cause?", {"_id": "inc-1"}, structured=True
    )

    assert result["source"] == "heuristic"
    assert result["used_fallback"] is True


def test_telecom_ai_copilot_structured_timeout_uses_fallback(monkeypatch):
    monkeypatch.setattr(IncidentExplainer, "_test_connection", lambda self: None)
    explainer = IncidentExplainer(timeout_seconds=1)

    def timeout(prompt):
        raise TimeoutError("Ollama timed out")

    monkeypatch.setattr(explainer, "generate_text", timeout)
    result = TelecomAICopilot(explainer=explainer).ask(
        "What is the root cause?", {"_id": "inc-1"}, structured=True
    )

    assert result["source"] == "heuristic"
    assert result["used_fallback"] is True


def test_faiss_dataset_lookup_returns_metadata(monkeypatch):

    engine = FaissSimilarityEngine()
    fake_dataset = _FakeDatasetFile(
        {
            "platform": ["smsc", "dmc", "mmg"],
            "message": [
                "timeout on smsc queue",
                "authorization session missing",
                "database pool alert",
            ],
            "timestamp": [
                "2026-02-01T00:00:00",
                "2026-02-02T00:00:00",
                "2026-02-03T00:00:00",
            ],
            "is_error": [True, True, False],
            "is_warning": [False, False, True],
        }
    )

    monkeypatch.setattr(
        engine,
        "_get_dataset_row_groups",
        lambda: [(0, 3, 0)],
    )
    monkeypatch.setattr(
        engine,
        "_get_dataset_file",
        lambda: fake_dataset,
    )

    document = engine._get_log_document_from_dataset(1)

    assert document is not None
    assert document["platform"] == "DMC"
    assert document["message"] == "authorization session missing"
    assert document["level"] == "ERROR"
    assert document["source_collection"] == "dmc_logs"
