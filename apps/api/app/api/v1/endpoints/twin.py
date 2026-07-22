"""Endpoint do Gêmeo Digital (versão MVP: prompt-steering + RAG)."""

from fastapi import APIRouter

from app.schemas.twin import ChatRequest, ChatResponse
from app.services.twin_service import TwinService

router = APIRouter(prefix="/twin", tags=["Gêmeo Digital"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # TODO: carregar profile + contexto (RAG) do usuário autenticado.
    service = TwinService()
    result = await service.chat(message=request.message, mode=request.mode)
    return ChatResponse(**result)
