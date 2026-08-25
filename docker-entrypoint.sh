#!/bin/sh
set -e

mkdir -p /app/data

if [ ! -f /app/data/flexipack.db ]; then
  echo "Initializing SQLite database in /app/data ..."
fi

if [ -f /opt/prisma-cli/node_modules/prisma/build/index.js ]; then
  node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma
else
  echo "Prisma CLI fehlt im Image — migrate deploy übersprungen." >&2
fi

exec "$@"
