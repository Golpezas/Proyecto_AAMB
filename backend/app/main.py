# backend/app/main.py
from fastapi import FastAPI

from app.api.subscription import router as subscription_router

def create_app() -> FastAPI:
    app = FastAPI(title="Ping Platform", version="0.1.0")
    app.include_router(subscription_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
