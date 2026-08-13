# YouneeK Stars

An AR star-naming app with sky exploration, daily hunts, and a global star map.

## Features

- **AR Sky View** — Pan the night sky with touch or device orientation
- **Name a Star** — Claim stars with symbolic ownership ($10 base / $20 premium)
- **Daily Hunts** — Complete sky challenges and earn points
- **Star Map** — Browse the celestial catalog with claimed stars highlighted
- **Profile** — Track your stars, hunt progress, and leaderboard rank

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
```

## Development

Run the API server and Vite dev server together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run server   # API on http://localhost:3001
npm run client   # Vite on http://localhost:5173
```

The Vite dev server proxies `/api` requests to the Express backend.

## Environment Variables

Optional — defaults work for local development:

```
VITE_API_URL=/api
PORT=3001
```

## Build

```bash
npm run build
npm run preview
```

For production, deploy the Express API (`server/index.js`) alongside the built static files from `dist/`.

## Data Storage

Star claims, purchases, and hunt completions are stored in `server/data.json`. Back up this file to preserve data across restarts.

## Disclaimer

Star naming in YouneeK Stars is symbolic only and is not recognized by the International Astronomical Union or any official astronomical body.
