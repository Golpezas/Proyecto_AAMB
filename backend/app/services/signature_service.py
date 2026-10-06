# backend/app/services/signature_service.py
# EIP-191 personal_sign verification for fan actions (ADR 0006 rule 4).
# There are no fan sessions/JWTs: each state-changing request carries a
# signature over a canonical message with a unix timestamp.
import time

from eth_account import Account
from eth_account.messages import encode_defunct

SIGNATURE_WINDOW_SECONDS = 300


def canonical_message(action: str, parts: list[str], timestamp: int) -> str:
    lowered = [p.lower() for p in parts]
    return ":".join(["PIN", action, *lowered, str(timestamp)])


def verify_signature(message: str, signature: str, expected_address: str) -> bool:
    try:
        signable = encode_defunct(text=message)
        recovered = Account.recover_message(signable, signature=signature)
    except Exception:  # noqa: BLE001 - any recovery failure means invalid
        return False
    return recovered.lower() == expected_address.lower()


def is_fresh(timestamp: int, now: float | None = None) -> bool:
    now = time.time() if now is None else now
    return abs(now - timestamp) <= SIGNATURE_WINDOW_SECONDS
