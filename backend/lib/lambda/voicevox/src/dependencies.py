from fastapi import Request
from services.chat_service import ChatService  # ty:ignore[unresolved-import]
from services.contact_service import ContactService  # ty:ignore[unresolved-import]
from services.db_service import DbService  # ty:ignore[unresolved-import]
from services.voice_service import VoiceService  # ty:ignore[unresolved-import]


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


def get_contact_service(request: Request) -> ContactService:
    return request.app.state.contact_service


def get_db_service(request: Request) -> DbService:
    return request.app.state.db_service


def get_voice_service(request: Request) -> VoiceService:
    return request.app.state.voice_service
