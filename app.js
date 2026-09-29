const $ = (selector) => document.querySelector(selector);
const landscapeMode = window.matchMedia("(orientation: landscape)");
if (landscapeMode.matches) document.body.classList.add("landscape-ready");
landscapeMode.addEventListener("change", () => window.location.reload());
const config = window.APP_CONFIG || {};
const fallbackWeather = { temp: 72, feels: 72, condition: "Clear skies", icon: "☀", high: 75, low: 61 };
const spotifyScopes = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
let countdownTarget = localStorage.getItem("ambient-countdown") || "";
let countdownName = localStorage.getItem("ambient-countdown-name") || "YOUR EVENT";
let weatherData;
let spotifyPoll;
function storedSetting(name) { return localStorage.getItem(`ambient-${name}`) || config[name] || ""; }
function weatherKey() { return storedSetting("openWeatherKey"); }
function spotifyClientId() { return storedSetting("spotifyClientId"); }
function defaultSpotifyRedirectUri() { return new URL("./", window.location.href).href; }
function spotifyRedirectUri() {
  const saved = storedSetting("spotifyRedirectUri");
  return saved && (window.location.hostname === "localhost" || !saved.includes("localhost")) ? saved : defaultSpotifyRedirectUri();
}

function initCanvas() {
  const canvas = $("#ambient-canvas");
  const context = canvas.getContext("2d");
  const stars = Array.from({ length: 180 }, () => ({
    x: Math.random(), y: Math.random(), size: Math.random() * 2.2 + .3,
    speed: Math.random() * .00035 + .00008, phase: Math.random() * 6.28
  }));
  const orbs = Array.from({ length: 9 }, (_, index) => ({
    x: Math.random(), y: Math.random(), radius: 0.18 + Math.random() * 0.25,
    speed: (Math.random() * 0.00012 + 0.00005) * (index % 2 ? -1 : 1), phase: Math.random() * 6.28
  }));
  const shootingStars = Array.from({ length: 3 }, (_, index) => ({ offset: index * 9000, speed: .00025 + index * .00004 }));
  const resize = () => { canvas.width = window.innerWidth * devicePixelRatio; canvas.height = window.innerHeight * devicePixelRatio; };
  const draw = (time) => {
    const width = canvas.width, height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#060816"; context.fillRect(0, 0, width, height);
    stars.forEach((star) => {
      const x = ((star.x + time * star.speed) % 1) * width;
      const y = star.y * height;
      const opacity = .22 + (Math.sin(time * .002 + star.phase) + 1) * .28;
      context.fillStyle = `rgba(213,232,255,${opacity})`;
      context.beginPath(); context.arc(x, y, star.size * devicePixelRatio, 0, Math.PI * 2); context.fill();
    });
    orbs.forEach((orb, index) => {
      const x = (orb.x + Math.sin(time * orb.speed + orb.phase) * .12) * width;
      const y = (orb.y + Math.cos(time * orb.speed * .8 + orb.phase) * .12) * height;
      const radius = orb.radius * Math.min(width, height);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, index % 3 === 0 ? "rgba(87,126,255,.2)" : "rgba(180,76,230,.14)");
      gradient.addColorStop(1, "rgba(6,8,22,0)");
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    });
    shootingStars.forEach((star) => {
      const progress = ((time + star.offset) * star.speed % 1.35) - .15;
      const x = progress * width;
      const y = ((progress * .38 + star.offset / 12000) % 1) * height;
      const trail = context.createLinearGradient(x - 130, y - 48, x, y);
      trail.addColorStop(0, "rgba(170,215,255,0)");
      trail.addColorStop(1, "rgba(226,242,255,.75)");
      context.strokeStyle = trail; context.lineWidth = 2 * devicePixelRatio;
      context.beginPath(); context.moveTo(x - 130, y - 48); context.lineTo(x, y); context.stroke();
    });
    requestAnimationFrame(draw);
  };
  resize(); window.addEventListener("resize", resize); requestAnimationFrame(draw);
}

