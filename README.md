# FlexiPack

Progressive Web App & Desktop Packlisten-App für Multi-Etappen-Reisen, Paare und Gruppen.

## Features

- **3 Eingabe-Modi**: Visual Multi-Leg Wizard, KI/Vibe Natural-Language Input, modulare Templates
- **Calculator Engine**: Wasch-Streaks, Atlantik-/Herbst-Logik, Gala-Mengen
- **Realtime Multi-User**: Shared Items per SSE, Rollen Owner/Partner
- **Cross-Packing**: Items auf Koffer verteilen
- **PWA**: Offline-fähiger Service Worker + Installable Manifest
- **Docker**: Single-Container Image für GHCR, SQLite auf Volume `/app/data`

## Quickstart (lokal)

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

App: [http://localhost:3330](http://localhost:3330)

## Docker

Ja — `docker-compose.yml` im Projektroot ist die Datei zum Starten. Für einen Single-Container mit SQLite reicht das:

```bash
docker compose up --build
```

App dann unter [http://localhost:3330](http://localhost:3330).

Persistente DB: Volume `flexipack-data` → `/app/data/flexipack.db`

Image (nach CI Push):

```bash
docker pull ghcr.io/rolfwalker71-commits/aipacklist:latest
docker run -p 3330:3330 -v flexipack-data:/app/data ghcr.io/rolfwalker71-commits/aipacklist:latest
```

## Tech

- Next.js App Router · Tailwind CSS · Lucide
- Prisma + SQLite
- GitHub Actions → GHCR (`.github/workflows/docker.yml`)
