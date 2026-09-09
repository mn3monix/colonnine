const STORAGE_KEY = "meteoroute.googleKey";
const THRESH_KEY = "meteoroute.thresholds";

const WMO = {
  0: "Sereno",
  1: "Poco nuvoloso",
  2: "Parzialmente nuvoloso",
  3: "Coperto",
  45: "Nebbia",
  48: "Nebbia con brina",
  51: "Pioviggine debole",
  53: "Pioviggine",
  55: "Pioviggine intensa",
  56: "Pioviggine gelata",
  57: "Pioviggine gelata intensa",
  61: "Pioggia debole",
  63: "Pioggia",
  65: "Pioggia intensa",
  66: "Pioggia gelata",
  67: "Pioggia gelata intensa",
  71: "Neve debole",
  73: "Neve",
  75: "Neve intensa",
  77: "Grani di neve",
  80: "Rovesci deboli",
  81: "Rovesci",
  82: "Rovesci violenti",
  85: "Rovesci di neve",
  86: "Rovesci di neve intensi",
  95: "Temporale",
  96: "Temporale con grandine",
  99: "Temporale con grandine forte",
};

const state = {
  map: null,
  directionsService: null,
  places: null,
  traffic: null,
  autocompleteA: null,
  autocompleteB: null,
  renderers: [],
  markers: [],
  placeMarkers: [],
  routesData: [],
  selected: 0,
};

function $(id) {
  return document.getElementById(id);
}

function loadThresholds() {
  try {
    return JSON.parse(localStorage.getItem(THRESH_KEY)) || {};
  } catch {
    return {};
  }
}

function initSettings() {
  const saved = localStorage.getItem(STORAGE_KEY) || "";
  $("apiKey").value = saved;
  const t = loadThresholds();
  $("windWarn").value = t.windWarn ?? 50;
  $("windBad").value = t.windBad ?? 70;
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, $("apiKey").value.trim());
  localStorage.setItem(
    THRESH_KEY,
    JSON.stringify({
      windWarn: Number($("windWarn").value) || 50,
      windBad: Number($("windBad").value) || 70,
    })
  );
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = "status " + kind;
}

function loadMapsScript(key) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById("gmaps-script");
    if (existing) existing.remove();
    const s = document.createElement("script");
    s.id = "gmaps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places&language=it&region=IT`;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Impossibile caricare Google Maps. Controlla la chiave."));
    document.head.appendChild(s);
  });
}

