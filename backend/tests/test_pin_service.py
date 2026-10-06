# backend/tests/test_pin_service.py
import bcrypt

from app.services.pin_service import hash_pin, verify_pin

PIN = "123456"


def test_hash_pin_returns_bcrypt_hash():
    pin_hash = hash_pin(PIN)
    assert pin_hash.startswith("$2")
    assert pin_hash != PIN
    assert bcrypt.checkpw(PIN.encode(), pin_hash.encode())


def test_verify_pin_accepts_matching_pin():
    assert verify_pin(PIN, hash_pin(PIN)) is True


def test_verify_pin_rejects_wrong_pin():
    assert verify_pin("999999", hash_pin(PIN)) is False


def test_verify_pin_rejects_malformed_hash():
    assert verify_pin(PIN, "not-a-bcrypt-hash") is False
