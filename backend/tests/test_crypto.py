# backend/tests/test_crypto.py
import base64
import os

import pytest
from cryptography.exceptions import InvalidTag

from app.core.config import settings
from app.services.crypto_service import encrypt_phone, decrypt_phone


@pytest.fixture
def valid_key(monkeypatch):
    key = base64.b64encode(os.urandom(32)).decode()
    monkeypatch.setattr(settings, "phone_encryption_key", key)
    return key


def test_roundtrip(valid_key):
    phone = "+15551234567"
    encrypted = encrypt_phone(phone)
    assert encrypted != phone.encode()
    assert decrypt_phone(encrypted) == phone


def test_different_nonces(valid_key):
    phone = "+15551234567"
    e1 = encrypt_phone(phone)
    e2 = encrypt_phone(phone)
    assert e1 != e2  # Same plaintext, different ciphertext (random nonce)


def test_missing_key_raises_runtime_error(monkeypatch):
    monkeypatch.setattr(settings, "phone_encryption_key", "")
    with pytest.raises(RuntimeError, match="PHONE_ENCRYPTION_KEY"):
        encrypt_phone("+15551234567")


def test_wrong_length_key_raises_runtime_error(monkeypatch):
    monkeypatch.setattr(settings, "phone_encryption_key", base64.b64encode(b"tooshort").decode())
    with pytest.raises(RuntimeError, match="32 bytes"):
        encrypt_phone("+15551234567")


def test_invalid_base64_key_raises_runtime_error(monkeypatch):
    monkeypatch.setattr(settings, "phone_encryption_key", "!!!not-base64!!!")
    with pytest.raises(RuntimeError):
        encrypt_phone("+15551234567")


def test_tampered_ciphertext_raises_invalid_tag(valid_key):
    phone = "+15551234567"
    encrypted = bytearray(encrypt_phone(phone))
    encrypted[-1] ^= 0xFF
    with pytest.raises(InvalidTag):
        decrypt_phone(bytes(encrypted))


def test_cipher_shorter_than_nonce_raises(valid_key):
    with pytest.raises(ValueError, match="ciphertext too short"):
        decrypt_phone(b"\x00" * 11)