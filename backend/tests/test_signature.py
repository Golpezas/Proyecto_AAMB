# backend/tests/test_signature.py

from eth_account import Account
from eth_account.messages import encode_defunct

from app.services.signature_service import (
    canonical_message,
    is_fresh,
    verify_signature,
)


def _sign(text: str, private_key: str) -> str:
    return Account.sign_message(encode_defunct(text=text), private_key).signature.hex()


def test_canonical_message_format():
    msg = canonical_message("subscribe", ["@Alice", "0xABC"], 1760000000)
    assert msg == "PIN:subscribe:@alice:0xabc:1760000000"


def test_verify_signature_roundtrip():
    acct = Account.create()
    msg = canonical_message("subscribe", ["@alice", acct.address.lower()], 1760000000)
    sig = _sign(msg, acct.key)
    assert verify_signature(msg, sig, acct.address) is True


def test_verify_signature_rejects_wrong_wallet():
    acct, other = Account.create(), Account.create()
    msg = canonical_message("subscribe", ["@alice", other.address.lower()], 1760000000)
    sig = _sign(msg, acct.key)
    assert verify_signature(msg, sig, other.address) is False


def test_verify_signature_rejects_tampered_message():
    acct = Account.create()
    sig = _sign(f"PIN:subscribe:@alice:{acct.address.lower()}:1760000000", acct.key)
    assert verify_signature(f"PIN:subscribe:@bob:{acct.address.lower()}:1760000000", sig, acct.address) is False


def test_verify_signature_rejects_garbage():
    assert verify_signature("PIN:subscribe:@alice:0xabc:1", "not-a-sig", "0xabc") is False


def test_is_fresh_window():
    now = 1760000000.0
    assert is_fresh(1760000000, now=now) is True
    assert is_fresh(1760000000 - 300, now=now) is True
    assert is_fresh(1760000000 - 301, now=now) is False
    assert is_fresh(1760000000 + 301, now=now) is False
