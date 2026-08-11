import json
import os
import time
from datetime import datetime

from llm.explainer import IncidentExplainer


class TelecomAICopilot:

    def __init__(self, explainer=None, enable_cache=True, cache_size=50):
        self.explainer = explainer or IncidentExplainer(
            enable_cache=enable_cache
        )
        self.enable_cache = enable_cache
        self.cache_size = cache_size
        self.model_name = getattr(
            self.explainer,
            "model",
            os.getenv("OLLAMA_MODEL", "mistral"),
        )
        self.metrics = {
            "total_queries": 0,
            "ollama_success": 0,
            "heuristic_fallback": 0,
            "cache_hits": 0,
            "total_response_time": 0.0,
        }
        self.question_patterns = {
            "root_cause": [
                "root",
                "cause",
                "raison",
                "pourquoi",
                "origine",
                "why",
            ],
            "action": [
                "action",
                "fix",
                "solution",
                "recommend",
                "corriger",
                "remediation",
            ],
            "impact": [
                "impact",
                "customer",
                "client",
                "effect",
                "service",
                "affect",
            ],
            "propagation": [
                "propagation",
                "spread",
                "diffusion",
                "chaine",
                "timeline",
                "cascade",
            ],
            "resolution": [
                "resolution",
                "quand",
                "when",
                "delai",
                "temps",
                "minutes",
                "mttr",
            ],
        }

        if self.enable_cache:
            self._query_cache = {}

        print(
            f"[LLM] TelecomAICopilot initialized with model: "
            f"{self.model_name}"
        )

    def get_metrics(self) -> dict:
        avg_time = (
            self.metrics["total_response_time"]
            / self.metrics["total_queries"]
            * 1000
            if self.metrics["total_queries"] > 0
            else 0
        )
        success_rate = (
            self.metrics["ollama_success"]
            / self.metrics["total_queries"]
            * 100
            if self.metrics["total_queries"] > 0
            else 0
        )

        return {
            **self.metrics,
            "avg_response_time_ms": round(avg_time, 2),
            "success_rate": round(success_rate, 1),
        }

    def clear_cache(self):
        if hasattr(self, "_query_cache"):
            self._query_cache.clear()
            return True
        return False

    def ask(self, question: str, incident_data: dict) -> dict:
        start_time = time.time()
        self.metrics["total_queries"] += 1

        question = (question or "").strip()
        context = self.explainer.build_context(incident_data)

        if not question:
            return self._error_response("Question vide")

        cache_key = None

        if self.enable_cache:
            cache_key = self._get_cache_key(
                context["incident_id"],
                question,
                context,
            )
            if cache_key in self._query_cache:
                cached_result = self._query_cache[cache_key].copy()
                cached_result["from_cache"] = True
                self.metrics["cache_hits"] += 1
                elapsed = time.time() - start_time
                cached_result["response_time_ms"] = round(
                    elapsed * 1000,
                    2,
                )
                return cached_result

        question_type = self._detect_question_type(question)
        prompt = self._build_specialized_prompt(
            question_type,
            question,
            context,
        )

        try:
            llm_text = self.explainer.generate_text(prompt)
            parsed = self.explainer._parse_json_response(llm_text)
            answer = str(parsed.get("answer", "")).strip()

            if not answer or self._is_generic_answer(answer):
                answer = self._enhance_answer(
                    answer,
                    question,
                    context,
                    question_type,
                )

            if not answer:
                answer = self._fallback_answer(
                    question,
                    context,
                    question_type,
                )

            result = {
                "question": question,
                "answer": answer,
                "source": "ollama",
                "used_fallback": False,
                "model": self.explainer.model,
                "question_type": question_type,
                "response_time_ms": 0,
                "timestamp": datetime.now().isoformat(),
            }
            self.metrics["ollama_success"] += 1
        except Exception as error:
            result = {
                "question": question,
                "answer": self._fallback_answer(
                    question,
                    context,
                    question_type,
                ),
                "source": "heuristic",
                "used_fallback": True,
                "model": self.explainer.model,
                "question_type": question_type,
                "warning": str(error),
                "response_time_ms": 0,
            }
            self.metrics["heuristic_fallback"] += 1

        elapsed = time.time() - start_time
        self.metrics["total_response_time"] += elapsed
        result["response_time_ms"] = round(elapsed * 1000, 2)
        self.model_name = getattr(self.explainer, "model", self.model_name)

        if self.enable_cache and result["source"] == "ollama" and cache_key:
            self._query_cache[cache_key] = result
            self._trim_cache()

        return result

    def _trim_cache(self):
        if not hasattr(self, "_query_cache"):
            return

        while len(self._query_cache) > self.cache_size:
            oldest_key = next(iter(self._query_cache))
            self._query_cache.pop(oldest_key, None)

    def _get_cache_key(
        self,
        incident_id: str,
        question: str,
        context: dict,
    ) -> str:
        key_data = {
            "incident_id": incident_id,
            "question": question.lower().strip(),
            "severity": context.get("severity"),
            "propagation": tuple(context.get("propagation_path", [])),
        }
        return json.dumps(key_data, sort_keys=True)

    def _detect_question_type(self, question: str) -> str:
        question_lower = question.lower()

        for question_type, keywords in self.question_patterns.items():
            for keyword in keywords:
                if keyword in question_lower:
                    return question_type

        return "general"

    def _build_specialized_prompt(
        self,
        question_type: str,
        question: str,
        context: dict,
    ) -> str:
        propagation_text = (
            " -> ".join(context["propagation_path"])
            if context["propagation_path"]
            else "unknown"
        )

        prompts = {
            "root_cause": f"""You are a telecom incident expert.
Answer in French and return ONLY valid JSON: {{"answer": "..."}}

Context:
- severity: {context["severity"]}
- propagation_path: {propagation_text}
- anomalies: {context["total_anomalies"]}
- root_cause_signals: {context["root_cause"]}

Question: {question}

Write a short root-cause explanation with the most likely failing component and why.""",
            "action": f"""You are a telecom incident expert.
Answer in French and return ONLY valid JSON: {{"answer": "..."}}

Context:
- severity: {context["severity"]}
- propagation_path: {propagation_text}
- recommended_actions: {context["recommended_actions"]}
- root_cause_signals: {context["root_cause"]}

Question: {question}

Write the best immediate action, then one quick verification.""",
            "impact": f"""You are a telecom incident expert.
Answer in French and return ONLY valid JSON: {{"answer": "..."}}

Context:
- customer_impact: {context["impact"]["customer_impact"]}
- sms_delivery_degradation: {context["impact"]["sms_delivery_degradation"]}
- propagation_risk: {context["impact"]["propagation_risk"]}
- predicted_resolution_minutes: {context["predicted_resolution_minutes"]}

Question: {question}

Explain business impact in 2 short sentences.""",
            "propagation": f"""You are a telecom incident expert.
Answer in French and return ONLY valid JSON: {{"answer": "..."}}

Context:
- propagation_path: {propagation_text}
- severity: {context["severity"]}
- root_cause_signals: {context["root_cause"]}

Question: {question}

Explain how the incident propagated and the critical transition points.""",
            "resolution": f"""You are a telecom incident expert.
Answer in French and return ONLY valid JSON: {{"answer": "..."}}

Context:
- predicted_resolution_minutes: {context["predicted_resolution_minutes"]}
- severity: {context["severity"]}
- recommended_actions: {context["recommended_actions"]}

Question: {question}

Estimate the recovery timeline and the most important step.""",
            "general": f"""You are a telecom incident expert.
Answer in French and return ONLY valid JSON: {{"answer": "..."}}

Context:
{json.dumps(context, ensure_ascii=False, indent=2)}

Question: {question}

Give a concise incident explanation with cause, impact and best action.""",
        }

        return prompts.get(question_type, prompts["general"])

    def _is_generic_answer(self, answer: str) -> bool:
        generic_phrases = [
            "unknown",
            "investigate",
            "indisponible",
            "non specifie",
            "non specifiee",
            "je peux expliquer",
        ]
        answer_lower = answer.lower()
        return any(phrase in answer_lower for phrase in generic_phrases)

    def _enhance_answer(
        self,
        raw_answer: str,
        question: str,
        context: dict,
        question_type: str,
    ) -> str:
        if raw_answer and not self._is_generic_answer(raw_answer):
            return raw_answer

        return self._fallback_answer(
            question,
            context,
            question_type,
        )

    def _fallback_answer(
        self,
        question: str,
        context: dict,
        question_type: str,
    ) -> str:
        question_lower = str(question or "").lower()
        asks_root_cause = any(
            token in question_lower
            for token in ["root", "cause", "raison", "pourquoi", "why"]
        )
        asks_action = any(
            token in question_lower
            for token in ["action", "fix", "solution", "recommend", "corriger"]
        )
        recommended_action = (
            context["recommended_actions"][0]
            if context.get("recommended_actions")
            else "Investiguer les logs et redemarrer les services"
        )
        main_platform = (
            context["propagation_path"][0]
            if context.get("propagation_path")
            else "systeme"
        )
        propagation_text = (
            " -> ".join(context["propagation_path"][:3])
            if context.get("propagation_path")
            else "directe"
        )

        if asks_root_cause and asks_action:
            return (
                f"Cause probable: {context['root_cause']}. "
                f"Action recommandee: {recommended_action}"
            )

        if question_type == "root_cause":
            return (
                f"Cause probable: {context['root_cause']} sur "
                f"{main_platform}."
            )

        if question_type == "action":
            return f"Action prioritaire: {recommended_action}"

        if question_type == "impact":
            return (
                f"Impact client: {context['impact']['customer_impact']}. "
                f"{context['total_anomalies']} anomalies detectees."
            )

        if question_type == "propagation":
            return f"Propagation observee: {propagation_text}."

        if question_type == "resolution":
            return (
                "Resolution estimee: "
                f"{context.get('predicted_resolution_minutes', 'inconnue')} minutes."
            )

        return (
            f"Incident {context['severity']} avec cause probable "
            f"{context['root_cause']}. Propagation: {propagation_text}. "
            f"Meilleure action: {recommended_action}"
        )

    def _error_response(self, message: str) -> dict:
        return {
            "question": "",
            "answer": message,
            "source": "error",
            "used_fallback": True,
            "error": True,
        }

    def ask_batch(self, questions: list[str], incident_data: dict) -> list[dict]:
        return [self.ask(question, incident_data) for question in questions]

    def get_suggested_questions(self, incident_data: dict) -> list[str]:
        context = self.explainer.build_context(incident_data)
        suggested = [
            "Quelle est la cause racine ?",
            "Quelle action corrective faut-il lancer ?",
            "Quel est l'impact client ?",
        ]

        if context.get("propagation_path"):
            suggested.append("Comment l'incident s'est propage ?")

        if context.get("predicted_resolution_minutes"):
            suggested.append("Quand sera-t-il resolu ?")

        return suggested
