# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_jwt_secret: str = ""  # HS256 secret Supabase uses to sign auth JWTs
    database_url: str = ""
    privy_app_id: str = ""
    privy_app_secret: str = ""
    upstash_redis_url: str = ""
    upstash_qstash_token: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    onesignal_app_id: str = ""
    onesignal_rest_api_key: str = ""
    phone_encryption_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