function updateClock() {
  const now = new Date();
  const hours = String(now.getHours() % 12 || 12).padStart(2, "0");
  $("#clock").innerHTML = `${hours}<span>:</span>${String(now.getMinutes()).padStart(2, "0")}<span>:</span>${String(now.getSeconds()).padStart(2, "0")}`;
  $("#date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  updateCountdown(now);
}

function updateCountdown(now = new Date()) {
  const box = $("#countdown");
  if (!countdownTarget) { box.hidden = true; return; }
  $("#countdown-name").textContent = countdownName;
  const difference = new Date(countdownTarget).getTime() - now.getTime();
  if (difference <= 0) { $("#countdown-value").textContent = "00d 00h 00m 00s"; box.hidden = false; return; }
  const seconds = Math.floor(difference / 1000);
  $("#countdown-value").textContent = `${String(Math.floor(seconds / 86400)).padStart(2, "0")}d ${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}h ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
  box.hidden = false;
}

function renderWeather(data = fallbackWeather) {
  $("#temperature").textContent = `${Math.round(data.temp)}°`;
  $("#condition").textContent = data.condition.replace(/^./, (letter) => letter.toUpperCase());
  $("#weather-summary").textContent = `${data.humidity ?? 52}% humidity · feels like ${Math.round(data.feels)}°`;
  $("#weather-icon").textContent = data.icon;
  $("#high-low").textContent = `H: ${Math.round(data.high)}° · L: ${Math.round(data.low)}°`;
}

async function loadWeather() {
  if (!weatherKey()) { renderWeather(); return; }
  $("#refresh-weather").textContent = "LOADING…";
  try {
    const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?zip=21704,US&units=imperial&appid=${weatherKey()}`);
    const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?zip=21704,US&units=imperial&appid=${weatherKey()}`);
    if (!currentResponse.ok || !forecastResponse.ok) throw new Error("OpenWeatherMap request failed");
    const current = await currentResponse.json();
    const forecast = await forecastResponse.json();
    weatherData = { current, forecast };
    const days = groupForecast(forecast.list);
    renderWeather({ temp: current.main.temp, feels: current.main.feels_like, humidity: current.main.humidity, condition: current.weather[0].description, icon: weatherIcon(current.weather[0].icon), high: days[0]?.high || current.main.temp, low: days[0]?.low || current.main.temp });
    $("#location").textContent = `${current.name} · ${current.sys.country}`;
  } catch (error) {
    console.error(error); renderWeather(); showToast("Weather data unavailable");
  } finally { $("#refresh-weather").textContent = "REFRESH ↻"; }
}

function weatherIcon(code = "") {
  if (code.startsWith("01")) return "☀";
  if (code.startsWith("02")) return "◒";
  if (code.startsWith("09") || code.startsWith("10")) return "☂";
  if (code.startsWith("11")) return "ϟ";
  if (code.startsWith("13")) return "❄";
  return "☁";
}

function groupForecast(list = []) {
  const grouped = new Map();
  list.forEach((item) => {
    const key = item.dt_txt.slice(0, 10);
    const day = grouped.get(key) || { date: new Date(item.dt * 1000), temps: [], icons: [], rain: 0 };
    day.temps.push(item.main.temp); day.icons.push(item.weather[0].icon); day.rain = Math.max(day.rain, Math.round((item.pop || 0) * 100)); grouped.set(key, day);
  });
  return [...grouped.values()].slice(0, 5).map((day) => ({ ...day, high: Math.max(...day.temps), low: Math.min(...day.temps), icon: weatherIcon(day.icons[Math.floor(day.icons.length / 2)]) }));
}

function renderWeatherDetails() {
  if (!weatherData) return;
  const { current, forecast } = weatherData;
  const days = groupForecast(forecast.list);
  $("#weather-dialog-title").textContent = `${current.name}, ${current.sys.country}`;
  $("#weather-updated").textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date())}`;
  $("#forecast-list").innerHTML = days.map((day) => `<div class="forecast-row"><span>${new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(day.date)}</span><span>${day.icon}</span><strong>${Math.round(day.high)}° / ${Math.round(day.low)}°</strong><small>${day.rain}% rain</small></div>`).join("");
  const wind = Math.round(current.wind.speed);
  $("#weather-facts").innerHTML = `<span>FEELS LIKE <b>${Math.round(current.main.feels_like)}°</b></span><span>HUMIDITY <b>${current.main.humidity}%</b></span><span>WIND <b>${wind} mph</b></span><span>PRESSURE <b>${current.main.pressure} hPa</b></span><span>VISIBILITY <b>${(current.visibility / 1609).toFixed(1)} mi</b></span><span>GUSTS <b>${Math.round(current.wind.gust || current.wind.speed)} mph</b></span>`;
}

function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2500); }
function base64Url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function startSpotifyLogin() {
  if (!spotifyClientId()) { showToast("Save your Spotify client ID first"); return; }
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem("spotify-code-verifier", verifier);
  sessionStorage.setItem("spotify-state", state);
  const params = new URLSearchParams({ client_id: spotifyClientId(), response_type: "code", redirect_uri: spotifyRedirectUri(), code_challenge_method: "S256", code_challenge: challenge, state, scope: spotifyScopes });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}
