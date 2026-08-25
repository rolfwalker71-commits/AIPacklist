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

`docker-compose.yml` startet den Single-Container mit SQLite. Das Image kommt von GHCR; lokal bauen geht über die zweite Compose-Datei.

Lokal bauen und starten:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build
docker compose up -d
```

Remote / Produktion (nur Image, kein `--build`):

```bash
docker compose pull && docker compose up -d
```

App dann unter [http://localhost:3330](http://localhost:3330).

Persistente DB: Volume `flexipack-data` → `/app/data/flexipack.db`

Image (nach CI Push):

```bash
docker pull ghcr.io/rolfwalker71-commits/aipacklist:latest
docker run -p 3330:3330 -v flexipack-data:/app/data ghcr.io/rolfwalker71-commits/aipacklist:latest
```

## AI (OpenAI)

Key hinterlegen unter [http://localhost:3330/settings](http://localhost:3330/settings)
oder als Env:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

In Docker: Env in `docker-compose.yml` / `.env`, oder Key in der Settings-UI (landet in Volume `/app/data/ai-settings.json`).

### Web Push (VAPID)

In der Host-`.env` (neben `docker-compose.yml`):

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:du@example.com
```

Keys erzeugen: `npx web-push generate-vapid-keys`. Danach Container neu starten:

```bash
docker compose up -d
```

Compose reicht `VAPID_*` in den Container durch. Ohne Keys zeigt der Team-Tab «Push ist nicht konfiguriert». Push braucht HTTPS (oder localhost); iOS: App zum Home-Bildschirm.

AI-Features:
- **Vibe Input** → Etappen-Parse per GPT (Fallback: Regelparser)
- **Liste mit AI verfeinern** auf der Trip-Seite
- Reise-Tipps

## Tech

- Next.js App Router · Tailwind CSS · Lucide
- Prisma + SQLite
- GitHub Actions → GHCR (`.github/workflows/docker.yml`)
