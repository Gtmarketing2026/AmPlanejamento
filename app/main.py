import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    analytics,
    assinatura,
    auth,
    categorias,
    clientes,
    configuracoes,
    contas,
    crm,
    faturas,
    importacoes,
    marca,
    negocio,
    notificacoes,
    patrimonio,
    pluggy,
    webhooks,
)
from app.core.config import settings

# Monitoramento de erros (só liga se SENTRY_DSN estiver configurado nas env
# vars da Vercel). send_default_pii=False -> não manda dados pessoais/headers
# de auth; traces baixos pra não custar/vazar. Inicializado ANTES do app pra a
# integração FastAPI/ASGI envolver as rotas.
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        send_default_pii=False,
        traces_sample_rate=0.1,
    )

app = FastAPI(title="AMplanejador API", version="0.1.0")

_origins_liberadas = ["http://localhost:5173"]
if settings.FRONTEND_URL:
    _origins_liberadas.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins_liberadas,
    # Autenticação é via Bearer token (Authorization header), não cookie -- não
    # precisa de allow_credentials, e deixá-lo false é mais restritivo.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def cabecalhos_seguranca(request: Request, call_next):
    """Headers de segurança padrão em toda resposta da API."""
    resposta = await call_next(request)
    resposta.headers["X-Content-Type-Options"] = "nosniff"
    resposta.headers["X-Frame-Options"] = "DENY"
    resposta.headers["Referrer-Policy"] = "no-referrer"
    resposta.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    resposta.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return resposta

app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(faturas.router)
app.include_router(webhooks.router)
app.include_router(importacoes.router)
app.include_router(categorias.router)
app.include_router(negocio.router)
app.include_router(analytics.router)
app.include_router(assinatura.router)
app.include_router(crm.router)
app.include_router(crm.router_cliente)
app.include_router(marca.router)
app.include_router(patrimonio.router)
app.include_router(contas.router)
app.include_router(contas.router_profissional)
app.include_router(notificacoes.router)
app.include_router(notificacoes.router_cliente)
app.include_router(configuracoes.router)
app.include_router(pluggy.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
