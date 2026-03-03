# 🌤️ WeatherOS

A live weather Progressive Web App (PWA) with human advice, adaptive themes, particle effects, and smart insights.

## Features

- 🌡️ **Live weather** via OpenWeatherMap API
- 📍 **Auto-location** detection
- ⚡ **Adaptive visuals** — rain particles, snow, lightning flashes, heat shimmer, drifting clouds
- 🧠 **Human Advice Engine** — plain English advice based on conditions
- 👔 **Outfit suggester**, 🚗 **Commute advisor**, 🌿 **Pollen levels**, 💨 **Air Quality Index**
- ⏰ **Best time to go outside** — hourly scoring chart
- 📅 **Hourly + 5-day forecast**
- 🌅 **Live sun arc** showing sunrise/sunset position
- 🏆 **Weather Score** — 0–100 rating for how good the day is
- 📲 **PWA** — installable on phone and desktop, works offline
- 🖥️ **Responsive** — mobile single card, desktop 3-panel layout

## Setup

1. Get a free API key at [openweathermap.org](https://openweathermap.org/api)
2. Open `index.html` in your browser
3. Paste your API key when prompted — it's saved locally, never committed

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo
2. Go to **Settings → Pages → Source → main branch / root**
3. Your app will be live at `https://yourusername.github.io/repo-name`

> **Note:** PWA install prompt and service worker require HTTPS — GitHub Pages provides this automatically.

## File Structure

```
WeatherOS/
├── index.html      # Main app (all HTML, CSS, JS)
├── manifest.json   # PWA manifest
├── sw.js           # Service worker (offline support)
├── icon-192.png    # App icon (small)
├── icon-512.png    # App icon (large)
└── README.md
```

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript — no frameworks
- OpenWeatherMap API (free tier)
- FontAwesome icons
- Syne + DM Mono fonts
