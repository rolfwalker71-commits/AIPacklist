# FlexiPack

Progressive Web App & Desktop Packlisten-App für Multi-Etappen-Reisen, Paare und Gruppen.

## Features

- **3 Eingabe-Modi**: Visual Multi-Leg Wizard, KI/Vibe Natural-Language Input, modulare Templates
- **Calculator Engine**: Wasch-Streaks, Atlantik-/Herbst-Logik, Gala-Mengen
- **Realtime Multi-User**: Shared Items per SSE, Rollen Owner/Partner
- **Cross-Packing**: Items auf Koffer verteilen
- **Suche & Sortierung**: Reisen nach Titel, Code oder Person filtern, nach
  Datum / Fortschritt / Name sortieren
- **Tipps-Übersicht** (`/tipps`): alle KI-Tipps und Guides über sämtliche Reisen
- **Liquid Glass UI**: iPhone und iPad, hell und dunkel — siehe unten
- **PWA**: Offline-fähiger Service Worker + Installable Manifest
- **Docker**: Single-Container Image für GHCR, SQLite auf Volume `/app/data`

## Design — Liquid Glass

Das UI folgt Apples Liquid-Glass-Sprache: durchscheinende Ebenen, die den
Hintergrund brechen, statt flacher Karten.

**Tokens** liegen in `src/app/globals.css`. Jeder Wert hat einen Dark-Zwilling
im `prefers-color-scheme: dark`-Block — es gibt keinen Theme-Schalter, die App
folgt dem System.

| Gruppe | Tokens |
| --- | --- |
| Material | `--glass-ultrathin` · `--glass-thin` · `--glass-regular` · `--glass-thick` |
| Kante & Licht | `--rim-top` · `--rim-bottom` · `--edge` · `--edge-strong` · `--sheen` |
| Tiefe | `--lift-1` · `--lift-2` · `--lift-3` |
| Tönung | `--tint-amber` · `--tint-teal` · `--tint-rose` |
| Radien | `--r-sm` 12 · `--r-md` 16 · `--r-lg` 22 · `--r-xl` 30 (konzentrisch) |

**Verwendung.** Die Klasse `.glass` ist die einzige Flächen-Primitive; alles
andere sind Modifier (`.glass-thin`, `.glass-thick`, `.glass-float`,
`.tint-teal`, …). In React gibt es dieselbe Fläche typisiert als
`<Glass>` / `glassClass()` in `src/components/ui/glass.tsx`.

`.ambient-canvas` im Root-Layout ist der Farbverlauf, den das Glas bricht — ohne
ihn wirkt jede durchscheinende Fläche tot. Deshalb ist `<body>` transparent und
nur `<html>` färbt den Untergrund.

**Verschachtelung.** Glas auf Glas heisst: aussen dicker, innen dünner. Eine
Kategorie-Karte ist `.glass`, ihre Zeilen sind `.glass-thin` mit dem nächst
kleineren Radius.

**Fallbacks** sind eingebaut und nicht optional: `prefers-reduced-transparency`,
fehlendes `backdrop-filter` und `prefers-reduced-motion` schalten auf deckende
Flächen bzw. ohne Animation. Der Druck-Preview (`/trip/<id>/print`) nutzt
`.paper` und bleibt im Dark Mode hell — was du siehst, kommt so aus dem Drucker.

### Layout

| Breite | Navigation |
| --- | --- |
| `< 736px` (iPhone) | schwebende Glas-Tableiste unten, Inhalt scrollt darunter |
| `≥ 736px` (`pad:`, iPad ab Hochformat) | Glas-Seitenleiste links, 17rem |

Der `pad:`-Breakpoint liegt bei 46rem statt Tailwinds `lg`, weil iPads im
Hochformat nur 744–834pt breit sind und sonst auf dem Telefon-Layout landen
würden.

Auf Trip-Seiten bringt `TripWorkspace` seine eigene Seitenleiste mit (Bereiche,
Personen, Fortschritt); `AppBottomNav` rendert dort nichts.

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
