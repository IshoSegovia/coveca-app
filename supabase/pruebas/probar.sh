#!/usr/bin/env bash
# Crea una base PostgreSQL local desechable, aplica simulación de Supabase + migraciones
# y ejecuta los archivos SQL extra que se pasen como argumentos.
# Uso: bash supabase/pruebas/probar.sh [archivo.sql ...]
set -e
S=/var/tmp/pgtest-coveca
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
if [ ! -d "$S/data" ]; then mkdir -p $S; chown postgres $S; su postgres -c "$BIN/initdb -D $S/data -A trust -U postgres >/dev/null"; fi
su postgres -c "$BIN/pg_ctl -D $S/data status >/dev/null 2>&1 || $BIN/pg_ctl -D $S/data -o '-p 5499 -k $S' -l $S/log start >/dev/null"
sleep 1
P="psql -h $S -p 5499 -U postgres -q -v ON_ERROR_STOP=1"
$P -c "drop database if exists t" -c "create database t"
$P -d t -f "$(dirname "$0")/simular_supabase.sql"
for f in "$(dirname "$0")"/../migrations/*.sql; do
  case "$(basename "$f")" in 0003_*) continue;; esac   # 0003 depende de usuarios reales
  $P -d t -f "$f"
done
echo "migraciones OK"
for extra in "$@"; do echo "== $extra"; $P -d t -f "$extra"; done
