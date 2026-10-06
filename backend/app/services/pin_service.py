# backend/app/services/pin_service.py
# Per-channel PIN hashing/verification. bcrypt is used directly (not passlib)
# because passlib's bcrypt backend is unmaintained and breaks on bcrypt>=4.1.
import bcrypt

DEFAULT_ROUNDS = 12


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt(rounds=DEFAULT_ROUNDS)).decode()


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pin.encode(), pin_hash.encode())
    except ValueError:
        # a malformed stored hash is an auth failure, not a server error
        return False
