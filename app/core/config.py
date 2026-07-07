from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Banco de dados
    DATABASE_URL: str
    # Conexão privilegiada (role dona das tabelas, ignora RLS) — ver .env.example
    # para quais rotas legitimamente precisam dela.
    DATABASE_URL_ADMIN: str

    # URL de produção do frontend (Vercel) — liberada no CORS além do localhost
    # de desenvolvimento. Vazio = só localhost liberado.
    FRONTEND_URL: str = ""

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
    # URL de callback registrada no Google Cloud Console (ex:
    # https://fluxo-backend.vercel.app/crm/google/callback). Vazio = OAuth
    # desativado (a UI mostra "integração não configurada").
    GOOGLE_REDIRECT_URI: str = ""

    # Pagamento
    PAYMENT_GATEWAY_SECRET_KEY: str = ""

    # Asaas (gateway de pagamento — cobrança do profissional)
    ASAAS_API_KEY: str = ""
    ASAAS_ENV: str = "sandbox"  # 'sandbox' ou 'production'
    ASAAS_WEBHOOK_TOKEN: str = ""  # token configurado no painel do Asaas ao criar o webhook

    # Supabase Storage — upload de extratos/faturas (Plano Essencial)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # bypassa RLS/policies de storage -- nunca expor ao frontend
    SUPABASE_STORAGE_BUCKET: str = "importacoes"

    # OpenAI -- classificação automática de categoria/subcategoria
    OPENAI_API_KEY: str = ""

    # Regras de negócio (centralizadas aqui para não espalhar "números mágicos" no código)
    TRIAL_DIAS: int = 7  # trial concedido automaticamente no cadastro do planejador
    CLIENTES_INCLUSOS_PLANO_BASE: int = 4
    PRAZO_EXCLUSAO_SEM_COBRANCA_DIAS: int = 35
    PRAZO_CONGELAMENTO_APOS_INADIMPLENCIA_DIAS: int = 5
    PRAZO_CANCELAMENTO_APOS_CONGELAMENTO_DIAS: int = 30

    # Planos (valores mensais em BRL). Essencial = upload manual; Completo =
    # Open Finance + marca própria. valor_por_extra é cobrado por cliente
    # acima da cota base (4 inclusos).
    PLANO_ESSENCIAL_VALOR_BASE: float = 149.00
    PLANO_ESSENCIAL_VALOR_EXTRA: float = 49.90
    PLANO_COMPLETO_VALOR_BASE: float = 199.00
    PLANO_COMPLETO_VALOR_EXTRA: float = 59.90


settings = Settings()
