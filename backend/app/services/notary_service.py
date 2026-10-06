# backend/app/services/notary_service.py
# ADR 0006 rule 5: best-effort sidecar. This stub logs the proof payload;
# the real implementation posts a Compact commitment to Midnight later.
import logging

logger = logging.getLogger(__name__)


class NotaryStub:
    async def record_event(self, payload: dict) -> bool:
        logger.info("notary stub recorded event %s", payload.get("event_id"))
        return True


def get_notary() -> NotaryStub:
    return NotaryStub()