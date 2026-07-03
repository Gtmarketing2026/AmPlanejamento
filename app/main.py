from fastapi import FastAPI

from app.api.routes import auth, clientes, faturas, webhooks

app = FastAPI(title="Fluxo API", version="0.1.0")

app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(faturas.router)
app.include_router(webhooks.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
