"""Schemas do fluxo de importação (wizard assíncrono)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ImportPreviewItem(BaseModel):
    role: str | None
    source: str
    content: str
    pii_scrubbed: bool
    classification: str


class ImportResult(BaseModel):
    status: str
    platform: str
    file: str
    raw_count: int
    clean_count: int
    scrubbed_count: int
    by_role: dict[str, int]
    preview: list[ImportPreviewItem]


class JobAccepted(BaseModel):
    job_id: str
    file: str


class JobStatus(BaseModel):
    id: str
    status: str                      # queued | running | done | error
    stage: str | None = None
    stage_info: dict[str, Any] = {}
    file: str
    result: ImportResult | None = None
    error: str | None = None
    created_at: float
    updated_at: float
