import json
import os
import time
from datetime import datetime
from typing import Any

import requests


class IncidentExplainer:

    def __init__(
        self,
        model: str | None = None,
        ollama_url: str | None = None,
        timeout_seconds: int = 60,
        enable_cache: bool = True,
        cache_size: int = 100,
    ):
        self.model = model or os.getenv("OLLAMA_MODEL", "mistral")
        self.ollama_url = ollama_url or os.getenv(
            "OLLAMA_URL",
            "http://127.0.0.1:11434/api/generate",
        )
        self.timeout_seconds = int(
            os.getenv("OLLAMA_TIMEOUT_SECONDS", str(timeout_seconds))
        )
        self.enable_cache = enable_cache
        self.cache_size = cache_size
        self.available_models = set()
        self.fallback_models = self._load_fallback_models()
        self.metrics = {
            "total_requests": 0,
            "ollama_success": 0,
            "heuristic_fallback": 0,
            "cache_hits": 0,
            "total_response_time": 0.0,
            "avg_response_time": 0.0,
        }

        if self.enable_cache:
            self._cache = {}

        self._test_connection()

    def _test_connection(self):
        try:
            response = requests.get(
                self.ollama_url.replace("/api/generate", "/api/tags"),
                timeout=5,
            )
            if response.status_code == 200:
                payload = response.json()
                self.available_models = {
                    str(item.get("name", "")).strip()
                    for item in payload.get("models", [])
                    if item.get("name")
                }
                self._select_preferred_model()
                print(
                    f"[LLM] Ollama connected successfully (model: {self.model})"
                )
            else:
                print(
                    "[LLM] Ollama reachable but returned unexpected status: "
                    f"{response.status_code}"
                )
        except Exception as error:
            print(f"[LLM] Ollama connection warning: {error}")
            print("[LLM] The system will fall back to heuristics if needed")

    def _load_fallback_models(self) -> list[str]:
        raw_models = os.getenv(
            "OLLAMA_FALLBACK_MODELS",
            (
                "qwen2.5:0.5b-instruct,qwen2.5:0.5b,"
                "tinyllama,phi3:mini,mistral"
            ),
        )
        return [
            model.strip()
            for model in raw_models.split(",")
            if model.strip()
        ]

    def _normalize_model_name(self, model_name: str | None) -> str:
        return str(model_name or "").strip().lower()

    def _resolve_available_model(self, candidate: str | None) -> str | None:
        normalized_candidate = self._normalize_model_name(candidate)

        if not normalized_candidate:
            return None

        if not self.available_models:
            return str(candidate).strip()

        available_by_exact = {
            self._normalize_model_name(model_name): model_name
            for model_name in self.available_models
        }

        if normalized_candidate in available_by_exact:
            return available_by_exact[normalized_candidate]

        candidate_base = normalized_candidate.split(":", 1)[0]

        for model_name in self.available_models:
            normalized_model = self._normalize_model_name(model_name)
            model_base = normalized_model.split(":", 1)[0]

            if (
                normalized_model == f"{candidate_base}:latest"
                or model_base == candidate_base
            ):
                return model_name

        return None

    def _candidate_models(self) -> list[str]:
        candidates = [self.model] + self.fallback_models
        deduped = []

        for candidate in candidates:
            normalized = str(candidate or "").strip()

            if normalized and normalized not in deduped:
                deduped.append(normalized)

        if self.available_models:
            available_candidates = []

            for candidate in deduped:
                resolved = self._resolve_available_model(candidate)

                if resolved and resolved not in available_candidates:
                    available_candidates.append(resolved)

            if available_candidates:
                return available_candidates

        return deduped

    def _select_preferred_model(self):
        if not self.available_models:
            return

        resolved_current = self._resolve_available_model(self.model)

        if resolved_current:
            self.model = resolved_current
            return

        for candidate in self._candidate_models():
            resolved = self._resolve_available_model(candidate)

            if resolved:
                self.model = resolved
                return

    def get_metrics(self) -> dict:
        avg_time = (
            self.metrics["total_response_time"]
            / self.metrics["total_requests"]
            * 1000
            if self.metrics["total_requests"] > 0
            else 0
        )
        success_rate = (
            self.metrics["ollama_success"]
            / self.metrics["total_requests"]
            * 100
            if self.metrics["total_requests"] > 0
            else 0
        )

        return {
            **self.metrics,
            "avg_response_time_ms": round(avg_time, 2),
            "success_rate": round(success_rate, 1),
        }

    def reset_metrics(self):
        self.metrics = {
            "total_requests": 0,
            "ollama_success": 0,
            "heuristic_fallback": 0,
            "cache_hits": 0,
            "total_response_time": 0.0,
            "avg_response_time": 0.0,
        }

    def clear_cache(self):
        if hasattr(self, "_cache"):
            self._cache.clear()
            return True
        return False

    def build_context(self, incident_data: dict) -> dict:
        root_cause = (
            incident_data.get("root_cause")
            or incident_data.get("rca")
            or incident_data.get("root_cause_analysis")
            or {}
        )
        impact = (
            incident_data.get("impact")
            or incident_data.get("impact_prediction")
            or {}
        )
        severity = incident_data.get("severity") or {}

        if isinstance(severity, str):
            severity = {"label": severity}

        recommended_actions = (
            incident_data.get("recommended_actions")
            or incident_data.get("auto_remediation", {}).get(
                "recommended_actions",
                [],
            )
            or []
        )
        incident_summary = incident_data.get("incident_summary", {})
        incident_summary_payload = (
            incident_summary
            if isinstance(incident_summary, dict)
            else {}
        )

        propagation_path = (
            incident_data.get("propagation_path")
            or incident_data.get("timeline")
            or incident_data.get("telecom_rca", {}).get(
                "propagation_path",
                [],
            )
            or incident_summary_payload.get(
                "propagation_path",
                [],
            )
            or incident_data.get("telecom_dependency_analysis", {}).get(
                "propagation_path",
                [],
            )
            or []
        )

        if isinstance(propagation_path, dict):
            propagation_path = propagation_path.get("timeline", [])

        top_causes = (
            root_cause.get("root_causes", [])
            if isinstance(root_cause, dict)
            else root_cause
        ) or incident_data.get("top_root_causes", [])

        return {
            "incident_id": str(
                incident_data.get("_id")
                or incident_data.get("incident_id")
                or "latest"
            ),
            "severity": severity.get("label")
            or incident_data.get("severity_label")
            or incident_data.get("snapshot_severity")
            or impact.get("severity_label")
            or "UNKNOWN",
            "propagation_path": propagation_path,
            "root_cause": self._format_root_causes(top_causes),
            "impact": {
                "customer_impact": impact.get("customer_impact")
                or impact.get("level")
                or incident_data.get("customer_impact")
                or "UNKNOWN",
                "sms_delivery_degradation": impact.get(
                    "sms_delivery_degradation"
                )
                or incident_data.get("sms_delivery_degradation"),
                "propagation_risk": impact.get("propagation_risk")
                or incident_data.get("propagation_risk"),
            },
            "recommended_actions": recommended_actions,
            "predicted_resolution_minutes": incident_data.get(
                "predicted_resolution_minutes"
            )
            or incident_data.get("duration_prediction", {}).get(
                "estimated_resolution_minutes"
            )
            or incident_data.get("estimated_resolution_minutes"),
            "total_anomalies": incident_data.get("total_anomalies")
            or incident_data.get("anomaly_count")
            or len(incident_data.get("anomalies", []))
            or 0,
            "affected_services": incident_data.get("affected_services", []),
            "protocol": incident_data.get("protocol", "SMPP/SS7"),
            "agent_evidence": incident_data.get("agent_evidence", []),
        }

    def explain_incident(self, incident_data: dict) -> dict:
        start_time = time.time()
        self.metrics["total_requests"] += 1
        context = self.build_context(incident_data)

        if self.enable_cache:
            cache_key = self._get_cache_key(context)
            if cache_key in self._cache:
                cached_result = self._cache[cache_key].copy()
                cached_result["from_cache"] = True
                cached_result["cache_timestamp"] = datetime.now().isoformat()
                self.metrics["cache_hits"] += 1
                elapsed = time.time() - start_time
                cached_result["response_time_ms"] = round(elapsed * 1000, 2)
                return cached_result

        prompt = self._build_enhanced_prompt(context)

        try:
            llm_text = self.generate_text(prompt)
            parsed = self._parse_json_response(llm_text)
            result = {
                "incident_id": context["incident_id"],
                "manager_summary": parsed.get("manager_summary")
                or self._fallback_manager_summary(context),
                "technical_explanation": parsed.get("technical_explanation")
                or self._fallback_technical_explanation(context),
                "recommended_action": parsed.get("recommended_action")
                or self._fallback_recommended_action(context),
                "source": "ollama",
                "model": self.model,
                "used_fallback": False,
                "response_time_ms": 0,
                "timestamp": datetime.now().isoformat(),
            }
            self.metrics["ollama_success"] += 1

            if self.enable_cache:
                self._cache[cache_key] = result
                self._trim_cache()
        except Exception as error:
            result = self._build_fallback_response(context, str(error))
            self.metrics["heuristic_fallback"] += 1

        elapsed = time.time() - start_time
        self.metrics["total_response_time"] += elapsed
        self.metrics["avg_response_time"] = (
            self.metrics["total_response_time"]
            / self.metrics["total_requests"]
        )
        result["response_time_ms"] = round(elapsed * 1000, 2)

        return result

    def _trim_cache(self):
        if not hasattr(self, "_cache"):
            return

        while len(self._cache) > self.cache_size:
            oldest_key = next(iter(self._cache))
            self._cache.pop(oldest_key, None)

    def _get_cache_key(self, context: dict) -> str:
        key_fields = {
            "severity": context.get("severity"),
            "propagation_path": tuple(context.get("propagation_path", [])),
            "total_anomalies": context.get("total_anomalies"),
            "root_cause": context.get("root_cause"),
            "recommended_actions": tuple(
                context.get("recommended_actions", [])
            ),
        }
        return json.dumps(key_fields, sort_keys=True)

    def generate_text(self, prompt: str) -> str:
        errors = []

        for model_name in self._candidate_models():
            for force_json in [True, False]:
                payload = {
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                    },
                }

                if force_json:
                    payload["format"] = "json"

                try:
                    response = requests.post(
                        self.ollama_url,
                        json=payload,
                        timeout=self.timeout_seconds,
                    )
                    response.raise_for_status()
                    result = response.json()
                    response_text = result.get("response", "").strip()

                    if not response_text:
                        raise RuntimeError(
                            "Ollama returned an empty response"
                        )

                    self.model = model_name
                    return response_text
                except requests.exceptions.HTTPError as error:
                    status_code = getattr(
                        getattr(error, "response", None),
                        "status_code",
                        None,
                    )
                    errors.append(
                        f"{model_name} ({'json' if force_json else 'text'}) "
                        f"http {status_code or 'error'}: {error}"
                    )
                except requests.exceptions.Timeout:
                    errors.append(
                        f"{model_name} ({'json' if force_json else 'text'}) timeout"
                    )
                except requests.exceptions.ConnectionError as error:
                    errors.append(
                        f"{model_name} ({'json' if force_json else 'text'}) "
                        f"not reachable: {error}"
                    )
                except Exception as error:
                    errors.append(
                        f"{model_name} ({'json' if force_json else 'text'}) "
                        f"failed: {error}"
                    )

        if errors:
            raise RuntimeError(" | ".join(errors[:4]))

        raise RuntimeError("Ollama request failed without details")

    def _build_enhanced_prompt(self, context: dict) -> str:
        return f"""You are a telecom incident expert.
Return ONLY valid JSON with these keys:
manager_summary, technical_explanation, recommended_action

Incident context:
- severity: {context["severity"]}
- platforms: {context["propagation_path"]}
- anomalies: {context["total_anomalies"]}
- root_cause_signals: {context["root_cause"]}
- customer_impact: {context["impact"]["customer_impact"]}
- recommended_actions: {context["recommended_actions"]}

Output rules:
- manager_summary: 2 short French sentences for management
- technical_explanation: 2 or 3 short French technical sentences
- recommended_action: 1 short French action line
"""

    def _build_fallback_response(
        self,
        context: dict,
        error_message: str | None = None,
    ) -> dict:
        return {
            "incident_id": context["incident_id"],
            "manager_summary": self._fallback_manager_summary(context),
            "technical_explanation": self._fallback_technical_explanation(
                context
            ),
            "recommended_action": self._fallback_recommended_action(context),
            "source": "heuristic",
            "model": self.model,
            "used_fallback": True,
            "warning": error_message,
        }

    def _parse_json_response(self, llm_text: str) -> dict:
        text = (llm_text or "").strip()

        if not text:
            raise ValueError("Empty response")

        if text.startswith("```"):
            lines = [
                line
                for line in text.splitlines()
                if not line.strip().startswith("```")
            ]
            text = "\n".join(lines).strip()

        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1 and end > start:
            candidate = text[start : end + 1]
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed

        raise ValueError("Invalid JSON response")

    def _fallback_manager_summary(self, context: dict) -> str:
        propagation = context.get("propagation_path", [])
        propagation_text = ", ".join(propagation[:3]) if propagation else "systeme"
        return (
            f"Incident {context['severity']} detecte sur {propagation_text}. "
            f"Impact client: {context['impact']['customer_impact']} avec "
            f"{context['total_anomalies']} anomalies."
        )

    def _fallback_technical_explanation(self, context: dict) -> str:
        return (
            f"Cause probable: {context['root_cause']}. "
            f"Propagation: {context['propagation_path'] or 'directe'}. "
            f"{context['total_anomalies']} anomalies de niveau {context['severity']}."
        )

    def _fallback_recommended_action(self, context: dict) -> str:
        actions = context.get("recommended_actions", [])

        if actions:
            return str(actions[0])

        root_cause = context.get("root_cause", "").lower()

        if "timeout" in root_cause:
            return "Augmenter les timeouts et verifier la connectivite"
        if "fail" in root_cause:
            return "Redemarrer les services affectes et analyser les logs"
        if "queue full" in root_cause:
            return "Augmenter la capacite de queue et verifier le backlog"

        return "Investiguer les composants critiques en priorite"

    def _format_root_causes(self, root_causes: list[Any]) -> str:
        if not root_causes:
            return "Indisponible"

        normalized = []

        for item in root_causes[:3]:
            if isinstance(item, (list, tuple)) and item:
                normalized.append(str(item[0]))
            else:
                normalized.append(str(item))

        return ", ".join(normalized)
