"""Account linking endpoint — generates one-time codes for Telegram (US05 AC1)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.telegram import generate_link_code

router = APIRouter(prefix="/integrations", tags=["integrations"])


class LinkCodeResponse(BaseModel):
    code: str
    expires_in_seconds: int = 600
    instructions: str


@router.post("/telegram/link-code", response_model=LinkCodeResponse)
async def get_telegram_link_code(current_user: User = Depends(get_current_user)):
    code = await generate_link_code(str(current_user.id))
    return LinkCodeResponse(
        code=code,
        instructions=f"Send /link {code} to the Omni AI Telegram bot within 10 minutes.",
    )
