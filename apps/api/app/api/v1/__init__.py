from fastapi import APIRouter

from app.api.v1.endpoints import (
    health, import_data, memories, profile, session, talk, twin, voices,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(twin.router)
api_router.include_router(import_data.router)
api_router.include_router(voices.router)
api_router.include_router(profile.router)
api_router.include_router(talk.router)
api_router.include_router(session.router)
api_router.include_router(memories.router)
