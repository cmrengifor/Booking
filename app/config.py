from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str

    # WhatsApp Business Cloud API. Left unset in dev -- app/whatsapp.py
    # falls back to logging instead of sending when these are absent.
    # Requires a Meta Business account, a verified WhatsApp Business
    # phone number, and pre-approved message templates before any of
    # this can send a real message. None of that can be done from code.
    whatsapp_access_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_api_version: str = "v21.0"


settings = Settings()
