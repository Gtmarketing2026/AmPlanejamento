from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    analytics,
    assinatura,
    auth,
    categorias,
    clientes,
    crm,
    faturas,
    importacoes,
    marca,
    negocio,
    webhooks,
)
from app.core.config import settings

app = FastAPI(title="Fluxo API", version="0.1.0")

_origins_liberadas = ["http://localhost:5173"]
if settings.FRONTEND_URL:
    _origins_liberadas.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins_liberadas,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(marca.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
