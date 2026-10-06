# backend/app/services/crypto_service.py
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

NONCE_LENGTH = 12
KEY_LENGTH = 32


def _get_key() -> bytes:
    raw = settings.phone_encryption_key
    if not raw:
        raise RuntimeError("PHONE_ENCRYPTION_KEY is not set")
    try:
        key = base64.b64decode(raw, validate=True)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("PHONE_ENCRYPTION_KEY is not valid base64") from exc
    if len(key) != KEY_LENGTH:
        raise RuntimeError(
            f"PHONE_ENCRYPTION_KEY must decode to exactly {KEY_LENGTH} bytes, got {len(key)}"
        )
    return key


def encrypt_phone(phone: str) -> bytes:
    aes = AESGCM(_get_key())
    nonce = os.urandom(NONCE_LENGTH)
    return nonce + aes.encrypt(nonce, phone.encode(), None)


def decrypt_phone(cipher: bytes) -> str:
    if len(cipher) < NONCE_LENGTH:
        raise ValueError("ciphertext too short: missing nonce")
    aes = AESGCM(_get_key())
    nonce, ct = cipher[:NONCE_LENGTH], cipher[NONCE_LENGTH:]
    return aes.decrypt(nonce, ct, None).decode()