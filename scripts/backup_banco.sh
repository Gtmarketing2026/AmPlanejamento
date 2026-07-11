#!/usr/bin/env bash
# Backup do banco de produção (Supabase) -> arquivo .sql.gz com data.
# Redundância além do backup do Supabase Pro. NÃO contém credenciais: lê a
# string de conexão do .env (DATABASE_URL_ADMIN). Requer `pg_dump` instalado
# (PostgreSQL client) e `gzip`.
#
# Uso:   bash scripts/backup_banco.sh [pasta_destino]
# Ex.:   bash scripts/backup_banco.sh "/c/Users/andre/OneDrive/Backups-AMplanejador"
#
# Depois de rodar, o arquivo DEVE ficar guardado FORA deste computador
# (Google Drive/OneDrive) -- regra 3-2-1.
set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR_SCRIPT/../.env"
DESTINO="${1:-$DIR_SCRIPT/../backups}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: .env não encontrado em $ENV_FILE (copie do gerenciador de senhas)." >&2
  exit 1
fi

# Extrai só a linha DATABASE_URL_ADMIN do .env, sem imprimir o valor.
CONEXAO="$(grep -E '^DATABASE_URL_ADMIN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
if [ -z "${CONEXAO:-}" ]; then
  echo "ERRO: DATABASE_URL_ADMIN não está no .env." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERRO: pg_dump não instalado. Instale o PostgreSQL client." >&2
  exit 1
fi

mkdir -p "$DESTINO"
CARIMBO="$(date +%Y-%m-%d_%H%M)"
ARQUIVO="$DESTINO/backup_${CARIMBO}.sql.gz"

echo "Gerando backup em: $ARQUIVO"
pg_dump --no-owner --no-privileges "$CONEXAO" | gzip > "$ARQUIVO"

TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "OK: backup criado ($TAMANHO)."
echo ">>> AGORA copie este arquivo para fora do computador (Drive/OneDrive)."
