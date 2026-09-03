from typing import Annotated

from dependencies import get_contact_service  # ty:ignore[unresolved-import]
from fastapi import APIRouter, Depends
from schemas import ContactRequest, ContactResponse  # ty:ignore[unresolved-import]
from services.contact_service import ContactService  # ty:ignore[unresolved-import]

router = APIRouter()


@router.post("/contact")
async def send_contact(
    request: ContactRequest,
    contact_service: Annotated[ContactService, Depends(get_contact_service)],
) -> ContactResponse:
    contact_service.send_contact_email(request.name, request.email, request.message)
    return ContactResponse(message="お問い合わせを送信しました")
