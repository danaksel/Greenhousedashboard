export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      if (url.pathname === "/admin/cleanup-kv-history" && request.method === "POST") {
        return await handleCleanupKvHistory(request, env, corsHeaders);
      }

      if (url.pathname === "/ingest" && request.method === "POST") {
        return await handleIngest(request, env, corsHeaders);
      }

      if (url.pathname === "/api/latest" && request.method === "GET") {
        const latest = await getLatest(env);
        const stats24h = await getStats24h(env);
        return jsonResponse({ ok: true, data: { ...latest, stats24h } }, 200, corsHeaders);
      }

      if (url.pathname === "/api/history" && request.method === "GET") {
        const history = await getHistory(env);
        return jsonResponse({ ok: true, data: history }, 200, corsHeaders);
      }

      if (url.pathname === "/api/fan/on" && request.method === "POST") {
        return await handleFanCommand(env, "on", corsHeaders);
      }

      if (url.pathname === "/api/fan/off" && request.method === "POST") {
        return await handleFanCommand(env, "off", corsHeaders);
      }

      if (url.pathname === "/api/widget" && request.method === "GET") {
        const latest = await getLatest(env);
        return widgetResponse(buildWidgetRows(latest), corsHeaders);
      }

      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) {
        return jsonResponse({ ok: false, error: "Not found" }, 404, corsHeaders);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return jsonResponse({ ok: false, error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: "Internal server error",
          details: error.message,
        },
        500,
        corsHeaders
      );
    }
  },
};