async function bootMaps() {
  const key = $("apiKey").value.trim();
  if (!key) {
    setStatus("Inserisci la chiave Google Maps in Impostazioni.", "error");
    return false;
  }
  saveSettings();
  try {
    await loadMapsScript(key);
  } catch (e) {
    setStatus(e.message, "error");
    return false;
  }

  const italy = { lat: 41.9, lng: 12.5 };
  state.map = new google.maps.Map($("map"), {
    center: italy,
    zoom: 6,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1220" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
    ],
  });
  state.directionsService = new google.maps.DirectionsService();
  state.places = new google.maps.places.PlacesService(state.map);
  state.traffic = new google.maps.TrafficLayer();
  if ($("trafficOn").checked) state.traffic.setMap(state.map);

  const opts = { fields: ["formatted_address", "geometry", "name"] };
  state.autocompleteA = new google.maps.places.Autocomplete($("origin"), opts);
  state.autocompleteB = new google.maps.places.Autocomplete($("dest"), opts);
  setStatus("Mappe pronte. Inserisci partenza e destinazione.");
  return true;
}

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat() - a.lat()) * Math.PI) / 180;
  const dLng = ((b.lng() - a.lng()) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat() * Math.PI) / 180) *
      Math.cos((b.lat() * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function samplePath(path, targetPoints = 9) {
  if (!path || path.length === 0) return [];
  const dists = [0];
  for (let i = 1; i < path.length; i++) {
    dists.push(dists[i - 1] + haversine(path[i - 1], path[i]));
  }
  const total = dists[dists.length - 1] || 1;
  const n = Math.max(4, Math.min(targetPoints, path.length));
  const samples = [];
  for (let i = 0; i < n; i++) {
    const want = (total * i) / (n - 1);
    let idx = dists.findIndex((d) => d >= want);
    if (idx < 0) idx = path.length - 1;
    samples.push({
      lat: path[idx].lat(),
      lng: path[idx].lng(),
      km: dists[idx],
      frac: dists[idx] / total,
    });
  }
  return { samples, totalKm: total };
}

function departureDate() {
  const v = $("depart").value;
  if (v) return new Date(v);
  return new Date();
}

function riskLevel(wx, th) {
  const code = wx.weather_code;
  const gust = wx.wind_gusts_10m ?? 0;
  const rain = wx.precipitation ?? 0;
  let level = "ok";
  const flags = [];
  if (code === 96 || code === 99) {
    level = "bad";
    flags.push("grandine");
  } else if (code === 95) {
    level = "bad";
    flags.push("temporale");
  }
  if (gust >= th.windBad) {
    level = "bad";
    flags.push(`raffiche ${Math.round(gust)} km/h`);
  } else if (gust >= th.windWarn) {
    if (level === "ok") level = "warn";
    flags.push(`vento ${Math.round(gust)} km/h`);
  }
  if (rain >= 8) {
    level = "bad";
    flags.push(`pioggia ${rain.toFixed(1)} mm`);
  } else if (rain >= 3) {
    if (level === "ok") level = "warn";
    flags.push(`pioggia ${rain.toFixed(1)} mm`);
  }
  if ((wx.precipitation_probability || 0) >= 70 && level === "ok") {
    level = "warn";
    flags.push(`prob. pioggia ${wx.precipitation_probability}%`);
  }
  return { level, flags };
}

function worstLevel(levels) {
  if (levels.includes("bad")) return "bad";
  if (levels.includes("warn")) return "warn";
  return "ok";
}

function pickHourly(forecast, when) {
  const times = forecast.hourly.time;
  const target = when.getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    const d = Math.abs(t - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return {
    time: times[best],
    temperature_2m: forecast.hourly.temperature_2m[best],
    precipitation: forecast.hourly.precipitation[best],
    precipitation_probability: forecast.hourly.precipitation_probability[best],
    weather_code: forecast.hourly.weather_code[best],
    wind_speed_10m: forecast.hourly.wind_speed_10m[best],
    wind_gusts_10m: forecast.hourly.wind_gusts_10m[best],
  };
}

async function fetchWeatherBatch(points) {
  const lats = points.map((p) => p.lat.toFixed(4)).join(",");
  const lngs = points.map((p) => p.lng.toFixed(4)).join(",");
  const url =
    "https://api.open-meteo.com/v1/forecast?" +
    `latitude=${lats}&longitude=${lngs}` +
    "&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m" +
    "&forecast_days=3&timezone=auto&wind_speed_unit=kmh";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Errore Open-Meteo (" + res.status + ")");
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

function formatClock(d) {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function clearOverlays() {
  state.renderers.forEach((r) => r.setMap(null));
  state.renderers = [];
  state.markers.forEach((m) => m.setMap(null));
  state.markers = [];
  state.placeMarkers.forEach((m) => m.setMap(null));
  state.placeMarkers = [];
}

function colorFor(level) {
  if (level === "bad") return "#fb7185";
  if (level === "warn") return "#fbbf24";
  return "#34d399";
}

function drawColoredPath(path, samplesWithRisk) {
  if (!path.length) return;
  const bounds = new google.maps.LatLngBounds();
  path.forEach((p) => bounds.extend(p));

  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
  }
  const total = cum[cum.length - 1] || 1;

  const base = new google.maps.Polyline({
    path,
    strokeColor: "#64748b",
    strokeOpacity: 0.35,
    strokeWeight: 10,
    map: state.map,
    zIndex: 2,
  });
  state.renderers.push(base);

  if (samplesWithRisk.length < 2) {
    const line = new google.maps.Polyline({
      path,
      strokeColor: colorFor(samplesWithRisk[0]?.risk.level || "ok"),
      strokeOpacity: 0.95,
      strokeWeight: 6,
      map: state.map,
      zIndex: 4,
    });
    state.renderers.push(line);
    return bounds;
  }

  for (let i = 0; i < samplesWithRisk.length - 1; i++) {
    const a = samplesWithRisk[i];
    const b = samplesWithRisk[i + 1];
    const fromKm = a.km ?? a.frac * total;
    const toKm = b.km ?? b.frac * total;
    const slice = [];
    for (let j = 0; j < path.length; j++) {
      if (cum[j] >= fromKm - 0.05 && cum[j] <= toKm + 0.05) slice.push(path[j]);
    }
    if (slice.length < 2) {
      slice.length = 0;
      slice.push({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    }
    const line = new google.maps.Polyline({
      path: slice,
      strokeColor: colorFor(worstLevel([a.risk.level, b.risk.level])),
      strokeOpacity: 0.95,
      strokeWeight: 6,
      map: state.map,
      zIndex: 4,
    });
    state.renderers.push(line);
  }
  return bounds;
}

function nearbyPlaces(location) {
  return new Promise((resolve) => {
    if (!state.places) return resolve([]);
    const types = ["gas_station", "restaurant", "parking"];
    const out = [];
    let pending = types.length;
    types.forEach((type) => {
      state.places.nearbySearch(
        { location, radius: 2500, type },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            results.slice(0, 3).forEach((r) => {
              out.push({
                name: r.name,
                type,
                rating: r.rating,
                vicinity: r.vicinity,
                loc: r.geometry?.location,
              });
            });
          }
          pending -= 1;
          if (pending === 0) resolve(out.slice(0, 8));
        }
      );
    });
  });
}

function typeLabel(t) {
  if (t === "gas_station") return "Distributore";
  if (t === "restaurant") return "Ristorante";
  if (t === "parking") return "Parcheggio";
  return t;
}

function renderCards(list) {
  const box = $("results");
  box.innerHTML = "";
  list.forEach((r, i) => {
    const card = document.createElement("article");
    card.className = "route-card" + (i === state.selected ? " active" : "");
    const badgeClass = r.overall === "bad" ? "bad" : r.overall === "warn" ? "warn" : "ok";
    const badgeText =
      r.overall === "bad" ? "Sconsigliato" : r.overall === "warn" ? "Attenzione" : "Meteo ok";
    const chips = [...new Set(r.samples.flatMap((s) => s.risk.flags))]
      .slice(0, 6)
      .map((f) => {
        const bad = /grandine|temporale|raffiche|pioggia [5-9]|pioggia 1/.test(f);
        return `<span class="chip ${bad ? "bad" : "warn"}">${f}</span>`;
      })
      .join("");
    const segs = r.samples
      .map((s) => `<div class="seg ${s.risk.level}" title="${WMO[s.wx.weather_code] || ""}"></div>`)
      .join("");
    const wx = r.samples
      .map((s) => {
        const when = formatClock(s.when);
        const label = WMO[s.wx.weather_code] || `Codice ${s.wx.weather_code}`;
        return `<div class="wx-item"><span>${when}</span><span><b>${label}</b> · ${Math.round(
          s.wx.temperature_2m
        )}°</span><span>${Math.round(s.wx.wind_gusts_10m)} km/h</span></div>`;
      })
      .join("");
    const places = (r.places || [])
      .map(
        (p) =>
          `<div class="place"><b>${p.name}</b> · ${typeLabel(p.type)} <span>${
            p.rating ? "★ " + p.rating : ""
          } ${p.vicinity || ""}</span></div>`
      )
      .join("");
    card.innerHTML = `
      <div class="route-top">
        <div>
          <div class="route-title">Opzione ${i + 1}${r.summary ? " · " + r.summary : ""}</div>
          <div class="meta">${r.distanceText} · ${r.durationText}${
      r.trafficText ? " (con traffico " + r.trafficText + ")" : ""
    }</div>
        </div>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="alerts">${chips || '<span class="chip">Nessun allarme meteo rilevato</span>'}</div>
      <div class="timeline">${segs}</div>
      <div class="wx-list">${wx}</div>
      ${places ? `<div class="places"><h3>Luoghi vicino all’arrivo</h3>${places}</div>` : ""}
    `;
    card.addEventListener("click", () => {
      state.selected = i;
      highlightRoute(i);
      renderCards(list);
    });
    box.appendChild(card);
  });
}

function highlightRoute(index) {
  clearOverlays();
  const r = state.routesData[index];
  if (!r) return;
  const bounds = drawColoredPath(r.path, r.samples);
  r.samples.forEach((s, idx) => {
    const marker = new google.maps.Marker({
      position: { lat: s.lat, lng: s.lng },
      map: state.map,
      label: { text: String(idx + 1), color: "#0b1220", fontWeight: "700" },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: colorFor(s.risk.level),
        fillOpacity: 1,
        strokeColor: "#0b1220",
        strokeWeight: 2,
      },
    });
    state.markers.push(marker);
  });
  (r.places || []).forEach((p) => {
    if (!p.loc) return;
    const m = new google.maps.Marker({
      position: p.loc,
      map: state.map,
      title: p.name,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 4,
        fillColor: "#38bdf8",
        fillOpacity: 1,
        strokeWeight: 0,
      },
    });
    state.placeMarkers.push(m);
  });
  if (bounds) state.map.fitBounds(bounds, 48);
}

async function calculate() {
  if (!state.map) {
    const ok = await bootMaps();
    if (!ok) return;
  }
  const origin = $("origin").value.trim();
  const dest = $("dest").value.trim();
  if (!origin || !dest) {
    setStatus("Compila partenza e destinazione.", "error");
    return;
  }

  $("go").disabled = true;
  setStatus("Calcolo percorsi e traffico…");
  clearOverlays();
  $("results").innerHTML = "";

  const request = {
    origin,
    destination: dest,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true,
    unitSystem: google.maps.UnitSystem.METRIC,
    drivingOptions: {
      departureTime: departureDate(),
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    },
    avoidHighways: $("avoidHw").checked,
    avoidTolls: $("avoidTolls").checked,
  };

  let result;
  try {
    result = await state.directionsService.route(request);
  } catch (e) {
    setStatus("Percorso non trovato: " + (e.message || e), "error");
    $("go").disabled = false;
    return;
  }

  const th = {
    windWarn: Number($("windWarn").value) || 50,
    windBad: Number($("windBad").value) || 70,
  };
  saveSettings();

  const routes = result.routes.slice(0, 3);
  const prepared = [];
  const allPoints = [];

  routes.forEach((route) => {
    const leg = route.legs[0];
    const durationSec = (leg.duration_in_traffic || leg.duration).value;
    const sampled = samplePath(route.overview_path, 8);
    const start = departureDate();
    const samples = sampled.samples.map((s) => ({
      ...s,
      when: new Date(start.getTime() + s.frac * durationSec * 1000),
    }));
    samples.forEach((s) => allPoints.push(s));
    prepared.push({
      route,
      path: route.overview_path,
      summary: route.summary,
      distanceText: leg.distance.text,
      durationText: formatDuration(leg.duration.value),
      trafficText: leg.duration_in_traffic ? formatDuration(leg.duration_in_traffic.value) : "",
      durationSec,
      samples,
    });
  });

  setStatus("Scarico il meteo lungo i tracciati…");
  let forecasts;
  try {
    forecasts = await fetchWeatherBatch(allPoints);
  } catch (e) {
    setStatus(e.message + " — mostro comunque i percorsi senza meteo.", "error");
    forecasts = allPoints.map(() => null);
  }

  let cursor = 0;
  for (const item of prepared) {
    item.samples = item.samples.map((s) => {
      const fc = forecasts[cursor++];
      const wx = fc
        ? pickHourly(fc, s.when)
        : {
            weather_code: 0,
            temperature_2m: null,
            precipitation: 0,
            precipitation_probability: 0,
            wind_speed_10m: 0,
            wind_gusts_10m: 0,
          };
      return { ...s, wx, risk: riskLevel(wx, th) };
    });
    item.overall = worstLevel(item.samples.map((s) => s.risk.level));
  }

  const destLoc = routes[0].legs[0].end_location;
  const places = await nearbyPlaces(destLoc);
  prepared.forEach((p) => {
    p.places = places;
  });

  state.routesData = prepared;
  const ranked = prepared.map((p, i) => ({ i, score: p.overall === "ok" ? 0 : p.overall === "warn" ? 1 : 2, dur: p.durationSec }));
  ranked.sort((a, b) => a.score - b.score || a.dur - b.dur);
  state.selected = ranked[0].i;

  if ($("trafficOn").checked) state.traffic.setMap(state.map);
  else state.traffic.setMap(null);

  renderCards(prepared);
  highlightRoute(state.selected);
  const best = prepared[state.selected];
  setStatus(
    `Trovati ${prepared.length} itinerari. Consigliato: opzione ${state.selected + 1} (${
      best.overall === "ok" ? "meteo favorevole" : best.overall === "warn" ? "qualche rischio" : "rischio meteo alto"
    }).`,
    best.overall === "bad" ? "error" : "ok"
  );
  $("go").disabled = false;
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocalizzazione non disponibile.", "error");
    return;
  }
  setStatus("Rilevo la posizione…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latlng = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      $("origin").value = latlng;
      if (state.map) {
        state.map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        state.map.setZoom(12);
      }
      setStatus("Posizione impostata come partenza.");
    },
    () => setStatus("Permesso posizione negato.", "error"),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function swapEnds() {
  const a = $("origin").value;
  $("origin").value = $("dest").value;
  $("dest").value = a;
}

window.addEventListener("DOMContentLoaded", () => {
  initSettings();
  $("go").addEventListener("click", calculate);
  $("locate").addEventListener("click", useMyLocation);
  $("swap").addEventListener("click", swapEnds);
  $("saveKey").addEventListener("click", async () => {
    saveSettings();
    await bootMaps();
  });
  $("trafficOn").addEventListener("change", () => {
    if (!state.traffic) return;
    state.traffic.setMap($("trafficOn").checked ? state.map : null);
  });
  if ($("apiKey").value.trim()) bootMaps();
  else setStatus("Apri Impostazioni e inserisci la chiave Google Maps.");
});
