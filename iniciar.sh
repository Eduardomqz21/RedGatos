#!/usr/bin/env bash
# Script para iniciar PetMap en Linux
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=================================================="
echo "          INICIANDO PETMAP / REDGATOS             "
echo "=================================================="

if [ ! -f .env ]; then
  echo "⚠️  ADVERTENCIA: Archivo .env no encontrado."
  echo "   Copia '.env ejemplo' a '.env' y configura tus variables."
fi

exec node app.js
