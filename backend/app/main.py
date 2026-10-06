# backend/app/main.py
from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.api.channels import router as channels_router
from app.api.devices import router as devices_router
from app.api.pings import router as pings_router
from app.api.subscription import router as subscription_router
from app.api.worker import router as worker_router


def create_app() -> FastAPI:
    app = FastAPI(title="Ping Platform", version="0.1.0")
    app.include_router(subscription_router)
    app.include_router(channels_router)
    app.include_router(devices_router)
    app.include_router(pings_router)
    app.include_router(worker_router)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Same shape as FastAPI's default 422 body, but the `input` field is
        # stripped from every error entry: it echoes the submitted value, which
        # may be PII (e.g. a phone number) that must not leave the server.
        errors = [
            {k: v for k, v in error.items() if k != "input"}
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content=jsonable_encoder({"detail": errors}))

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
