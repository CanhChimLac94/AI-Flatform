"""
Symmetric encryption for user API keys stored in Postgres (NFR-02).
Uses Fernet (AES-128-CBC + HMAC-SHA256) with a key derived from JWT_SECRET_KEY.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    # Derive a 32-byte URL-safe base64 key from the app secret
    raw = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_key(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_key(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt API key — possible key rotation or corruption.")


def mask_key(plaintext: str) -> str:
    """Returns e.g. 'sk-...xK3p' for display — never exposes the full key."""
    if len(plaintext) <= 8:
        return "••••••••"
    return plaintext[:4] + "••••••••" + plaintext[-4:]
