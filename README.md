# 🇫🇮 Finland Rail Tracker

A one-page React + Leaflet application that visualises all current **and historic** rail, tram and metro tracks in Finland and shows **live-moving trains** with details from the [Digitraffic](https://rata.digitraffic.fi/) public API.

![Screenshot](docs/screenshot.png)

## Features

* Highlighted rail, tram and metro lines from OpenStreetMap (via Overpass API).
* Real-time train positions refreshed every 10 s.
* Hover tooltip with **origin → destination** and **speed**.
* Clickable train markers open movable, live-updating pop-ups.
* Pop-ups stack neatly and can be closed with “×”.
* Click any rail segment to see previous/next trains on that section (placeholder).
* API-call throttling & caching to respect Digitraffic rate limits.

## Tech Stack

| Layer | Library |
|-------|---------|
| UI    | React 18 + Vite |
| Map   | Leaflet + react-leaflet |
| Data  | Overpass API (OSM), Digitraffic API |
| Utils | axios, osmtogeojson |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev
# then open http://localhost:5173 in your browser
```

The Digitraffic and Overpass APIs are public — no keys needed.

## Build for production

```bash
npm run build  # bundles to dist/
```

## Project Structure

```
railFinland/
├─ public/         # static assets
├─ src/
│  ├─ App.jsx      # main component
│  ├─ main.jsx     # React entry point
│  └─ util/
│     └─ throttleQueue.js  # request-limit helper
├─ index.html
└─ vite.config.js
```

## Deployment

The app is a static bundle (HTML, JS, CSS).  You can host `dist/` on any static host (Netlify, GitHub Pages, Vercel, AWS S3, etc.).

```bash
npm run build
# deploy contents of dist/
```

## Contributing

Issues and PRs are welcome!  Please open an issue first to discuss major changes.

## License

MIT
