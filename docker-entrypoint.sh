#!/bin/sh
set -e

mkdir -p /app/data

if [ ! -f /app/data/flexipack.db ]; then
  echo "Initializing SQLite database in /app/data ..."
fi

if [ -f ./node_modules/prisma/build/index.js ]; then
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "Prisma CLI fehlt im Image — migrate deploy übersprungen." >&2
fi

exec "$@"
