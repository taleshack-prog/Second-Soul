"""Schemas do Gêmeo Digital."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Mode = Literal["advice", "memory", "decision", "free"]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mode: Mode = "free"


class ChatResponse(BaseModel):
    message: str
    mode: Mode
    confidence: float
    processing_time_ms: float
    model: str
    grounded: bool = False  # se houve contexto (RAG) por trás da resposta


class TwinStatus(BaseModel):
    completeness: float
    total_items: int
    total_interactions: int
    training_ready: bool
