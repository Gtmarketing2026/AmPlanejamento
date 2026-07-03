from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco de dados
    DATABASE_URL: str
    # Conexão privilegiada (role dona das tabelas, ignora RLS) — ver .env.example
    # para quais rotas legitimamente precisam dela.
    DATABASE_URL_ADMIN: str

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Open Finance
    OPENFINANCE_CLIENT_ID: str = ""
    OPENFINANCE_CLIENT_SECRET: str = ""
    OPENFINANCE_WEBHOOK_SECRET: str = ""

    # Google Calendar
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Pagamento
    PAYMENT_GATEWAY_SECRET_KEY: str = ""

    # Asaas (gateway de pagamento — cobrança do profissional)
    ASAAS_API_KEY: str = ""
    ASAAS_ENV: str = "sandbox"  # 'sandbox' ou 'production'
    ASAAS_WEBHOOK_TOKEN: str = ""  # token configurado no painel do Asaas ao criar o webhook

    # Regras de negócio (centralizadas aqui para não espalhar "números mágicos" no código)
    CLIENTES_INCLUSOS_PLANO_BASE: int = 4
    PRAZO_EXCLUSAO_SEM_COBRANCA_DIAS: int = 35
    PRAZO_CONGELAMENTO_APOS_INADIMPLENCIA_DIAS: int = 5
    PRAZO_CANCELAMENTO_APOS_CONGELAMENTO_DIAS: int = 30


settings = Settings()
