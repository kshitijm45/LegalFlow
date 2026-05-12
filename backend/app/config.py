from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Clerk
    clerk_secret_key: str
    clerk_publishable_key: str

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/carta"

    # App
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"

    # AWS S3 + SES
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket: str = ""
    ses_from_email: str = ""  # verified sender address in AWS SES

    # Google AI / Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_fast_model: str = "gemini-3.1-flash-lite"
    gemini_embedding_model: str = "models/gemini-embedding-2"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index: str = "carta-contracts"

    # LLM provider — gemini | anthropic | openai
    llm_provider: str = "gemini"

    # Max characters sent to the LLM per call (~4 chars per token, less for legal text)
    # 300_000 chars ≈ 75,000 tokens; covers very large contracts including buried schedule text
    llm_max_chars: int = 300_000

    # Higher limit for obligation extraction — obligations appear after long definitions sections
    # 300_000 chars ≈ 75,000 tokens; keeps long-form schedules and annexures in scope
    obligations_max_chars: int = 300_000

    # Timeline generation — needs the full document to catch all milestones and payment dates
    timeline_max_chars: int = 300_000

    # Max chunks embedded per document. Each chunk is ~800 chars.
    # 200 chunks covers ~160k chars (~120 pages) — enough for the largest legal contracts.
    # Lower this (e.g. 40) to preserve free-tier embedding quota during development.
    embed_max_chunks: int = 200

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
