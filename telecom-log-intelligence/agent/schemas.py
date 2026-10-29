from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class InvestigationRequest(BaseModel):
    incident_id: str
    service: str
    alert: str
    severity: Literal["low", "medium", "high", "critical"]
    started_at: datetime | None = None


class EvidenceItem(BaseModel):
    type: Literal["log", "metric", "similar_incident", "rca_signal"]
    source: str
    reference: str
    detail: str
    timestamp: datetime | None = None
    content: str | None = None
    relevance: float | None = Field(default=None, ge=0.0, le=1.0)


class LLMReasoning(BaseModel):
    """Non-authoritative language-model interpretation of supplied evidence."""

    proposed_explanation: str
    supporting_evidence_references: list[str] = Field(default_factory=list)
    uncertainty: str
    unsupported_claims: list[str] = Field(default_factory=list)
    source: Literal["ollama", "heuristic"]


class ConfidenceComponent(BaseModel):
    name: str
    value: float
    weight: float
    contribution: float


class ConfidenceBreakdown(BaseModel):
    signals: list[ConfidenceComponent]
    penalties: list[ConfidenceComponent]
    raw_score: float
    final_score: float


class InvestigationReport(BaseModel):
    incident_id: str
    root_cause: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceItem]
    recommended_action: str
    requires_approval: bool = True
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    status: Literal["investigated", "degraded", "insufficient_data"]
    degraded_components: list[str] = Field(default_factory=list)
    llm_reasoning: LLMReasoning | None = None
    confidence_breakdown: ConfidenceBreakdown | None = None
