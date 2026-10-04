# Ambient screensaver

Ambient is a static Spotify-focused screensaver for an Android device or
desktop display. It presents a large square album artwork surface beside
Spotify playback controls, track progress, and device status over an
interstellar canvas.

Open the settings button in the top-right corner to toggle widgets. Click the
clock to create a countdown event with a name and date/time. The countdown date
is stored in `localStorage` so it survives a refresh. The media card is a presentation
control surface; connecting it to a Spotify account requires an authenticated
Spotify integration. This site now uses Spotify Authorization Code with PKCE,
so the client secret must never be placed in `config.js` or frontend code.

## Deploy the screensaver to Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render will use [`render.yaml`](./render.yaml) to publish the static site.
4. Copy [`config.example.js`](./config.example.js) to `config.js` locally,
   replace the placeholders, and deploy the resulting configuration through
   the Render static-site files or a private deployment workflow.

The browser must receive `config.js`, so values in that file are not secret.
Do not put private service passwords in it.

## Configure weather

The weather card uses OpenWeatherMap's current conditions and 5-day / 3-hour
forecast endpoint. Click the card for the detailed forecast and weather metrics.
Without a working weather key, the site uses a local snapshot so the
screensaver remains useful offline. Set the public browser key in `config.js`:

```js
window.APP_CONFIG = {
  openWeatherKey: "YOUR_OPENWEATHERMAP_KEY",
  spotifyClientId: "YOUR_SPOTIFY_CLIENT_ID",
  spotifyRedirectUri: "https://your-domain.example/"
};
```

The Spotify card includes connect/disconnect, current-track polling, play/pause,
previous, next, token refresh, and device display. Playback control requires an
active Spotify device and typically a Spotify Premium account. Add the exact
redirect URI to the Spotify Developer Dashboard. For GitHub Pages, use the
deployed site root exactly, including the trailing slash. Do not use the exposed client
secret from earlier setup; rotate it and leave it server-side if you later add a
backend.
