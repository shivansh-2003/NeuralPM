from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/neuralpm"
    env: str = "development"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 24

    class Config:
        env_file = ".env"
        extra = "ignore"


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
