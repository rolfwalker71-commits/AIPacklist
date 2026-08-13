#!/bin/sh
set -e

mkdir -p /app/data

if [ ! -f /app/data/flexipack.db ]; then
  echo "Initializing SQLite database in /app/data ..."
fi

npx prisma migrate deploy

exec "$@"
