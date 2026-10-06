# backend/app/core/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_jwt_secret: str = ""  # HS256 secret Supabase uses to sign auth JWTs
    database_url: str = ""
    upstash_redis_url: str = ""
    upstash_qstash_token: str = ""
    public_api_url: str = ""  # base URL the QStash worker delivers back to
    onesignal_app_id: str = ""
    onesignal_rest_api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