async function handleCleanupKvHistory(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.INGEST_TOKEN}`;

  if (authHeader !== expected) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const prefixes = ["history_15m:", "history_raw:"];
  const result = {};

  for (const prefix of prefixes) {
    let cursor = undefined;
    let deleted = 0;

    do {
      const page = await env.GREENHOUSE_DATA.list({
        prefix,
        cursor,
        limit: 1000,
      });

      for (const key of page.keys) {
        await env.GREENHOUSE_DATA.delete(key.name);
        deleted++;
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    result[prefix] = deleted;
  }

  return jsonResponse(
    {
      ok: true,
      deleted: result,
    },
    200,
    corsHeaders
  );
}

async function handleIngest(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.INGEST_TOKEN}`;

  if (authHeader !== expected) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return jsonResponse(
      { ok: false, error: "Content-Type must be application/json" },
      400,
      corsHeaders
    );
  }

  const body = await request.json();

  const sensorRaw = String(body.sensor || "").trim().toLowerCase();
  const sensor = normalizeSensor(sensorRaw);
  const value = parseSensorValue(sensor, body.value);

  if (!sensor) {
    return jsonResponse(
      {
        ok: false,
        error: "Unknown sensor. Supported values: temperature, humidity, door, fan, heating, window",
        received: sensorRaw,
      },
      400,
      corsHeaders
    );
  }

  if (value === null) {
    return jsonResponse(
      {
        ok: false,
        error:
          sensor === "door"
            ? 'value must be a door status like "Ja"/"Nei", "open"/"closed", true/false, or 1/0'
            : sensor === "fan" || sensor === "heating"
              ? 'value must be an on/off status like "Ja"/"Nei", "on"/"off", true/false, or 1/0'
              : sensor === "window"
                ? 'value must be a number from 0 to 3'
                : "value must be a number",
      },
      400,
      corsHeaders
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // 1) latest
  const latestEntry = {
    sensor,
    value,
    timestamp: nowIso,
  };

  await env.GREENHOUSE_DATA.put(`latest:${sensor}`, JSON.stringify(latestEntry));

  // 2) 15-minute bucket history for 24h graph
  // Only temperature and humidity need historical graph data.
  // All other sensors are kept as latest:* in KV only.
  if (shouldStoreHistory(sensor)) {
    const bucketStart = roundDownTo15Minutes(now);
    const bucketIso = bucketStart.toISOString();

    const bucketEntry = {
      sensor,
      value,
      timestamp: nowIso,
      bucketStart: bucketIso,
      label: formatTimeLabel(bucketStart),
    };

    if (env.GREENHOUSE_HISTORY) {
      const r2Key = `history_15m/${sensor}/${bucketIso}.json`;
      const existing = await readR2Json(env.GREENHOUSE_HISTORY, r2Key);
      const numericValue = numberOrNull(value);
      const existingMin = numberOrNull(existing?.min ?? existing?.value);
      const existingMax = numberOrNull(existing?.max ?? existing?.value);

      if (numericValue !== null) {
        bucketEntry.min = existingMin === null ? numericValue : Math.min(existingMin, numericValue);
        bucketEntry.max = existingMax === null ? numericValue : Math.max(existingMax, numericValue);
        bucketEntry.count = Number.isInteger(existing?.count) ? existing.count + 1 : 1;
      }

      await env.GREENHOUSE_HISTORY.put(r2Key, JSON.stringify(bucketEntry), {
        httpMetadata: {
          contentType: "application/json; charset=utf-8",
        },
      });
    }
  }

  const latest = await getLatest(env);

  return jsonResponse(
    {
      ok: true,
      stored: latestEntry,
      latest,
    },
    200,
    corsHeaders
  );
}
async function handleFanCommand(env, state, corsHeaders) {
  const webhookUrl = await getEnvSecretValue(env, state === "on" ? "fan_on" : "fan_off");

  if (!webhookUrl) {
    return jsonResponse(
      {
        ok: false,
        error: `Missing secret for fan command: ${state === "on" ? "fan_on" : "fan_off"}`,
      },
      500,
      corsHeaders
    );
  }

  const webhookResponse = await fetch(webhookUrl, { method: "GET" });

  if (!webhookResponse.ok) {
    const details = await webhookResponse.text();
    return jsonResponse(
      {
        ok: false,
        error: `Failed to trigger fan ${state}`,
        details,
        status: webhookResponse.status,
      },
      502,
      corsHeaders
    );
  }

  const latest = await getLatest(env);

  return jsonResponse(
    {
      ok: true,
      action: `fan_${state}`,
      latest,
    },
    200,
    corsHeaders
  );
}

async function getEnvSecretValue(env, key) {
  const value = env[key];

  if (!value) return "";

  if (typeof value.get === "function") {
    const secretValue = await value.get();
    return String(secretValue || "").trim();
  }

  return String(value).trim();
}

async function getLatest(env) {
  const [temperatureEntry, humidityEntry, rainTodayEntry, doorEntry, fanEntry, heatingEntry, windowEntry] = await Promise.all([
    env.GREENHOUSE_DATA.get("latest:temperature", "json"),
    env.GREENHOUSE_DATA.get("latest:humidity", "json"),
    env.GREENHOUSE_DATA.get("latest:rain_today", "json"),
    env.GREENHOUSE_DATA.get("latest:door", "json"),
    env.GREENHOUSE_DATA.get("latest:fan", "json"),
    env.GREENHOUSE_DATA.get("latest:heating", "json"),
    env.GREENHOUSE_DATA.get("latest:window", "json"),
  ]);

  return {
    temperature: temperatureEntry?.value ?? null,
    temperatureUpdatedAt: temperatureEntry?.timestamp ?? null,
    humidity: humidityEntry?.value ?? null,
    humidityUpdatedAt: humidityEntry?.timestamp ?? null,
    rainToday: rainTodayEntry?.value ?? null,
    rainTodayUpdatedAt: rainTodayEntry?.timestamp ?? null,
    door: doorEntry?.value ?? null,
    doorUpdatedAt: doorEntry?.timestamp ?? null,
    fan: fanEntry?.value ?? null,
    fanUpdatedAt: fanEntry?.timestamp ?? null,
    heating: heatingEntry?.value ?? null,
    heatingUpdatedAt: heatingEntry?.timestamp ?? null,
    window: windowEntry?.value ?? null,
    windowUpdatedAt: windowEntry?.timestamp ?? null,
    updatedAt:
      maxIsoDate(
        maxIsoDate(
          maxIsoDate(
            maxIsoDate(
              maxIsoDate(
                maxIsoDate(
                  temperatureEntry?.timestamp ?? null,
                  humidityEntry?.timestamp ?? null
                ),
                rainTodayEntry?.timestamp ?? null
              ),
              doorEntry?.timestamp ?? null
            ),
            fanEntry?.timestamp ?? null
          ),
          heatingEntry?.timestamp ?? null
        ),
        windowEntry?.timestamp ?? null
      ) ?? null,
  };
}

async function getHistory(env) {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [temp, humidity, rainToday, door, fan, heating, window] = await Promise.all([
    listSensorHistory(env, "temperature", since),
    listSensorHistory(env, "humidity", since),
    listSensorHistory(env, "rain_today", since),
    listSensorHistory(env, "door", since),
    listSensorHistory(env, "fan", since),
    listSensorHistory(env, "heating", since),
    listSensorHistory(env, "window", since),
  ]);

  return {
    temperature: temp,
    humidity: humidity,
    rainToday: rainToday,
    door: door,
    fan: fan,
    heating: heating,
    window: window,
  };
}

async function getStats24h(env) {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [temperatureEntries, humidityEntries] = await Promise.all([
    listSensorHistoryEntries(env, "temperature", since),
    listSensorHistoryEntries(env, "humidity", since),
  ]);

  return {
    temperature: getNumericStats(temperatureEntries),
    humidity: getNumericStats(humidityEntries),
  };
}

function shouldStoreHistory(sensor) {
  return sensor === "temperature" || sensor === "humidity";
}

function buildWidgetRows(latest) {
  const temp = formatTemperature(latest.temperature);
  const humidity = formatHumidity(latest.humidity);
  const status = formatStatus(latest.temperature, latest.humidity);
  const updated = formatWidgetTime(latest.updatedAt);

  return [
    { key: "DRIVHUS", color: "main" },
    { key: "Temp", value: temp.value, color: temp.color },
    { key: "Fukt", value: humidity.value, color: humidity.color },
    { key: "" },
    { key: "Status", value: status.value, color: status.color },
    { key: "Oppdatert", value: updated, color: "muted" },
  ];
}

function formatTemperature(value) {
  if (value == null) return { value: "--.-°C", color: "warning" };

  const n = Math.round(Number(value) * 10) / 10;

  if (n < 12) return { value: `${n.toFixed(1)}°C`, color: "warning" };
  if (n > 28) return { value: `${n.toFixed(1)}°C`, color: "danger" };
  return { value: `${n.toFixed(1)}°C`, color: "success" };
}

function formatHumidity(value) {
  if (value == null) return { value: "--.-%", color: "warning" };

  const n = Math.round(Number(value) * 10) / 10;

  if (n < 50) return { value: `${n.toFixed(1)}%`, color: "warning" };
  if (n > 90) return { value: `${n.toFixed(1)}%`, color: "warning" };
  return { value: `${n.toFixed(1)}%`, color: "info" };
}

function formatStatus(tempValue, humidityValue) {
  const temp = Number(tempValue);
  const humidity = Number(humidityValue);

  const tempValid = Number.isFinite(temp);
  const humidityValid = Number.isFinite(humidity);

  if (!tempValid && !humidityValid) {
    return { value: "Ingen data", color: "warning" };
  }

  if (tempValid && temp < 12) {
    return { value: "For kaldt", color: "warning" };
  }

  if (tempValid && temp > 28) {
    return { value: "For varmt", color: "danger" };
  }

  if (humidityValid && humidity < 50) {
    return { value: "For tørt", color: "warning" };
  }

  if (humidityValid && humidity > 90) {
    return { value: "For fuktig", color: "warning" };
  }

  return { value: "OK", color: "success" };
}

function formatWidgetTime(iso) {
  if (!iso) return "--:--";

  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

async function listSensorHistory(env, sensor, sinceDate) {
  const sortedEntries = await listSensorHistoryEntries(env, sensor, sinceDate);
  return aggregateLatestByHour(sortedEntries, sensor);
}

async function listSensorHistoryEntries(env, sensor, sinceDate) {
  if (!env.GREENHOUSE_HISTORY) {
    return listSensorHistoryEntriesFromKv(env, sensor, sinceDate);
  }

  const prefix = `history_15m/${sensor}/`;
  let cursor = undefined;
  const items = [];

  do {
    const page = await env.GREENHOUSE_HISTORY.list({
      prefix,
      cursor,
      limit: 1000,
    });

    for (const object of page.objects) {
      const key = object.key;

      // key = history_15m/temperature/2026-05-04T13:45:00.000Z.json
      const parts = key.split("/");
      const isoWithExt = parts[2];
      const bucketIso = isoWithExt.replace(".json", "");
      const bucketDate = new Date(bucketIso);

      if (bucketDate >= sinceDate) {
        items.push(key);
      }
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const entries = await Promise.all(
    items.map(async (key) => {
      const obj = await env.GREENHOUSE_HISTORY.get(key);
      return obj ? await obj.json() : null;
    })
  );

  const sortedEntries = entries
    .filter(Boolean)
    .sort((a, b) => new Date(a.bucketStart) - new Date(b.bucketStart));

  return sortedEntries;
}

async function listSensorHistoryFromKv(env, sensor, sinceDate) {
  const sortedEntries = await listSensorHistoryEntriesFromKv(env, sensor, sinceDate);
  return aggregateLatestByHour(sortedEntries, sensor);
}

async function listSensorHistoryEntriesFromKv(env, sensor, sinceDate) {
  const prefix = `history_15m:${sensor}:`;
  let cursor = undefined;
  const items = [];

  do {
    const page = await env.GREENHOUSE_DATA.list({
      prefix,
      cursor,
      limit: 1000,
    });

    for (const key of page.keys) {
      const parts = key.name.split(":");
      const bucketIso = parts.slice(2).join(":");
      const bucketDate = new Date(bucketIso);

      if (bucketDate >= sinceDate) {
        items.push(key.name);
      }
    }

    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const entries = await Promise.all(
    items.map((key) => env.GREENHOUSE_DATA.get(key, "json"))
  );

  const sortedEntries = entries
    .filter(Boolean)
    .sort((a, b) => new Date(a.bucketStart) - new Date(b.bucketStart));

  return sortedEntries;
}

async function readR2Json(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;

  try {
    return await object.json();
  } catch {
    return null;
  }
}

function normalizeSensor(sensor) {
  const map = {
    temperature: "temperature",
    temp: "temperature",
    temperatur: "temperature",

    humidity: "humidity",
    humid: "humidity",
    luftfuktighet: "humidity",
    fuktighet: "humidity",

    rain_today: "rain_today",
    rain: "rain_today",
    regn: "rain_today",

    door: "door",
    dør: "door",
    dor: "door",
    contact: "door",
    contact_sensor: "door",
    contactalarm: "door",
    contact_alarm: "door",

    fan: "fan",
    vifte: "fan",
    blower: "fan",

    heating: "heating",
    heater: "heating",
    varme: "heating",
    varmeelement: "heating",
    heating_element: "heating",

    window: "window",
    windows: "window",
    vindu: "window",
    vinduer: "window",
    takvindu: "window",
    takvinduer: "window",
  };

  return map[sensor] || null;
}

function parseSensorValue(sensor, value) {
  if (sensor === "door") {
    if (typeof value === "boolean") {
      return value ? "open" : "closed";
    }

    if (typeof value === "number") {
      if (value === 1) return "open";
      if (value === 0) return "closed";
      return null;
    }

    const raw = String(value ?? "").trim().toLowerCase();

    const openValues = ["ja", "yes", "open", "opened", "apen", "åpen", "true", "1"];
    const closedValues = ["nei", "no", "closed", "stengt", "lukket", "false", "0"];

    if (openValues.includes(raw)) return "open";
    if (closedValues.includes(raw)) return "closed";

    return null;
  }

  if (sensor === "fan" || sensor === "heating") {
    if (typeof value === "boolean") {
      return value ? "on" : "off";
    }

    if (typeof value === "number") {
      if (value === 1) return "on";
      if (value === 0) return "off";
      return null;
    }

    const raw = String(value ?? "").trim().toLowerCase();

    const onValues = ["ja", "yes", "on", "true", "1", "på", "aktiv", "active"];
    const offValues = ["nei", "no", "off", "false", "0", "av", "inaktiv", "inactive"];

    if (onValues.includes(raw)) return "on";
    if (offValues.includes(raw)) return "off";

    return null;
  }

  if (sensor === "window") {
    const n = numberOrNull(value);
    if (n === null) return null;
    if (!Number.isInteger(n)) return null;
    if (n < 0 || n > 3) return null;
    return n;
  }

  return numberOrNull(value);
}

function roundDownTo15Minutes(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  const minutes = d.getUTCMinutes();
  d.setUTCMinutes(minutes - (minutes % 15));
  return d;
}

function formatTimeLabel(date) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getOsloHourKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}`;
}

function getLast24OsloHourSlots() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  const now = new Date();
  const slots = [];

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const parts = formatter.formatToParts(d);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const key = `${map.year}-${map.month}-${map.day}T${map.hour}`;
    const time = `${map.hour}:00`;
    slots.push({ key, time });
  }

  return slots;
}

function aggregateLatestByHour(entries, sensor) {
  const slots = getLast24OsloHourSlots();
  const latestPerHour = new Map();

  for (const entry of entries) {
    const entryDate = new Date(entry.bucketStart);
    const hourKey = getOsloHourKey(entryDate);
    const existing = latestPerHour.get(hourKey);

    if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
      latestPerHour.set(hourKey, entry);
    }
  }

  let lastKnown = null;

  return slots.map((slot) => {
    const entry = latestPerHour.get(slot.key);

    if (entry) {
      lastKnown = entry;
      return {
        time: slot.time,
        value: formatHistoryValue(sensor, entry.value),
        timestamp: entry.timestamp,
        bucketStart: entry.bucketStart,
      };
    }

    if (lastKnown) {
      return {
        time: slot.time,
        value: formatHistoryValue(sensor, lastKnown.value),
        timestamp: lastKnown.timestamp,
        bucketStart: lastKnown.bucketStart,
      };
    }

    return {
      time: slot.time,
      value: null,
      timestamp: null,
      bucketStart: null,
    };
  });
}

function formatHistoryValue(sensor, value) {
  if (sensor === "door") {
    return value === "open" || value === "closed" ? value : null;
  }

  if (sensor === "fan" || sensor === "heating") {
    return value === "on" || value === "off" ? value : null;
  }

  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return sensor === "window" ? Math.round(n) : Math.round(n * 10) / 10;
}

function getNumericStats(entries) {
  const values = [];

  for (const entry of entries) {
    const min = numberOrNull(entry.min ?? entry.value);
    const max = numberOrNull(entry.max ?? entry.value);

    if (min !== null) values.push(min);
    if (max !== null) values.push(max);
  }

  if (values.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.round(Math.min(...values) * 10) / 10,
    max: Math.round(Math.max(...values) * 10) / 10,
  };
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function maxIsoDate(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

function widgetResponse(rows, extraHeaders = {}) {
  return new Response(JSON.stringify(rows, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