async function exchangeSpotifyCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return;
  if (params.get("state") !== sessionStorage.getItem("spotify-state")) throw new Error("Spotify authorization state mismatch");
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: spotifyClientId(), grant_type: "authorization_code", code, redirect_uri: spotifyRedirectUri(), code_verifier: sessionStorage.getItem("spotify-code-verifier") || "" }) });
  if (!response.ok) throw new Error(`Spotify token exchange failed: ${response.status}`);
  const token = await response.json();
  localStorage.setItem("spotify-access-token", token.access_token);
  localStorage.setItem("spotify-refresh-token", token.refresh_token || "");
  localStorage.setItem("spotify-expires-at", String(Date.now() + token.expires_in * 1000));
  sessionStorage.removeItem("spotify-code-verifier"); sessionStorage.removeItem("spotify-state");
  window.history.replaceState({}, document.title, window.location.pathname);
}
async function refreshSpotifyToken() {
  const refreshToken = localStorage.getItem("spotify-refresh-token");
  if (!refreshToken) return false;
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: spotifyClientId(), grant_type: "refresh_token", refresh_token: refreshToken }) });
  if (!response.ok) return false;
  const token = await response.json();
  localStorage.setItem("spotify-access-token", token.access_token);
  localStorage.setItem("spotify-expires-at", String(Date.now() + token.expires_in * 1000));
  return true;
}
async function spotifyRequest(path, options = {}, retry = true) {
  if (Number(localStorage.getItem("spotify-expires-at") || 0) < Date.now() + 60000 && !(await refreshSpotifyToken())) return null;
  const token = localStorage.getItem("spotify-access-token");
  if (!token) return null;
  const response = await fetch(`https://api.spotify.com/v1${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (response.status === 401 && retry && await refreshSpotifyToken()) return spotifyRequest(path, options, false);
  if (response.status === 204) return {};
  if (response.status === 403) throw new Error("Spotify playback requires an active Premium device");
  if (response.status === 404) throw new Error("Spotify has no active playback device");
  if (!response.ok) throw new Error(`Spotify request failed: ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  return response.json();
}
function formatTrackTime(milliseconds = 0) { const seconds = Math.floor(milliseconds / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
async function updateSpotifyCard() {
  let state;
  try {
    state = await spotifyRequest("/me/player");
  } catch (error) {
    $("#spotify-device").textContent = error.message.includes("active") ? "OPEN SPOTIFY TO PLAY" : "SPOTIFY UNAVAILABLE";
    return;
  }
  if (!state || !state.item) { $("#spotify-device").textContent = "OPEN SPOTIFY TO PLAY"; return; }
  const item = state.item;
  $("#track-title").textContent = item.name;
  $("#track-artist").textContent = `${item.artists.map((artist) => artist.name).join(", ")} · ${item.album.name}`;
  $("#elapsed").textContent = formatTrackTime(state.progress_ms);
  $(".track-time span:last-child").textContent = formatTrackTime(item.duration_ms);
  $("#progress-bar").style.width = `${Math.min(100, (state.progress_ms / item.duration_ms) * 100)}%`;
  $("#spotify-device").textContent = state.device?.name || "SPOTIFY CONNECTED";
  const cover = item.album?.images?.[0]?.url;
  if (cover) {
    $(".media-widget").style.setProperty("--album-cover", `url("${cover}")`);
    $(".album-art").style.backgroundImage = `url("${cover}")`;
    $(".album-art").textContent = "";
  }
  $("#play-track").textContent = state.is_playing ? "Ⅱ" : "▶";
  $("#play-track").setAttribute("aria-label", state.is_playing ? "Pause" : "Play");
}
async function spotifyAction(path, method = "PUT") {
  try { await spotifyRequest(path, { method }); await updateSpotifyCard(); } catch (error) { console.error(error); showToast(error.message); }
}
function setupSpotify() {
  const connected = Boolean(localStorage.getItem("spotify-access-token"));
  $("#spotify-connect").textContent = connected ? "DISCONNECT" : "CONNECT SPOTIFY";
  if (connected) {
    updateSpotifyCard().catch((error) => { console.error(error); $("#spotify-device").textContent = "SPOTIFY UNAVAILABLE"; });
    clearInterval(spotifyPoll);
    spotifyPoll = setInterval(updateSpotifyCard, 10000);
  }
}
function setSettings(open) { $("#settings-panel").classList.toggle("is-open", open); $("#settings-panel").setAttribute("aria-hidden", String(!open)); $("#settings-backdrop").hidden = !open; }

if (landscapeMode.matches) {
$("#settings-button").addEventListener("click", () => setSettings(true));
$("#api-settings").addEventListener("submit", (event) => {
  event.preventDefault();
  [["openWeatherKey", "#openweather-key"], ["spotifyClientId", "#spotify-client-id"], ["spotifyRedirectUri", "#spotify-redirect-uri"]].forEach(([name, selector]) => {
    const value = $(selector).value.trim();
    if (value) localStorage.setItem(`ambient-${name}`, value); else localStorage.removeItem(`ambient-${name}`);
  });
  loadWeather(); setupSpotify(); setSettings(false); showToast("Settings saved");
});
$("#clear-api-settings").addEventListener("click", () => {
  ["openWeatherKey", "spotifyClientId", "spotifyRedirectUri"].forEach((name) => localStorage.removeItem(`ambient-${name}`));
  $("#openweather-key").value = ""; $("#spotify-client-id").value = ""; $("#spotify-redirect-uri").value = "";
  loadWeather(); setupSpotify(); showToast("Saved settings cleared");
});
$("#settings-button").addEventListener("click", () => {
  $("#openweather-key").value = storedSetting("openWeatherKey");
  $("#spotify-client-id").value = storedSetting("spotifyClientId");
  $("#spotify-redirect-uri").value = spotifyRedirectUri();
});
$("#clock").addEventListener("click", () => { const form = $("#countdown-form"); form.hidden = !form.hidden; if (!form.hidden) { $("#countdown-title").value = countdownName === "YOUR EVENT" ? "" : countdownName; $("#countdown-title").focus(); } });
$("#close-settings").addEventListener("click", () => setSettings(false));
$("#settings-backdrop").addEventListener("click", () => setSettings(false));
document.querySelectorAll("[data-toggle]").forEach((input) => input.addEventListener("change", (event) => {
  $(`[data-widget="${event.target.dataset.toggle}"]`).hidden = !event.target.checked;
}));
$("#countdown-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const target = $("#countdown-date").value;
  if (!target || !$("#countdown-title").value.trim()) { showToast("Add an event name and time"); return; }
  countdownTarget = target; countdownName = $("#countdown-title").value.trim().toUpperCase() || "YOUR EVENT";
  localStorage.setItem("ambient-countdown", target); localStorage.setItem("ambient-countdown-name", countdownName); updateCountdown(); $("#countdown-form").hidden = true;
});
$("#clear-countdown").addEventListener("click", () => { countdownTarget = ""; countdownName = "YOUR EVENT"; localStorage.removeItem("ambient-countdown"); localStorage.removeItem("ambient-countdown-name"); $("#countdown").hidden = true; $("#countdown-form").hidden = true; });
$("#weather-card").addEventListener("click", (event) => { if (event.target.closest("#refresh-weather")) return; renderWeatherDetails(); $("#weather-dialog").showModal(); });
$("#weather-card").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); renderWeatherDetails(); $("#weather-dialog").showModal(); } });
$("#refresh-weather").addEventListener("click", (event) => { event.stopPropagation(); loadWeather(); });
$("#close-weather").addEventListener("click", () => $("#weather-dialog").close());
$("#fullscreen").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$("#spotify-connect").addEventListener("click", async () => {
  if (localStorage.getItem("spotify-access-token")) { localStorage.removeItem("spotify-access-token"); localStorage.removeItem("spotify-refresh-token"); localStorage.removeItem("spotify-expires-at"); clearInterval(spotifyPoll); setupSpotify(); return; }
  try { await startSpotifyLogin(); } catch (error) { console.error(error); showToast("Spotify login unavailable"); }
});
$("#play-track").addEventListener("click", () => spotifyAction($("#play-track").textContent === "Ⅱ" ? "/me/player/pause" : "/me/player/play"));
$("#next-track").addEventListener("click", () => spotifyAction("/me/player/next", "POST"));
$("#previous-track").addEventListener("click", () => spotifyAction("/me/player/previous", "POST"));

$("#countdown-form").hidden = true;
initCanvas(); updateClock(); loadWeather();
exchangeSpotifyCode().then(setupSpotify).catch((error) => { console.error(error); showToast("Spotify login failed"); });
setInterval(updateClock, 1000);
}
