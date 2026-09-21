# Aurora screensaver

Aurora is a static ambient screensaver for an Android device. It displays the
clock, animated Vanta background, Weatherbit conditions for ZIP code 21704,
hourly forecasts, and optional Rocket League MMR data.

## Deploy the screensaver to Render

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render will use [`render.yaml`](./render.yaml) to publish the static site.
4. Copy [`config.example.js`](./config.example.js) to `config.js` locally,
   replace the placeholders, and deploy the resulting configuration through
   the Render static-site files or a private deployment workflow.

The browser must receive `config.js`, so values in that file are not secret.
Do not put private service passwords or Rocket League credentials in it.

## Deploy `mmr-api-v2`

The MMR service must run as a separate Render web service. Fork
[`mmr-api-v2`](https://github.com/Kalilamodow/mmr-api-v2), create a Render web
service from the fork, and use:

- Build command: `npm run build`
- Start command: `node dist/index.js`

Create `config.json` as a Render secret file. It must include the service
password and the Rocket League version configuration required by the upstream
project. Complete the service's bootstrap flow with an alternate Rocket League
account, then keep the generated `saved-credentials.json` in persistent
storage.

The upstream service currently has no CORS middleware. Before using it from the
static Aurora site, add an API middleware that allows requests from the exact
Render URL of the Aurora site (not `*`), then redeploy the API. Without this
change, browsers will block `/get-skills` even when the endpoint itself works.

After the API is reachable, set these values in `config.js`:

```js
window.APP_CONFIG = {
  weatherbitKey: "YOUR_WEATHERBIT_KEY",
  mmrApiUrl: "https://YOUR-MMR-SERVICE.onrender.com",
  mmrPlayerId: "Epic|YOUR_EPIC_ACCOUNT_ID|0"
};
```

The Aurora card requests playlist `11` (Ranked Doubles) on startup and every
60 seconds. The player ID must be the account ID, not the visible Epic name.
