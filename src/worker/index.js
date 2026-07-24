import SunCalc from "suncalc";
import { getDefaultDisplayThemeForSlot, getDisplaySlotTheme } from "../shared/display-theme.js";
import { buildDataHealth } from "./data-health.js";

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(monitorDataHealth(env));

    const scheduledAt = new Date(controller?.scheduledTime || Date.now());
    if (scheduledAt.getUTCMinutes() % 15 === 0) {
      ctx.waitUntil(refreshWeatherCache(env));
      ctx.waitUntil(refreshStats24hCache(env));
      ctx.waitUntil(refreshDailyPlantAnalysisIfDue(env));
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
        return await handleIngest(request, env, corsHeaders, ctx);
      }

      if (url.pathname === "/api/latest" && request.method === "GET") {
        const latest = await getLatest(env);
        return jsonResponse({ ok: true, data: { ...latest, dataHealth: buildDataHealth(latest) } }, 200, corsHeaders);
      }

      if (url.pathname === "/api/data-health" && request.method === "GET") {
        const latest = await getLatest(env);
        const health = buildDataHealth(latest);
        const monitor = await env.GREENHOUSE_DATA.get(DATA_HEALTH_STATE_KEY, "json");
        return jsonResponse({ ok: true, data: { ...health, monitor } }, 200, corsHeaders);
      }

      if (url.pathname === "/api/weather" && request.method === "GET") {
        const weather = await getCachedWeather(env, ctx);
        return jsonResponse({ ok: true, data: weather }, 200, corsHeaders);
      }

      if (url.pathname === "/api/history" && request.method === "GET") {
        const history = await getHistory(env);
        return jsonResponse({ ok: true, data: history }, 200, corsHeaders);
      }

      if (url.pathname === "/api/stats24h" && request.method === "GET") {
        const stats24h = await getCachedStats24h(env, ctx);
        return jsonResponse({ ok: true, data: stats24h }, 200, corsHeaders);
      }

      if (url.pathname === "/api/plant-analysis" && request.method === "GET") {
        return await handleGetPlantAnalysis(env, corsHeaders);
      }

      if (url.pathname === "/admin/api/plant-analysis" && request.method === "POST") {
        return await handlePlantAnalysis(env, corsHeaders);
      }
      if (url.pathname === "/admin/api/plant-analysis/history" && request.method === "GET") {
        return jsonResponse({ ok: true, data: (await env.GREENHOUSE_DATA.get(PLANT_ANALYSIS_HISTORY_KEY, "json")) || [] }, 200, corsHeaders);
      }
      if (url.pathname === "/admin/api/openai-models" && request.method === "GET") {
        const allowed = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5-mini"];
        const response = await fetch("https://api.openai.com/v1/models", { headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}` } });
        const result = await response.json().catch(() => ({}));
        const available = new Set((result.data || []).map((model) => model.id));
        return jsonResponse({ ok: true, data: allowed.filter((id) => available.has(id)) }, 200, corsHeaders);
      }
      if (url.pathname === "/admin/api/plant-images/generate" && request.method === "POST") {
        return await handleGeneratePlantImages(request, env, corsHeaders);
      }

      if (url.pathname === "/api/site-config" && request.method === "GET") {
        const config = await getSiteConfig(env);
        return jsonResponse({ ok: true, data: config }, 200, corsHeaders);
      }

      if (url.pathname === "/api/display-config" && request.method === "GET") {
        const config = await getSiteConfig(env);
        return jsonResponse({ ok: true, data: buildDisplayConfig(config, request.url) }, 200, corsHeaders);
      }

      if (url.pathname === "/api/display-stats" && request.method === "GET") {
        const stats = await getDisplayStats(env);
        return jsonResponse({ ok: true, data: stats }, 200, corsHeaders);
      }

      if (url.pathname === "/api/display-log" && request.method === "GET") {
        return await handleGetDisplayLog(env, corsHeaders);
      }

      if (url.pathname === "/api/display-log" && request.method === "POST") {
        return await handlePostDisplayLog(request, env, corsHeaders);
      }

      if (url.pathname === "/api/site-image" && request.method === "GET") {
        return await handleSiteImage(request, env, corsHeaders);
      }

      if (url.pathname === "/manifest.webmanifest" && request.method === "GET") {
        return await handleSiteManifest(env, corsHeaders);
      }

      if (url.pathname === "/admin/api/config" && request.method === "GET") {
        const config = await getStoredSiteConfig(env);
        return jsonResponse({ ok: true, data: config }, 200, corsHeaders);
      }

      if (url.pathname === "/admin/api/config" && request.method === "PUT") {
        return await handleSaveSiteConfig(request, env, corsHeaders);
      }

      if (url.pathname === "/admin/api/product-catalog/nelson-garden" && request.method === "GET") {
        return await handleGetNelsonGardenCatalog(env, corsHeaders);
      }

      if (url.pathname === "/admin/api/product-catalog/nelson-garden/import" && request.method === "POST") {
        return await handleImportNelsonGardenCatalog(request, env, corsHeaders);
      }

      if (url.pathname === "/admin/api/product-catalog/nelson-garden/add" && request.method === "POST") {
        return await handleAddNelsonGardenProduct(request, env, corsHeaders);
      }

      if (url.pathname === "/admin/api/product-catalog/nelson-garden/classify" && request.method === "POST") {
        return await handleClassifyNelsonGardenCatalog(request, env, corsHeaders);
      }

      if (url.pathname === "/admin/api/images" && request.method === "GET") {
        const images = await listAdminImages(env);
        return jsonResponse({ ok: true, data: images }, 200, corsHeaders);
      }

      if (url.pathname === "/admin/api/images" && request.method === "POST") {
        return await handleUploadAdminImage(request, env, corsHeaders);
      }

      if (url.pathname === "/admin/api/images" && request.method === "DELETE") {
        return await handleDeleteAdminImage(request, env, corsHeaders);
      }

      if (url.pathname === "/admin/api/images" && request.method === "PATCH") {
        return await handleRenameAdminImage(request, env, corsHeaders);
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

      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/api/")) {
        return jsonResponse({ ok: false, error: "Not found" }, 404, corsHeaders);
      }

      if (env.ASSETS) {
        return await handleAssetRequest(request, env);
      }

      return jsonResponse({ ok: false, error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      console.error("Worker request failed", request.method, url.pathname, error?.stack || error?.message || error);
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

const WEATHER_CACHE_KEY = "latest:weather";
const WEATHER_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const STATS_24H_CACHE_KEY = "stats:24h";
const STATS_24H_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const DATA_HEALTH_STATE_KEY = "monitor:data-health";
const PLANT_ANALYSIS_KEY = "plant-analysis:latest";
const PLANT_ANALYSIS_HISTORY_KEY = "plant-analysis:history";
const PLANT_ANALYSIS_PROMPT_VERSION = 5;
const PLANT_ANALYSIS_CLIMATE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const PLANT_ANALYSIS_DAILY_KEY = "plant-analysis:last-daily-date";
const WEATHER_LATITUDE = 59.87;
const WEATHER_LONGITUDE = 10.67;
const GREENHOUSE_LATITUDE = 59.8667;
const GREENHOUSE_LONGITUDE = 10.7167;
const COLD_TEMPERATURE_THRESHOLD = 12;
const DEFAULT_PLANT_IMAGE_PROMPT = `Create an ultra-realistic commercial product photograph of a single {{plantenavn}} suspended in mid-air.

Product-specific visual description: {{plantebeskrivelse}}

The {{plantenavn}} has dramatically exploded open into several large pieces while remaining visually recognizable. Fresh juice, water droplets, pulp, leaves, petals, herbs, or natural fragments appropriate to the product burst outward in a dynamic high-speed splash. The explosion should feel powerful and frozen in time, like it was captured with a professional ultra high-speed camera.

Requirements:
- Hyper realistic photography
- Premium advertising style
- The {{plantenavn}} must remain the clear focal point
- Natural colors and textures faithful to this specific product
- Dramatic liquid or natural-fragment splash matching the product
- Tiny suspended droplets and fragments everywhere
- Sharp details with no motion blur
- Floating in mid-air
- Center composition
- A bold, solid {{bakgrunnsfarge}} studio background. Use exactly this background color while preserving strong visual contrast between subject and background.
- Soft studio lighting with subtle rim lighting
- High contrast
- No text, labels, packaging, or extra objects
- Clean minimal composition
- Premium food and botanical photography aesthetic
- 8K quality`;

const DEFAULT_PLANT_ANALYSIS_THEME = {
  light: {
    cardBg: "#ffffff",
    cardBorder: "#d9ded2",
    titleColor: "#505d41",
    ingressColor: "#505d41",
    watchTextColor: "#78716c",
    thrivingPillBg: "#668b39",
    watchPillBg: "#d28c31",
    stressPillBg: "#c44747",
    pillTextColor: "#ffffff",
  },
  dark: {
    cardBg: "#25341d",
    cardBorder: "#4e6240",
    titleColor: "#e8ede3",
    ingressColor: "#e8ede3",
    watchTextColor: "#8d9d7e",
    thrivingPillBg: "#668b39",
    watchPillBg: "#d28c31",
    stressPillBg: "#c44747",
    pillTextColor: "#ffffff",
  },
};

const PLANT_TYPE_OPTIONS = ["Blomst", "Urte", "Frukt", "Grønnsak"];
const SEED_LOCATION_OPTIONS = ["Innendørs", "Utendørs", "Drivhus"];
const DEFAULT_PLANT_LIBRARY = [
  { id: "san-marazano-tomater", name: "San Marazano tomater", plantType: "Frukt", plantGroup: "Tomat", description: "", image: "" },
  { id: "cherrytomater", name: "Cherrytomater", plantType: "Frukt", plantGroup: "Tomat", description: "", image: "" },
  { id: "agurk", name: "Agurk", plantType: "Frukt", plantGroup: "Agurk", description: "", image: "" },
  { id: "druer", name: "Druer", plantType: "Frukt", description: "", image: "" },
  { id: "basilikum", name: "Basilikum", plantType: "Urte", description: "Basilikum er en varmekjær urt som dyrkes for sine aromatiske blader.", image: "" },
  { id: "kryptimian", name: "Kryptimian", plantType: "Urte", description: "", image: "" },
  { id: "kiwibaer", name: "Kiwibær", plantType: "Frukt", description: "", image: "" },
  { id: "hvit-fersken", name: "Hvit fersken", plantType: "Frukt", description: "", image: "" },
  { id: "carolina-reaper", name: "Carolina Reaper", plantType: "Frukt", plantGroup: "Chili", description: "", image: "" },
  { id: "gul-habanero", name: "Gul Habanero", plantType: "Frukt", plantGroup: "Chili", description: "", image: "" },
];
const DEFAULT_PLANT_SEASONS = {
  "2026": DEFAULT_PLANT_LIBRARY.map((plant) => ({
    id: `${plant.id}-2026`,
    year: 2026,
    libraryId: plant.id,
    acquisition: "plant",
    seedDate: "",
    seedLocation: "",
    greenhouseDate: "",
    purchaseSource: "",
    finished: false,
    finishReason: "",
    harvestDate: "",
    plantingPlace: "",
    active: true,
    note: "",
  })),
};

const DEFAULT_SITE_CONFIG = {
  showHeroImage: true,
  visibleStatuses: {
    door: true,
    fan: true,
    window: true,
    plantLibrary: true,
    plantAnalysis: true,
    charts: true,
  },
  plants: [
    { id: "san-marazano-tomater", name: "San Marazano tomater", plantType: "Tomat", plantingPlace: "", active: true, note: "", image: "" },
    { id: "cherrytomater", name: "Cherrytomater", plantType: "Cherrytomat", plantingPlace: "", active: true, note: "", image: "" },
    { id: "agurk", name: "Agurk", plantType: "Agurk", plantingPlace: "", active: true, note: "", image: "" },
    { id: "druer", name: "Druer", plantType: "Drue", plantingPlace: "", active: true, note: "", image: "" },
    { id: "basilikum", name: "Basilikum", plantType: "Urt", plantingPlace: "", active: true, note: "", image: "" },
    { id: "kryptimian", name: "Kryptimian", plantType: "Urt", plantingPlace: "", active: true, note: "", image: "" },
    { id: "kiwibaer", name: "Kiwibær", plantType: "Kiwibær", plantingPlace: "", active: true, note: "", image: "" },
    { id: "hvit-fersken", name: "Hvit fersken", plantType: "Fersken", plantingPlace: "", active: true, note: "", image: "" },
    { id: "carolina-reaper", name: "Carolina Reaper", plantType: "Chili", plantingPlace: "", active: true, note: "", image: "" },
    { id: "gul-habanero", name: "Gul Habanero", plantType: "Chili", plantingPlace: "", active: true, note: "", image: "" },
  ],
  activePlantSeasonYear: 2026,
  plantDisplaySort: "manual",
  plantLibrary: DEFAULT_PLANT_LIBRARY,
  plantSeasons: DEFAULT_PLANT_SEASONS,
  plantAnalysisNotes: "",
  plantImagePrompt: DEFAULT_PLANT_IMAGE_PROMPT,
  plantAnalysisModel: "gpt-5.4-mini",
  plantAnalysisSchedule: { enabled: true, time: "06:00" },
  frontPageSectionOrder: ["climate", "plants", "charts"],
  frontPageSectionDefaults: { analysisExpanded: false, chartsExpanded: false },
  plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
  headerImages: {
    coldNight: {
      label: "Kald natt",
      description: "Natt og under 12°C",
      mobile: "/cold.jpg",
      desktop: "/cold.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/cold.jpg", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("coldNight"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
    night: {
      label: "Natt",
      description: "Etter solnedgang og før soloppgang",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/drivhus.png", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("night"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
    cold: {
      label: "Kaldt",
      description: "Under 12°C",
      mobile: "/cold.jpg",
      desktop: "/cold.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/cold.jpg", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("cold"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
    rain: {
      label: "Regn",
      description: "Regn eller torden fra Yr",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/drivhus.png", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("rain"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
    normal: {
      label: "Normalt",
      description: "12-22.9°C",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/drivhus.png", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("normal"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
    warm: {
      label: "Varmt",
      description: "23-28°C",
      mobile: "/warm.jpg",
      desktop: "/warm.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/warm.jpg", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("warm"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
    hot: {
      label: "Svært varmt",
      description: "Over 28°C",
      mobile: "/hot.jpg",
      desktop: "/hot.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
      display: { image: "", binary: "", source: "/hot.jpg", zoom: 1, offsetX: 0, offsetY: 0, size: 466, width: 164, height: 466, x: 302, y: 0 },
      displayTheme: getDefaultDisplayThemeForSlot("hot"),
      plantAnalysisTheme: DEFAULT_PLANT_ANALYSIS_THEME,
    },
  },
  branding: {
    siteName: "Kristins drivhus",
    shortName: "Drivhus",
    title: "Kristins drivhus",
    description: "Live dashboard for Kristins drivhus.",
    logoText: {
      visible: true,
      text: "Kristins drivhus",
      font: "Cinzel Decorative",
    },
    logo: {
      url: "",
      size: 36,
    },
    favicon: {
      svg: "/favicon.svg",
      png32: "",
      appleTouchIcon: "/apple-touch-icon.svg",
      png192: "",
      png512: "",
    },
  },
};

const WEATHER_DESCRIPTIONS = {
  clearsky_day: "Sol",
  clearsky_night: "Klar himmel",
  fair_day: "Lettskyet",
  fair_night: "Lettskyet",
  partlycloudy_day: "Delvis skyet",
  partlycloudy_night: "Delvis skyet",
  cloudy: "Overskyet",
  fog: "Tåke",
  lightrainshowers_day: "Lette regnbyger",
  lightrainshowers_night: "Lette regnbyger",
  rainshowers_day: "Regnbyger",
  rainshowers_night: "Regnbyger",
  heavyrainshowers_day: "Kraftige regnbyger",
  heavyrainshowers_night: "Kraftige regnbyger",
  lightrain: "Lett regn",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  lightsleetshowers_day: "Lette sluddbyger",
  lightsleetshowers_night: "Lette sluddbyger",
  sleetshowers_day: "Sluddbyger",
  sleetshowers_night: "Sluddbyger",
  heavysleetshowers_day: "Kraftige sluddbyger",
  heavysleetshowers_night: "Kraftige sluddbyger",
  lightsleet: "Lett sludd",
  sleet: "Sludd",
  heavysleet: "Kraftig sludd",
  lightsnowshowers_day: "Lette snøbyger",
  lightsnowshowers_night: "Lette snøbyger",
  snowshowers_day: "Snøbyger",
  snowshowers_night: "Snøbyger",
  heavysnowshowers_day: "Kraftige snøbyger",
  heavysnowshowers_night: "Kraftige snøbyger",
  lightsnow: "Lett snø",
  snow: "Snø",
  heavysnow: "Kraftig snø",
  thunderstorm: "Tordenvær",
  lightrainshowersandthunder_day: "Lette regnbyger og torden",
  lightrainshowersandthunder_night: "Lette regnbyger og torden",
  rainshowersandthunder_day: "Regnbyger og torden",
  rainshowersandthunder_night: "Regnbyger og torden",
  heavyrainshowersandthunder_day: "Kraftige regnbyger og torden",
  heavyrainshowersandthunder_night: "Kraftige regnbyger og torden",
  lightrainandthunder: "Lett regn og torden",
  rainandthunder: "Regn og torden",
  heavyrainandthunder: "Kraftig regn og torden",
  lightsleetshowersandthunder_day: "Lette sluddbyger og torden",
  lightsleetshowersandthunder_night: "Lette sluddbyger og torden",
  sleetshowersandthunder_day: "Sluddbyger og torden",
  sleetshowersandthunder_night: "Sluddbyger og torden",
  heavysleetshowersandthunder_day: "Kraftige sluddbyger og torden",
  heavysleetshowersandthunder_night: "Kraftige sluddbyger og torden",
  lightsleetandthunder: "Lett sludd og torden",
  sleetandthunder: "Sludd og torden",
  heavysleetandthunder: "Kraftig sludd og torden",
  lightsnowshowersandthunder_day: "Lette snøbyger og torden",
  lightsnowshowersandthunder_night: "Lette snøbyger og torden",
  snowshowersandthunder_day: "Snøbyger og torden",
  snowshowersandthunder_night: "Snøbyger og torden",
  heavysnowshowersandthunder_day: "Kraftige snøbyger og torden",
  heavysnowshowersandthunder_night: "Kraftige snøbyger og torden",
  lightsnowandthunder: "Lett snø og torden",
  snowandthunder: "Snø og torden",
  heavysnowandthunder: "Kraftig snø og torden",
};

async function handleAssetRequest(request, env) {
  const response = await env.ASSETS.fetch(request);

  if (request.method !== "GET" || !isHtmlNavigation(request, response)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

  const preloadLink = await getHeroVideoPreloadLink(env).catch((error) => {
    console.error("Failed to build hero preload link", error);
    return "";
  });

  if (preloadLink) headers.append("Link", preloadLink);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isHtmlNavigation(request, response) {
  const accept = request.headers.get("Accept") || "";
  const contentType = response.headers.get("Content-Type") || "";
  return accept.includes("text/html") && contentType.includes("text/html");
}

async function getHeroVideoPreloadLink(env) {
  const [config, latest, weather] = await Promise.all([
    getSiteConfig(env),
    getLatest(env).catch(() => null),
    env.GREENHOUSE_DATA.get(WEATHER_CACHE_KEY, "json").catch(() => null),
  ]);

  if (!config.showHeroImage || !latest || !weather?.symbolCode) return "";

  const slot = getHeaderImageSlot(latest.temperature, weather.symbolCode);
  const slotConfig = config.headerImages?.[slot];
  const videoUrl = slotConfig?.mobileVideo;

  if (!videoUrl) return "";

  return `<${videoUrl}>; rel=preload; as=video; type="video/mp4"; media="(max-width: 767px)"`;
}

function getHeaderImageSlot(temperature, symbolCode, now = new Date()) {
  const isCold = typeof temperature === "number" && temperature < COLD_TEMPERATURE_THRESHOLD;
  if (isNightNow(now)) return isCold ? "coldNight" : "night";
  if (isCold) return "cold";
  if (isRainWeatherSymbol(symbolCode)) return "rain";
  if (temperature == null) return "normal";
  if (temperature < 23) return "normal";
  if (temperature <= 28) return "warm";
  return "hot";
}

function isNightNow(now = new Date()) {
  const sunTimes = SunCalc.getTimes(now, GREENHOUSE_LATITUDE, GREENHOUSE_LONGITUDE);
  return now < sunTimes.sunrise || now >= sunTimes.sunset;
}

function isRainWeatherSymbol(symbolCode) {
  const symbol = String(symbolCode || "").toLowerCase();
  if (!symbol) return false;
  if (symbol.includes("snow") || symbol.includes("sleet")) return false;
  return symbol.includes("rain") || symbol.includes("thunder");
}

// Keep the old object as a read-only migration source. New writes are split so
// changing a small setting does not require rewriting the complete config.
const LEGACY_SITE_CONFIG_KEY = "admin/site-config.json";
const SITE_CONFIG_SCHEMA_VERSION = 1;
const SITE_CONFIG_MANIFEST_KEY = "admin/config/manifest.json";
const SITE_CONFIG_PART_NAMES = {
  site: "site-config",
  images: "images",
  display: "display-config",
  theme: "theme-config",
  plants: "plants",
  plantLibrary: "plant-library",
  analysis: "analysis-settings",
};
const ADMIN_IMAGE_PREFIX = "admin/images/";
const NELSON_GARDEN_CATALOG_KEY = "admin/product-catalogs/nelson-garden.json";
const NELSON_GARDEN_PRODUCTS_SITEMAP = "https://www.nelsongarden.no/sitemaps/products.xml";
const NELSON_GARDEN_IMPORT_BATCH_SIZE = 20;
const NELSON_GARDEN_CLASSIFY_BATCH_SIZE = 30;
const DISPLAY_LOG_KEY = "display:log";
const DISPLAY_LOG_PREFIX = "display:log:";
const DISPLAY_LOG_MAX_ENTRIES = 200;
const HEADER_VIDEO_MAX_BYTES = 10 * 1024 * 1024;
const LOGO_FONT_OPTIONS = [
  "Cinzel Decorative",
  "Cormorant Garamond",
  "Playfair Display",
  "Lora",
  "Libre Baskerville",
  "Merriweather",
  "Fraunces",
  "Inter",
];

async function getSiteConfig(env) {
  return withPublicAssetUrls(await getStoredSiteConfig(env), env);
}

async function getStoredSiteConfig(env) {
  const bucket = getConfigBucket(env);
  if (!bucket) return normalizeSiteConfig(null);

  const manifest = await readR2Json(bucket, SITE_CONFIG_MANIFEST_KEY);
  if (!manifest) {
    return normalizeSiteConfig(await readR2Json(bucket, LEGACY_SITE_CONFIG_KEY));
  }

  const parts = await readCommittedSiteConfigParts(bucket, manifest);
  return normalizeSiteConfig(mergeSiteConfigParts(parts));
}

async function handleSaveSiteConfig(request, env, corsHeaders) {
  const bucket = getConfigBucket(env);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  }

  const body = await request.json();
  const config = normalizeSiteConfig(body);
  const nextParts = splitSiteConfig(config);
  const currentManifest = await readR2Json(bucket, SITE_CONFIG_MANIFEST_KEY);
  const currentParts = currentManifest
    ? await readCommittedSiteConfigParts(bucket, currentManifest)
    : {};
  const updatedAt = new Date().toISOString();
  const generation = crypto.randomUUID();
  const partKeys = {};
  const writes = [];

  for (const [name, partName] of Object.entries(SITE_CONFIG_PART_NAMES)) {
    if (currentParts[name] && jsonValuesEqual(currentParts[name], nextParts[name])) {
      partKeys[name] = currentManifest.parts[name];
      continue;
    }

    const key = `admin/config/${partName}/${generation}.json`;
    partKeys[name] = key;
    writes.push(putR2Json(bucket, key, {
      schemaVersion: SITE_CONFIG_SCHEMA_VERSION,
      updatedAt,
      data: nextParts[name],
    }));
  }

  // The manifest is the commit point. Failed/partial part writes remain
  // unreachable, while readers continue using the previous complete commit.
  await Promise.all(writes);
  await putR2Json(bucket, SITE_CONFIG_MANIFEST_KEY, {
    schemaVersion: SITE_CONFIG_SCHEMA_VERSION,
    updatedAt,
    generation,
    parts: partKeys,
  });

  return jsonResponse({ ok: true, data: config }, 200, corsHeaders);
}

async function readCommittedSiteConfigParts(bucket, manifest) {
  if (
    manifest?.schemaVersion !== SITE_CONFIG_SCHEMA_VERSION ||
    !manifest.parts ||
    typeof manifest.parts !== "object"
  ) {
    throw new Error("Unsupported or invalid site config manifest");
  }

  const names = Object.keys(SITE_CONFIG_PART_NAMES);
  const envelopes = await Promise.all(names.map((name) => {
    const key = manifest.parts[name];
    if (typeof key !== "string" || !key.startsWith("admin/config/")) {
      throw new Error(`Site config manifest is missing part: ${name}`);
    }
    return readR2Json(bucket, key);
  }));

  const parts = {};
  names.forEach((name, index) => {
    const envelope = envelopes[index];
    if (envelope?.schemaVersion !== SITE_CONFIG_SCHEMA_VERSION || !("data" in envelope)) {
      throw new Error(`Site config part is missing or invalid: ${name}`);
    }
    parts[name] = envelope.data;
  });
  return parts;
}

function mergeSiteConfigParts(parts) {
  const site = parts.site || {};
  const images = parts.images || {};
  const display = parts.display || {};
  const theme = parts.theme || {};
  const plants = parts.plants || {};
  const plantLibrary = parts.plantLibrary || {};
  const analysis = parts.analysis || {};
  const merged = {
    ...site,
    ...plants,
    ...plantLibrary,
    ...analysis,
    ...(theme?.plantAnalysisTheme ? { plantAnalysisTheme: theme.plantAnalysisTheme } : {}),
  };

  const slots = new Set([
    ...Object.keys(images?.headerImages || {}),
    ...Object.keys(display?.headerImages || {}),
    ...Object.keys(theme?.headerImages || {}),
  ]);
  merged.headerImages = {};
  for (const slot of slots) {
    merged.headerImages[slot] = {
      ...(images?.headerImages?.[slot] || {}),
      ...(display?.headerImages?.[slot] || {}),
      ...(theme?.headerImages?.[slot] || {}),
    };
  }
  return merged;
}

function splitSiteConfig(config) {
  const images = {};
  const display = {};
  const theme = {};

  for (const [slot, image] of Object.entries(config.headerImages)) {
    images[slot] = {
      label: image.label,
      description: image.description,
      mobile: image.mobile,
      desktop: image.desktop,
      mobileVideo: image.mobileVideo,
    };
    display[slot] = { display: image.display };
    theme[slot] = { darkModeColor: image.darkModeColor };
    if (slot === "normal") {
      theme[slot].displayTheme = image.displayTheme;
      theme[slot].plantAnalysisTheme = image.plantAnalysisTheme;
    }
  }

  return {
    site: {
      showHeroImage: config.showHeroImage,
      visibleStatuses: config.visibleStatuses,
      frontPageSectionOrder: config.frontPageSectionOrder,
      frontPageSectionDefaults: config.frontPageSectionDefaults,
      branding: config.branding,
    },
    images: { headerImages: images },
    display: { headerImages: display },
    theme: { plantAnalysisTheme: config.plantAnalysisTheme, headerImages: theme },
    plants: {
      plants: config.plants,
      activePlantSeasonYear: config.activePlantSeasonYear,
      plantDisplaySort: config.plantDisplaySort,
      plantSeasons: config.plantSeasons,
    },
    plantLibrary: { plantLibrary: config.plantLibrary },
    analysis: { plantAnalysisNotes: config.plantAnalysisNotes, plantAnalysisModel: config.plantAnalysisModel, plantAnalysisSchedule: config.plantAnalysisSchedule, plantImagePrompt: config.plantImagePrompt },
  };
}

async function handleGeneratePlantImages(request, env, corsHeaders) {
  if (!env.OPENAI_API_KEY) return jsonResponse({ ok: false, error: "OpenAI API key is not configured" }, 500, corsHeaders);
  const bucket = getAssetBucket(env);
  if (!bucket) return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  const body = await request.json().catch(() => ({}));
  const plantId = sanitizeKeyPart(body.plantId);
  if (!plantId) return jsonResponse({ ok: false, error: "Missing plant id" }, 400, corsHeaders);
  const config = await getStoredSiteConfig(env);
  const plant = config.plantLibrary.find((item) => item.id === plantId);
  if (!plant) return jsonResponse({ ok: false, error: "Plant not found" }, 404, corsHeaders);
  const template = config.plantImagePrompt || DEFAULT_PLANT_IMAGE_PROMPT;
  const prompt = template
    .replace(/{{\s*(?:plantenavn|variablet)\s*}}/gi, plant.name)
    .replace(/{{\s*bakgrunnsfarge\s*}}/gi, plant.imageBackgroundColor)
    .replace(/{{\s*plantebeskrivelse\s*}}/gi, plant.imagePromptDescription || plant.description || plant.name);
  if (/{{\s*(?:plantenavn|bakgrunnsfarge|plantebeskrivelse)\s*}}/i.test(prompt)) return jsonResponse({ ok: false, error: "Bildeprompten inneholder en variabel som ikke kunne fylles ut" }, 400, corsHeaders);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2", prompt, n: 2, size: "1024x1024", quality: "medium", output_format: "webp", output_compression: 85 }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI image generation failed (${response.status}): ${details.slice(0, 500)}`);
  }
  const result = await response.json();
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const images = await Promise.all((result.data || []).slice(0, 2).map(async (item, index) => {
    if (!item.b64_json) throw new Error("OpenAI returned an image without data");
    const bytes = Uint8Array.from(atob(item.b64_json), (character) => character.charCodeAt(0));
    const originalName = `${plantId}-openai-${timestamp}-${index + 1}.webp`;
    const key = `${ADMIN_IMAGE_PREFIX}${plantId}/square/${originalName}`;
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { originalName, assetType: "plant-image", slot: plantId, format: "square", uploadedAt: generatedAt, source: "openai", model: "gpt-image-2" },
    });
    return getImageMetadata(env, bucket, key);
  }));
  return jsonResponse({ ok: true, data: { images, prompt, model: "gpt-image-2" } }, 201, corsHeaders);
}

function jsonValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function putR2Json(bucket, key, value) {
  return bucket.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
  });
}

async function handleGetNelsonGardenCatalog(env, corsHeaders) {
  const bucket = getConfigBucket(env);
  const catalog = bucket ? await readR2Json(bucket, NELSON_GARDEN_CATALOG_KEY) : null;
  return jsonResponse({ ok: true, data: catalog || { manufacturer: "Nelson Garden", updatedAt: null, products: [] } }, 200, corsHeaders);
}

async function handleImportNelsonGardenCatalog(request, env, corsHeaders) {
  const bucket = getConfigBucket(env);
  if (!bucket) return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  const body = await request.json().catch(() => ({}));
  const cursor = Math.max(0, Number(body?.cursor) || 0);
  const sitemapResponse = await fetch(NELSON_GARDEN_PRODUCTS_SITEMAP, { headers: { "User-Agent": "KristinsDrivhus/1.0 product catalog importer" } });
  if (!sitemapResponse.ok) throw new Error(`Nelson Garden sitemap returned ${sitemapResponse.status}`);
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.nelsongarden\.no\/produkter\/[^<]+)<\/loc>/g)].map((match) => match[1]);
  const batch = urls.slice(cursor, cursor + NELSON_GARDEN_IMPORT_BATCH_SIZE);
  const results = await Promise.all(batch.map(async (url) => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "KristinsDrivhus/1.0 product catalog importer" } });
      if (!response.ok) return null;
      return parseNelsonGardenProduct(await response.text(), url);
    } catch (error) {
      console.error("Nelson Garden product import failed", url, error);
      return null;
    }
  }));
  const imported = results.filter((product) => product?.productType === "seed");
  const current = await readR2Json(bucket, NELSON_GARDEN_CATALOG_KEY);
  const productsByArticle = new Map((current?.products || []).map((product) => [product.articleNumber, product]));
  imported.forEach((product) => productsByArticle.set(product.articleNumber, product));
  const products = [...productsByArticle.values()].sort((a, b) => `${a.productName} ${a.varietyName}`.localeCompare(`${b.productName} ${b.varietyName}`, "nb"));
  const nextCursor = cursor + batch.length;
  const done = nextCursor >= urls.length;
  const catalog = { manufacturer: "Nelson Garden", updatedAt: new Date().toISOString(), sourceCount: urls.length, products };
  await putR2Json(bucket, NELSON_GARDEN_CATALOG_KEY, catalog);
  return jsonResponse({ ok: true, data: { ...catalog, cursor: nextCursor, done, importedInBatch: imported.length } }, 200, corsHeaders);
}

function parseNelsonGardenProduct(html, sourceUrl) {
  const marker = '\\"product\\":';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  const valueStart = start + marker.length;
  for (let index = valueStart; index < html.length; index += 1) {
    const char = html[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) { end = index + 1; break; }
  }
  if (end < 0) return null;
  const product = JSON.parse(JSON.parse(`"${html.slice(valueStart, end)}"`));
  const variation = product.variations?.[0] || {};
  const imageRef = variation.media?.[0]?.asset?._ref || product.mainImage?.asset?._ref || "";
  const categoryPath = flattenNelsonGardenCategoryTrail(product.primaryCategoryTrail);
  const parsed = {
    manufacturer: "Nelson Garden",
    sourceProductId: product._id || "",
    articleNumber: String(variation.variationId || ""),
    baseArticleNumber: product.productBaseArtNr || "",
    ean: variation.ean || "",
    productName: product.title || variation.displayName || "",
    varietyName: product.sortName || product.title || "",
    description: product.description || "",
    latinName: product.latinName || "",
    productType: product.productType || "",
    categoryPath,
    sourceUrl,
    sourceImageUrl: sanityImageUrl(imageRef),
    attributes: Array.isArray(product.productAttributes) ? product.productAttributes : [],
    cultivation: Array.isArray(product.productHowTo) ? product.productHowTo : [],
  };
  parsed.plantType = inferNelsonGardenPlantType(parsed);
  parsed.plantGroup = inferNelsonGardenPlantGroup(parsed);
  return parsed;
}

function flattenNelsonGardenCategoryTrail(trail) {
  const categories = [];
  let current = trail;
  while (current && typeof current === "object") {
    if (current.title) categories.unshift(String(current.title));
    current = current.parent;
  }
  return categories;
}

function sanityImageUrl(reference) {
  const match = String(reference).match(/^image-([a-f0-9]+)-(\d+x\d+)-([a-z0-9]+)$/i);
  return match ? `https://cdn.sanity.io/images/f65p6skz/production/${match[1]}-${match[2]}.${match[3]}` : "";
}

async function handleAddNelsonGardenProduct(request, env, corsHeaders) {
  const configBucket = getConfigBucket(env);
  const assetBucket = getAssetBucket(env);
  if (!configBucket || !assetBucket) return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  const { articleNumber } = await request.json();
  const catalog = await readR2Json(configBucket, NELSON_GARDEN_CATALOG_KEY);
  const product = (catalog?.products || []).find((item) => item.articleNumber === String(articleNumber || ""));
  if (!product) return jsonResponse({ ok: false, error: "Produktet finnes ikke i katalogen" }, 404, corsHeaders);
  let image = "";
  if (product.sourceImageUrl) {
    try {
      const imageUrl = new URL(product.sourceImageUrl);
      imageUrl.searchParams.set("w", "1000");
      imageUrl.searchParams.set("fit", "max");
      imageUrl.searchParams.set("fm", "jpg");
      imageUrl.searchParams.set("q", "85");
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
      if (response.ok) {
        const key = `${ADMIN_IMAGE_PREFIX}plants/nelson-garden/${product.articleNumber}.jpg`;
        await assetBucket.put(key, response.body, { httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" } });
        image = getProxyAssetUrl(key);
      }
    } catch (error) {
      console.error("Nelson Garden image copy failed", product.articleNumber, error);
    }
  }
  const entry = {
    id: `nelson-garden-${product.articleNumber}`,
    name: product.varietyName || product.productName,
    productName: product.productName,
    plantType: product.plantType || inferNelsonGardenPlantType(product),
    plantGroup: product.plantGroup || inferNelsonGardenPlantGroup(product),
    description: product.description,
    image,
    manufacturer: product.manufacturer,
    articleNumber: product.articleNumber,
    sourceUrl: product.sourceUrl,
    sourceProductId: product.sourceProductId,
    sourceImageUrl: product.sourceImageUrl,
    productData: { baseArticleNumber: product.baseArticleNumber, ean: product.ean, latinName: product.latinName, attributes: product.attributes, cultivation: product.cultivation },
  };
  return jsonResponse({ ok: true, data: entry }, 200, corsHeaders);
}

function inferNelsonGardenPlantType(product) {
  const category = (product.categoryPath || []).join(" ").toLowerCase();
  const text = `${product.productName} ${product.varietyName} ${product.latinName}`.toLowerCase();
  if (/blomsterfrø|blomsterfro|sommerblomst|staude/.test(category)) return "Blomst";
  if (/krydder|urtefrø|urtefro/.test(category)) return "Urte";
  if (/blomst|solsikke|tagetes|zinnia|petunia|cosmos|pyntekorg|valmue|ringblomst|blomkarse|løvemunn|kornblomst/.test(text)) return "Blomst";
  if (/basilikum|timian|oregano|persille|dill|koriander|salvie|mynte/.test(text)) return "Urte";
  if (/tomat|agurk|chili|paprika|melon|jordbær/.test(text)) return "Frukt";
  return "Grønnsak";
}

function inferNelsonGardenPlantGroup(product) {
  const name = `${product.productName} ${product.varietyName}`.toLowerCase();
  if (name.includes("tomat")) return "Tomat";
  if (name.includes("chili") || name.includes("habanero")) return "Chili";
  if (name.includes("agurk")) return "Agurk";
  return "";
}

async function handleClassifyNelsonGardenCatalog(request, env, corsHeaders) {
  const bucket = getConfigBucket(env);
  if (!bucket) return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  if (!env.OPENAI_API_KEY) return jsonResponse({ ok: false, error: "OPENAI_API_KEY is not configured" }, 500, corsHeaders);
  const body = await request.json().catch(() => ({}));
  const cursor = Math.max(0, Number(body?.cursor) || 0);
  const catalog = await readR2Json(bucket, NELSON_GARDEN_CATALOG_KEY);
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const batch = products.slice(cursor, cursor + NELSON_GARDEN_CLASSIFY_BATCH_SIZE);
  if (!batch.length) return jsonResponse({ ok: true, data: { cursor, done: true, total: products.length, classified: 0 } }, 200, corsHeaders);

  const allowedPairs = Object.entries(PLANT_GROUP_OPTIONS).flatMap(([plantType, groups]) => groups.map((plantGroup) => ({ plantType, plantGroup })));
  const input = batch.map((product) => ({
    articleNumber: product.articleNumber,
    productName: product.productName,
    varietyName: product.varietyName,
    latinName: product.latinName,
    nelsonCategories: product.categoryPath || [],
    description: product.description,
  }));
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "Du klassifiserer frøprodukter til Kristins drivhus sin lukkede taksonomi. Botanisk bruk i denne appen gjelder: tomat, agurk, chili, paprika, aubergine, melon, squash, jordbær og physalis er Frukt selv om leverandøren kaller dem grønnsaker. Velg alltid nøyaktig ett av de oppgitte type/gruppe-parene. Bruk latinsk navn som viktigste artsgrunnlag, deretter norsk produktnavn og beskrivelse. Blomster skal aldri klassifiseres som Grønnsak. Returner bare skjemaet." },
        { role: "user", content: JSON.stringify({ allowedPairs, products: input }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nelson_garden_classification",
          strict: true,
          schema: {
            type: "object", additionalProperties: false, required: ["items"],
            properties: { items: { type: "array", items: {
              type: "object", additionalProperties: false, required: ["articleNumber", "plantType", "plantGroup"],
              properties: {
                articleNumber: { type: "string" },
                plantType: { type: "string", enum: Object.keys(PLANT_GROUP_OPTIONS) },
                plantGroup: { type: "string", enum: [...new Set(Object.values(PLANT_GROUP_OPTIONS).flat())] },
              },
            } } },
          },
        },
      },
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI classification failed (${response.status}): ${details.slice(0, 500)}`);
  }
  const result = await response.json();
  const parsed = JSON.parse(result.choices?.[0]?.message?.content || "{}");
  const byArticle = new Map((parsed.items || []).map((item) => [String(item.articleNumber), item]));
  let classified = 0;
  for (let index = cursor; index < cursor + batch.length; index += 1) {
    const product = products[index];
    const classification = byArticle.get(String(product.articleNumber));
    if (!classification || !(PLANT_GROUP_OPTIONS[classification.plantType] || []).includes(classification.plantGroup)) {
      throw new Error(`Invalid classification for article ${product.articleNumber}`);
    }
    products[index] = { ...product, plantType: classification.plantType, plantGroup: classification.plantGroup, classificationSource: "openai-one-off-v1" };
    classified += 1;
  }
  const nextCursor = cursor + batch.length;
  await putR2Json(bucket, NELSON_GARDEN_CATALOG_KEY, { ...catalog, products, classifiedAt: new Date().toISOString() });
  return jsonResponse({ ok: true, data: { cursor: nextCursor, done: nextCursor >= products.length, total: products.length, classified } }, 200, corsHeaders);
}

async function handleUploadAdminImage(request, env, corsHeaders) {
  const bucket = getAssetBucket(env);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse({ ok: false, error: "Content-Type must be multipart/form-data" }, 400, corsHeaders);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const assetType = sanitizeKeyPart(formData.get("assetType") || "header");
  const slot = sanitizeKeyPart(formData.get("slot") || "general");
  const format = sanitizeKeyPart(formData.get("format") || "image");

  if (!file || typeof file === "string") {
    return jsonResponse({ ok: false, error: "Missing file upload" }, 400, corsHeaders);
  }

  if (assetType === "header-video" && file.size > HEADER_VIDEO_MAX_BYTES) {
    return jsonResponse({ ok: false, error: "Header video must be 10 MB or smaller" }, 400, corsHeaders);
  }

  if (!isAllowedUploadType(assetType, file.type, format)) {
    return jsonResponse({ ok: false, error: "Unsupported file type for this asset" }, 400, corsHeaders);
  }

  const extension = getUploadExtension(file.type);
  const originalName = sanitizeFilename(file.name || `header.${extension}`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${ADMIN_IMAGE_PREFIX}${slot}/${format}/${timestamp}-${originalName.replace(/\.(jpe?g|png|svg|mp4)$/i, "")}.${extension}`;

  await bucket.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName,
      assetType,
      slot,
      format,
      uploadedAt: new Date().toISOString(),
    },
  });

  const image = await getImageMetadata(env, bucket, key);
  return jsonResponse({ ok: true, data: image }, 201, corsHeaders);
}

async function handleDeleteAdminImage(request, env, corsHeaders) {
  const bucket = getAssetBucket(env);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!isAllowedImageKey(key)) {
    return jsonResponse({ ok: false, error: "Invalid image key" }, 400, corsHeaders);
  }

  await bucket.delete(key);

  return jsonResponse({ ok: true, deleted: key }, 200, corsHeaders);
}

async function handleRenameAdminImage(request, env, corsHeaders) {
  const bucket = getAssetBucket(env);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  }

  const body = await request.json().catch(() => null);
  const key = String(body?.key || "");
  const requestedFilename = sanitizeFilename(body?.filename || "");

  if (!isAllowedImageKey(key)) {
    return jsonResponse({ ok: false, error: "Invalid image key" }, 400, corsHeaders);
  }

  if (!requestedFilename) {
    return jsonResponse({ ok: false, error: "Missing filename" }, 400, corsHeaders);
  }

  const object = await bucket.get(key);
  if (!object) {
    return jsonResponse({ ok: false, error: "Image not found" }, 404, corsHeaders);
  }

  const currentMetadata = object.customMetadata || {};
  const currentFilename = currentMetadata.originalName || key.split("/").pop() || "";
  const currentExtension = getFilenameExtension(currentFilename || key);
  const requestedExtension = getFilenameExtension(requestedFilename);

  if (!currentExtension || requestedExtension !== currentExtension) {
    return jsonResponse({ ok: false, error: "Filename extension cannot be changed" }, 400, corsHeaders);
  }

  await bucket.put(key, object.body, {
    httpMetadata: {
      contentType: object.httpMetadata?.contentType || "application/octet-stream",
      cacheControl: object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable",
    },
    customMetadata: {
      ...currentMetadata,
      originalName: requestedFilename,
    },
  });

  const image = await getImageMetadata(env, bucket, key);
  return jsonResponse({ ok: true, data: image }, 200, corsHeaders);
}

async function listAdminImages(env) {
  const bucket = getAssetBucket(env);
  if (!bucket) return [];

  let cursor = undefined;
  const objects = [];

  do {
    const page = await bucket.list({
      prefix: ADMIN_IMAGE_PREFIX,
      cursor,
      limit: 1000,
    });

    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const images = await Promise.all(objects.map((object) => getImageMetadata(env, bucket, object.key, object)));
  return images
    .filter(Boolean)
    .sort((a, b) => new Date(b.uploadedAt || b.updatedAt) - new Date(a.uploadedAt || a.updatedAt));
}

async function handleSiteImage(request, env, corsHeaders) {
  const bucket = getAssetBucket(env);
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!bucket || !isAllowedImageKey(key)) {
    return jsonResponse({ ok: false, error: "Image not found" }, 404, corsHeaders);
  }

  const rangeHeader = request.headers.get("Range");

  if (rangeHeader) {
    const head = await bucket.head(key);
    if (!head) {
      return jsonResponse({ ok: false, error: "Image not found" }, 404, corsHeaders);
    }

    const range = parseRangeHeader(rangeHeader, head.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${head.size}`,
          "Accept-Ranges": "bytes",
          ...corsHeaders,
        },
      });
    }

    const object = await bucket.get(key, {
      range: {
        offset: range.start,
        length: range.end - range.start + 1,
      },
    });

    if (!object) {
      return jsonResponse({ ok: false, error: "Image not found" }, 404, corsHeaders);
    }

    return new Response(object.body, {
      status: 206,
      headers: {
        "Content-Type": object.httpMetadata?.contentType || head.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": object.httpMetadata?.cacheControl || head.httpMetadata?.cacheControl || "public, max-age=3600",
        "Accept-Ranges": "bytes",
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": `bytes ${range.start}-${range.end}/${head.size}`,
        ...corsHeaders,
      },
    });
  }

  const object = await bucket.get(key);
  if (!object) {
    return jsonResponse({ ok: false, error: "Image not found" }, 404, corsHeaders);
  }

  const headers = {
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": object.httpMetadata?.cacheControl || "public, max-age=3600",
    "Accept-Ranges": "bytes",
    ...corsHeaders,
  };

  if (object.size) {
    headers["Content-Length"] = String(object.size);
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

function parseRangeHeader(rangeHeader, size) {
  const match = String(rangeHeader || "").match(/^bytes=(\d*)-(\d*)$/);
  if (!match || !Number.isFinite(size) || size <= 0) return null;

  const [, startRaw, endRaw] = match;
  let start;
  let end;

  if (!startRaw && !endRaw) return null;

  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end < start || start >= size) return null;

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

async function handleSiteManifest(env, corsHeaders) {
  const config = await getSiteConfig(env);
  const favicon = config.branding.favicon;
  const icons = [];

  if (favicon.svg) {
    icons.push({
      src: favicon.svg,
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any maskable",
    });
  }

  if (favicon.png192) {
    icons.push({
      src: favicon.png192,
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    });
  }

  if (favicon.png512) {
    icons.push({
      src: favicon.png512,
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    });
  }

  if (favicon.appleTouchIcon) {
    icons.push({
      src: favicon.appleTouchIcon,
      sizes: "180x180",
      type: favicon.appleTouchIcon.endsWith(".svg") ? "image/svg+xml" : "image/png",
    });
  }

  return new Response(
    JSON.stringify({
      name: config.branding.siteName,
      short_name: config.branding.shortName,
      description: config.branding.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#e8ede3",
      theme_color: "#2d3a21",
      icons,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    }
  );
}

function getConfigBucket(env) {
  return env.GREENHOUSE_HISTORY || env.GREENHOUSE_ASSETS || null;
}

function getAssetBucket(env) {
  return env.GREENHOUSE_ASSETS || env.GREENHOUSE_HISTORY || null;
}

function getPublicAssetBaseUrl(env) {
  const raw = String(env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  return /^https:\/\//i.test(raw) ? raw : "";
}

function getAssetUrl(env, key) {
  const publicBaseUrl = getPublicAssetBaseUrl(env);
  if (publicBaseUrl) return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return getProxyAssetUrl(key);
}

function getProxyAssetUrl(key) {
  return `/api/site-image?key=${encodeURIComponent(key)}`;
}

function getImageKeyFromReference(value) {
  const raw = String(value || "").trim();
  if (isAllowedImageKey(raw)) return raw;

  if (raw.startsWith("/api/site-image?")) {
    try {
      const url = new URL(raw, "https://internal.invalid");
      const key = url.searchParams.get("key") || "";
      return isAllowedImageKey(key) ? key : "";
    } catch {
      return "";
    }
  }

  return "";
}

function withPublicAssetUrls(config, env) {
  const publicBaseUrl = getPublicAssetBaseUrl(env);
  if (!publicBaseUrl) return config;

  const next = structuredClone(config);
  const rewrite = (value) => {
    const key = getImageKeyFromReference(value);
    return key ? getAssetUrl(env, key) : value;
  };

  for (const slot of Object.values(next.headerImages)) {
    slot.mobile = rewrite(slot.mobile);
    slot.desktop = rewrite(slot.desktop);
    slot.mobileVideo = rewrite(slot.mobileVideo);
    if (slot.display && typeof slot.display === "object") {
      slot.display.image = rewrite(slot.display.image);
      slot.display.binary = rewrite(slot.display.binary);
      slot.display.source = rewrite(slot.display.source);
    }
  }

  const logoKey = getImageKeyFromReference(next.branding.logo.url);
  next.branding.logo.url = logoKey ? getProxyAssetUrl(logoKey) : next.branding.logo.url;
  next.branding.favicon.svg = rewrite(next.branding.favicon.svg);
  next.branding.favicon.png32 = rewrite(next.branding.favicon.png32);
  next.branding.favicon.appleTouchIcon = rewrite(next.branding.favicon.appleTouchIcon);
  next.branding.favicon.png192 = rewrite(next.branding.favicon.png192);
  next.branding.favicon.png512 = rewrite(next.branding.favicon.png512);
  next.plantLibrary = (next.plantLibrary || []).map((plant) => ({
    ...plant,
    image: rewrite(plant.image),
  }));
  next.plants = (next.plants || []).map((plant) => ({
    ...plant,
    image: rewrite(plant.image),
  }));

  return next;
}

function buildDisplayConfig(config, requestUrl) {
  const slots = {};

  for (const [key, image] of Object.entries(config.headerImages || {})) {
    const display = image.display || {};
    const theme = getDisplaySlotTheme(key, image.displayTheme?.dark);
    slots[key] = {
      label: image.label || key,
      backgroundColor: image.darkModeColor || "#2d3a21",
      background: parseHexColorNumber(image.darkModeColor, 0x2d3a21),
      labelColor: parseHexColorNumber(theme.labelColor, 0xffffff),
      labelOpacity: Math.round((theme.labelOpacity ?? 1) * 255),
      temperatureValueColor: parseHexColorNumber(theme.temperatureValueColor, 0xd0dec8),
      humidityValueColor: parseHexColorNumber(theme.humidityValueColor, 0xd3deca),
      unitColor: parseHexColorNumber(theme.unitColor, 0xb3bea3),
      symbolColor: parseHexColorNumber(theme.symbolColor, 0x8d9d7e),
      auxColor: parseHexColorNumber(theme.symbolColor || theme.auxColor, 0x8d9d7e),
      graphPanelBg: parseHexColorNumber(theme.graphPanelBg, 0x25341d),
      graphPanelBorder: parseHexColorNumber(theme.graphPanelBorder, 0x4e6240),
      image: absoluteUrl(display.image || "", requestUrl),
      binary: absoluteUrl(display.binary || "", requestUrl),
      format: display.binary ? "rgb565" : "",
      width: display.width || 164,
      height: display.height || 466,
      x: display.x || 302,
      y: display.y || 0,
    };
    addOptionalHexColor(slots[key], "doorIconColor", theme.doorIconColor);
    addOptionalHexColor(slots[key], "windowIconColor", theme.windowIconColor);
    addOptionalHexColor(slots[key], "fanIconColor", theme.fanIconColor);
  }

  return {
    version: "display-rgb565-164x466-v1",
    width: 164,
    height: 466,
    screenSize: 466,
    slots,
  };
}

function absoluteUrl(value, requestUrl) {
  if (!value) return "";
  return new URL(value, requestUrl).toString();
}

function parseHexColorNumber(value, fallback) {
  const raw = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  return parseInt(raw, 16);
}

function addOptionalHexColor(target, key, value) {
  const raw = String(value || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    target[key] = parseInt(raw, 16);
  }
}

async function getImageMetadata(env, bucket, key, objectInfo = null) {
  if (!isAllowedImageKey(key)) return null;

  const object = objectInfo && objectInfo.customMetadata ? objectInfo : await bucket.head(key);
  if (!object) return null;

  const customMetadata = object.customMetadata || {};
  const filename = customMetadata.originalName || key.split("/").pop();
  const contentType = object.httpMetadata?.contentType || "";
  const format = customMetadata.format || key.split("/")[3] || "image";
  const extension = getFilenameExtension(filename || key);
  const assetType =
    customMetadata.assetType ||
    (contentType.startsWith("video/") || extension === "mp4" || format === "mobile-video"
      ? "header-video"
      : "header");

  return {
    key,
    url: getProxyAssetUrl(key),
    filename,
    contentType,
    size: object.size || null,
    uploadedAt: customMetadata.uploadedAt || object.uploaded?.toISOString?.() || null,
    updatedAt: object.uploaded?.toISOString?.() || null,
    slot: customMetadata.slot || key.split("/")[2] || "general",
    format,
    assetType,
  };
}

function normalizeFrontPageSectionOrder(value) {
  const allowed = ["climate", "plants", "charts"];
  const input = Array.isArray(value) ? value.filter((item) => allowed.includes(item)) : [];
  return [...new Set([...input, ...allowed])];
}

function normalizeSiteConfig(config) {
  const input = config && typeof config === "object" ? config : {};
  const visibleStatuses = input.visibleStatuses && typeof input.visibleStatuses === "object" ? input.visibleStatuses : {};
  const plants = Array.isArray(input.plants) ? input.plants : DEFAULT_SITE_CONFIG.plants;
  const activePlantSeasonYear = normalizePlantYear(input.activePlantSeasonYear, 2026);
  const plantLibrary = normalizePlantLibrary(input.plantLibrary, plants);
  const plantSeasons = normalizePlantSeasons(input.plantSeasons, plantLibrary, plants, activePlantSeasonYear);
  const activeSeasonPlants = derivePlantsFromSeason(plantLibrary, plantSeasons[String(activePlantSeasonYear)] || []);
  const plantAnalysisTheme = input.plantAnalysisTheme && typeof input.plantAnalysisTheme === "object" ? input.plantAnalysisTheme : {};
  const headerImages = input.headerImages && typeof input.headerImages === "object" ? input.headerImages : {};
  const legacyDisplayThemeConfig = input.displayTheme && typeof input.displayTheme === "object" ? input.displayTheme : null;
  const branding = input.branding && typeof input.branding === "object" ? input.branding : {};
  const logo = branding.logo && typeof branding.logo === "object" ? branding.logo : {};
  const logoText = branding.logoText && typeof branding.logoText === "object" ? branding.logoText : {};
  const favicon = branding.favicon && typeof branding.favicon === "object" ? branding.favicon : {};
  const siteName = normalizeText(branding.siteName, DEFAULT_SITE_CONFIG.branding.siteName, 80);
  const shortName = normalizeText(branding.shortName, DEFAULT_SITE_CONFIG.branding.shortName, 32);
  const title = normalizeText(branding.title, DEFAULT_SITE_CONFIG.branding.title, 80);
  const description = normalizeText(branding.description, DEFAULT_SITE_CONFIG.branding.description, 180);

  const normalized = {
    showHeroImage: typeof input.showHeroImage === "boolean" ? input.showHeroImage : DEFAULT_SITE_CONFIG.showHeroImage,
    visibleStatuses: {
      door: typeof visibleStatuses.door === "boolean" ? visibleStatuses.door : DEFAULT_SITE_CONFIG.visibleStatuses.door,
      fan: typeof visibleStatuses.fan === "boolean" ? visibleStatuses.fan : DEFAULT_SITE_CONFIG.visibleStatuses.fan,
      window: typeof visibleStatuses.window === "boolean" ? visibleStatuses.window : DEFAULT_SITE_CONFIG.visibleStatuses.window,
      plantLibrary: typeof visibleStatuses.plantLibrary === "boolean" ? visibleStatuses.plantLibrary : DEFAULT_SITE_CONFIG.visibleStatuses.plantLibrary,
      plantAnalysis: typeof visibleStatuses.plantAnalysis === "boolean" ? visibleStatuses.plantAnalysis : DEFAULT_SITE_CONFIG.visibleStatuses.plantAnalysis,
      charts: typeof visibleStatuses.charts === "boolean" ? visibleStatuses.charts : DEFAULT_SITE_CONFIG.visibleStatuses.charts,
    },
    plants: activeSeasonPlants.length ? activeSeasonPlants : normalizePlants(plants),
    activePlantSeasonYear,
    plantDisplaySort: ["manual", "name-asc", "name-desc", "type", "status"].includes(input.plantDisplaySort) ? input.plantDisplaySort : "manual",
    plantLibrary,
    plantSeasons,
    plantAnalysisNotes: normalizeText(input.plantAnalysisNotes, DEFAULT_SITE_CONFIG.plantAnalysisNotes, 1200),
    plantImagePrompt: normalizePlantImagePrompt(input.plantImagePrompt),
    plantAnalysisModel: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5-mini"].includes(input.plantAnalysisModel) ? input.plantAnalysisModel : "gpt-5.4-mini",
    plantAnalysisSchedule: {
      enabled: input.plantAnalysisSchedule?.enabled !== false,
      time: /^([01]\d|2[0-3]):(00|15|30|45)$/.test(input.plantAnalysisSchedule?.time || "") ? input.plantAnalysisSchedule.time : "06:00",
    },
    frontPageSectionOrder: normalizeFrontPageSectionOrder(input.frontPageSectionOrder),
    frontPageSectionDefaults: {
      analysisExpanded: input.frontPageSectionDefaults?.analysisExpanded === true,
      chartsExpanded: input.frontPageSectionDefaults?.chartsExpanded === true,
    },
    plantAnalysisTheme: normalizePlantAnalysisTheme(plantAnalysisTheme),
    headerImages: {},
    branding: {
      siteName,
      shortName,
      title,
      description,
      logoText: {
        visible:
          typeof logoText.visible === "boolean"
            ? logoText.visible
            : DEFAULT_SITE_CONFIG.branding.logoText.visible,
        text: normalizeText(logoText.text, DEFAULT_SITE_CONFIG.branding.logoText.text, 48),
        font: LOGO_FONT_OPTIONS.includes(logoText.font)
          ? logoText.font
          : DEFAULT_SITE_CONFIG.branding.logoText.font,
      },
      logo: {
        url: normalizeImageReference(logo.url, DEFAULT_SITE_CONFIG.branding.logo.url),
        size: normalizeNumber(logo.size, DEFAULT_SITE_CONFIG.branding.logo.size, 20, 72),
      },
      favicon: {
        svg: normalizeImageReference(favicon.svg, DEFAULT_SITE_CONFIG.branding.favicon.svg),
        png32: normalizeImageReference(favicon.png32, DEFAULT_SITE_CONFIG.branding.favicon.png32),
        appleTouchIcon: normalizeImageReference(
          favicon.appleTouchIcon,
          DEFAULT_SITE_CONFIG.branding.favicon.appleTouchIcon
        ),
        png192: normalizeImageReference(favicon.png192, DEFAULT_SITE_CONFIG.branding.favicon.png192),
        png512: normalizeImageReference(favicon.png512, DEFAULT_SITE_CONFIG.branding.favicon.png512),
      },
    },
  };

  for (const [key, defaultImage] of Object.entries(DEFAULT_SITE_CONFIG.headerImages)) {
    const image = headerImages[key] && typeof headerImages[key] === "object" ? headerImages[key] : {};
    normalized.headerImages[key] = {
      label: defaultImage.label,
      description: defaultImage.description,
      mobile: normalizeImageReference(image.mobile, defaultImage.mobile),
      desktop: normalizeImageReference(image.desktop, defaultImage.desktop),
      mobileVideo: normalizeImageReference(image.mobileVideo, defaultImage.mobileVideo),
      darkModeColor: normalizeHexColor(image.darkModeColor, defaultImage.darkModeColor),
      display: normalizeDisplayImageConfig(image.display, defaultImage.display),
      displayTheme: normalizeDisplayThemeConfig(image.displayTheme || legacyDisplayThemeConfig, defaultImage.displayTheme),
      plantAnalysisTheme: normalizePlantAnalysisTheme(image.plantAnalysisTheme || plantAnalysisTheme || defaultImage.plantAnalysisTheme),
    };
  }

  // "Normal" is the canonical light/dark palette. Weather and temperature
  // slots inherit it; they only keep their own media, display crop and
  // dark-mode browser background.
  const baseDisplayTheme = normalized.headerImages.normal.displayTheme;
  const basePlantAnalysisTheme = normalized.headerImages.normal.plantAnalysisTheme;
  normalized.plantAnalysisTheme = basePlantAnalysisTheme;
  for (const image of Object.values(normalized.headerImages)) {
    image.displayTheme = baseDisplayTheme;
    image.plantAnalysisTheme = basePlantAnalysisTheme;
  }

  return normalized;
}

function normalizePlantImagePrompt(value) {
  const prompt = normalizeText(value, "", 2400);
  if (!prompt || prompt.startsWith("Produktbilde av en gruppe med {{plantenavn}}")) return DEFAULT_PLANT_IMAGE_PROMPT;
  return prompt;
}

function normalizePlantYear(value, fallback) {
  const year = typeof value === "number" ? value : Number(value);
  return Number.isFinite(year) ? Math.min(Math.max(Math.round(year), 2020), 2100) : fallback;
}

function normalizePlantType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "blomst") return "Blomst";
  if (raw === "urte" || raw === "urt") return "Urte";
  if (raw === "frukt" || raw.includes("drue") || raw.includes("fersken") || raw.includes("kiwi")) return "Frukt";
  return "Grønnsak";
}

const PLANT_GROUP_OPTIONS = {
  Frukt: ["Tomat", "Agurk", "Aubergine", "Drue", "Kiwibær", "Fersken", "Chili", "Paprika", "Melon", "Squash", "Jordbær", "Bær", "Sitrus", "Fiken", "Pasjonsfrukt", "Physalis", "Annet"],
  Grønnsak: ["Rotgrønnsak", "Bladgrønnsak", "Kål", "Løk", "Belgvekst", "Potet", "Mais", "Stengelgrønnsak", "Asparges", "Fennikel", "Annet"],
  Blomst: ["Staude", "Sommerblomst", "Løk/knoll", "Klatreplante", "Snittblomst", "Pollinatorplante", "Potteplante", "Annet"],
  Urte: ["Basilikum", "Persille", "Koriander", "Dill", "Mynte", "Timian", "Oregano/merian", "Rosmarin", "Salvie", "Gressløk", "Estragon", "Sitronmelisse", "Annet"],
};

function normalizePlantGroup(value, plantType, name) {
  const raw = normalizeText(value, "", 80);
  if ((PLANT_GROUP_OPTIONS[plantType] || []).includes(raw)) return raw;
  const normalizedName = String(name || "").toLocaleLowerCase("nb-NO");
  if (plantType === "Frukt") {
    if (normalizedName.includes("tomat") || normalizedName.includes("marmande") || normalizedName.includes("marzano")) return "Tomat";
    if (normalizedName.includes("agurk")) return "Agurk";
    if (normalizedName.includes("drue")) return "Drue";
    if (normalizedName.includes("kiwi")) return "Kiwibær";
    if (normalizedName.includes("fersken") || normalizedName.includes("peach")) return "Fersken";
    if (normalizedName.includes("reaper") || normalizedName.includes("habanero") || normalizedName.includes("chili")) return "Chili";
  }
  if (plantType === "Urte") {
    if (normalizedName.includes("basilikum")) return "Basilikum";
    if (normalizedName.includes("persille")) return "Persille";
    if (normalizedName.includes("koriander")) return "Koriander";
    if (normalizedName.includes("dill")) return "Dill";
    if (normalizedName.includes("mynte")) return "Mynte";
    if (normalizedName.includes("timian")) return "Timian";
    if (normalizedName.includes("oregano") || normalizedName.includes("merian")) return "Oregano/merian";
    if (normalizedName.includes("rosmarin")) return "Rosmarin";
    if (normalizedName.includes("salvie")) return "Salvie";
    if (normalizedName.includes("gressløk")) return "Gressløk";
    if (normalizedName.includes("estragon")) return "Estragon";
    if (normalizedName.includes("sitronmelisse")) return "Sitronmelisse";
  }
  if (plantType === "Blomst" && (normalizedName.includes("solhatt") || normalizedName.includes("brudeslør"))) return "Staude";
  return "";
}

function normalizePlantLibrary(library, legacyPlants) {
  const input = Array.isArray(library) && library.length ? library : legacyPlants;
  const seen = new Set();
  const normalized = (Array.isArray(input) ? input : [])
    .map((plant, index) => {
      const item = plant && typeof plant === "object" ? plant : {};
      const name = normalizeText(item.name, "", 80);
      if (!name) return null;
      let id = normalizeText(item.id, slugifyPlantName(name) || `plante-${index + 1}`, 80);
      if (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      const plantType = normalizePlantType(item.plantType);
      return {
        id,
        name,
        plantType,
        plantGroup: normalizePlantGroup(item.plantGroup, plantType, name),
        description: normalizeText(item.description, "", 500),
        imageBackgroundColor: normalizeHexColor(item.imageBackgroundColor, "#c88f44"),
        imagePromptDescription: normalizeText(item.imagePromptDescription, "", 600),
        waterNeed: ["low", "moderate", "high"].includes(item.waterNeed) ? item.waterNeed : "",
        soilMoisture: ["dry-between", "evenly-moist", "moist"].includes(item.soilMoisture) ? item.soilMoisture : "",
        developmentTime: normalizeText(item.developmentTime, "", 120),
        image: normalizeImageReference(item.image, ""),
        productName: normalizeText(item.productName, "", 120),
        manufacturer: normalizeText(item.manufacturer, "", 80),
        articleNumber: normalizeText(item.articleNumber, "", 80),
        sourceUrl: normalizeExternalUrl(item.sourceUrl),
        sourceProductId: normalizeText(item.sourceProductId, "", 120),
        sourceImageUrl: normalizeExternalUrl(item.sourceImageUrl),
        productData: normalizeSupplierProductData(item.productData),
      };
    })
    .filter(Boolean);

  return normalized.length ? normalized : DEFAULT_PLANT_LIBRARY;
}

function normalizeExternalUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url.slice(0, 1200) : "";
}

function normalizeSupplierProductData(value) {
  const input = value && typeof value === "object" ? value : {};
  const rows = (items) => (Array.isArray(items) ? items : []).slice(0, 40).map((item) => ({
    label: normalizeText(item?.label, "", 100), value: normalizeText(item?.value, "", 300),
  })).filter((item) => item.label && item.value);
  return {
    baseArticleNumber: normalizeText(input.baseArticleNumber, "", 80),
    ean: normalizeText(input.ean, "", 40),
    latinName: normalizeText(input.latinName, "", 180),
    attributes: rows(input.attributes),
    cultivation: rows(input.cultivation),
  };
}

function normalizePlantSeasons(seasons, library, legacyPlants, activeYear) {
  const input = seasons && typeof seasons === "object" ? seasons : {};
  const normalized = {};

  for (const [yearKey, entries] of Object.entries(input)) {
    const year = normalizePlantYear(yearKey, activeYear);
    normalized[String(year)] = (Array.isArray(entries) ? entries : [])
      .map((entry, index) => normalizePlantSeasonEntry(entry, library, year, index))
      .filter(Boolean);
  }

  if (Object.keys(normalized).length === 0) {
    const legacy = normalizePlants(legacyPlants);
    normalized[String(activeYear)] = legacy.map((plant, index) => ({
      id: `${plant.id}-${activeYear}-${index}`,
      year: activeYear,
      libraryId: plant.id,
      acquisition: "plant",
      seedDate: "",
      seedLocation: "",
      greenhouseDate: "",
      purchaseSource: "",
      finished: false,
      finishReason: "",
      harvestDate: "",
      plantingPlace: plant.plantingPlace,
      active: plant.active,
      note: plant.note,
    }));
  }

  for (const key of Object.keys(normalized)) {
    normalized[key] = normalized[key].filter((entry) => library.some((plant) => plant.id === entry.libraryId));
  }

  return normalized;
}

function normalizePlantSeasonEntry(entry, library, year, index) {
  const item = entry && typeof entry === "object" ? entry : {};
  const fallbackLibraryId = library[index]?.id || library[0]?.id || "";
  const libraryId = normalizeText(item.libraryId || item.id, fallbackLibraryId, 80);
  if (!libraryId) return null;
  const harvestDate = normalizeDateOnly(item.harvestDate);
  const finished = typeof item.finished === "boolean" ? item.finished : Boolean(harvestDate);
  const inferredLocation = item.greenhouseDate ? "greenhouse" : item.seedLocation === "Innendørs" ? "indoor" : item.seedLocation === "Utendørs" ? "outdoor" : item.seedLocation === "Drivhus" ? "greenhouse" : "";
  const allowedStages = ["new", "germinating", "growing", "budding", "flowering", "fruit-set", "fruit-growing", "ripening", "harvest-ready", "post-flowering"];
  const observations = (Array.isArray(item.observations) ? item.observations : []).map((value, observationIndex) => {
    const row = value && typeof value === "object" ? value : {};
    const stage = allowedStages.includes(row.stage) ? row.stage : "";
    const date = normalizeDateOnly(row.date);
    if (!stage || !date) return null;
    const growingLocation = ["indoor", "greenhouse", "outdoor"].includes(row.growingLocation) ? row.growingLocation : inferredLocation;
    return { id: normalizeText(row.id, `${libraryId}-${date}-${observationIndex}`, 100), date, stage, note: normalizeText(row.note, "", 120), growingLocation, growingMedium: normalizeText(row.growingMedium, normalizeText(item.plantingPlace, "", 120), 120) };
  }).filter(Boolean);
  if (observations.length === 0 && allowedStages.includes(item.developmentStage) && normalizeDateOnly(item.observedAt)) {
    const legacyLocation = item.greenhouseDate ? "greenhouse" : item.seedLocation === "Innendørs" ? "indoor" : item.seedLocation === "Utendørs" ? "outdoor" : item.seedLocation === "Drivhus" ? "greenhouse" : "";
    observations.push({ id: `${libraryId}-${item.observedAt}-legacy`, date: normalizeDateOnly(item.observedAt), stage: item.developmentStage, note: normalizeText(item.observation, "", 120), growingLocation: legacyLocation, growingMedium: normalizeText(item.plantingPlace, "", 120) });
  }
  observations.sort((a, b) => a.date.localeCompare(b.date));
  const latestObservation = observations.at(-1);
  return {
    id: normalizeText(item.id, `${libraryId}-${year}-${index}`, 100),
    year,
    libraryId,
    acquisition: item.acquisition === "seed" ? "seed" : "plant",
    seedDate: normalizeDateOnly(item.seedDate),
    seedLocation: SEED_LOCATION_OPTIONS.includes(item.seedLocation) ? item.seedLocation : "",
    greenhouseDate: normalizeDateOnly(item.greenhouseDate),
    purchaseSource: normalizeText(item.purchaseSource, "", 160),
    finished,
    finishReason: finished && item.finishReason === "moved-out" ? "moved-out" : finished ? "season-over" : "",
    harvestDate,
    plantingPlace: normalizeText(item.plantingPlace, "", 120),
    growingLocation: ["indoor", "greenhouse", "outdoor"].includes(item.growingLocation) ? item.growingLocation : (item.greenhouseDate ? "greenhouse" : item.seedLocation === "Innendørs" ? "indoor" : item.seedLocation === "Utendørs" ? "outdoor" : item.seedLocation === "Drivhus" ? "greenhouse" : ""),
    developmentStage: latestObservation?.stage || (allowedStages.includes(item.developmentStage) ? item.developmentStage : ""),
    observedAt: latestObservation?.date || normalizeDateOnly(item.observedAt),
    observation: latestObservation?.note || normalizeText(item.observation, "", 120),
    observations,
    active: typeof item.active === "boolean" ? item.active : true,
    note: normalizeText(item.note, "", 360),
  };
}

function normalizeDateOnly(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function derivePlantsFromSeason(library, season) {
  const byId = new Map(library.map((plant) => [plant.id, plant]));
  return season.map((entry) => {
    const plant = byId.get(entry.libraryId);
    if (!plant) return null;
    return {
      id: entry.id,
      name: plant.name,
      plantType: plant.plantType,
      plantingPlace: entry.plantingPlace,
      active: entry.active,
      note: entry.note,
      image: plant.image,
    };
  }).filter(Boolean);
}

function normalizePlants(plants) {
  const input = Array.isArray(plants) ? plants : [];
  const normalized = input
    .map((plant, index) => {
      const item = plant && typeof plant === "object" ? plant : {};
      const name = normalizeText(item.name, "", 80);
      if (!name) return null;
      return {
        id: normalizeText(item.id, slugifyPlantName(name) || `plante-${index + 1}`, 80),
        name,
        plantType: normalizeText(item.plantType, "", 80),
        plantingPlace: normalizeText(item.plantingPlace, "", 80),
        active: typeof item.active === "boolean" ? item.active : true,
        note: normalizeText(item.note, "", 240),
        image: normalizeImageReference(item.image, ""),
      };
    })
    .filter(Boolean);

  return normalized.length ? normalized : DEFAULT_SITE_CONFIG.plants;
}

function normalizePlantAnalysisTheme(theme) {
  const input = theme && typeof theme === "object" ? theme : {};
  return {
    light: normalizePlantAnalysisThemeMode(input.light, DEFAULT_SITE_CONFIG.plantAnalysisTheme.light),
    dark: normalizePlantAnalysisThemeMode(input.dark, DEFAULT_SITE_CONFIG.plantAnalysisTheme.dark),
  };
}

function normalizePlantAnalysisThemeMode(value, fallback) {
  const input = value && typeof value === "object" ? value : {};
  return {
    cardBg: normalizeHexColor(input.cardBg, fallback.cardBg),
    cardBorder: normalizeHexColor(input.cardBorder, fallback.cardBorder),
    titleColor: normalizeHexColor(input.titleColor, fallback.titleColor),
    ingressColor: normalizeHexColor(input.ingressColor, fallback.ingressColor),
    watchTextColor: normalizeHexColor(input.watchTextColor, fallback.watchTextColor),
    thrivingPillBg: normalizeHexColor(input.thrivingPillBg, fallback.thrivingPillBg),
    watchPillBg: normalizeHexColor(input.watchPillBg, fallback.watchPillBg),
    stressPillBg: normalizeHexColor(input.stressPillBg, fallback.stressPillBg),
    pillTextColor: normalizeHexColor(input.pillTextColor, fallback.pillTextColor),
  };
}

function slugifyPlantName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDisplayImageConfig(value, fallback) {
  const input = value && typeof value === "object" ? value : {};
  return {
    image: normalizeImageReference(input.image, fallback.image),
    binary: normalizeImageReference(input.binary, fallback.binary),
    source: normalizeImageReference(input.source, fallback.source),
    zoom: normalizeFloat(input.zoom, fallback.zoom, 0.6, 3),
    offsetX: normalizeNumber(input.offsetX, fallback.offsetX, -2000, 2000),
    offsetY: normalizeNumber(input.offsetY, fallback.offsetY, -2000, 2000),
    size: 466,
    width: 164,
    height: 466,
    x: 302,
    y: 0,
  };
}

function normalizeDisplayThemeConfig(value, fallback) {
  const input = value && typeof value === "object" ? value : {};
  return {
    dark: normalizeDisplayThemeModeConfig(input.dark, fallback.dark),
    light: normalizeDisplayThemeModeConfig(input.light, fallback.light),
  };
}

function normalizeDisplayThemeModeConfig(value, fallback) {
  const input = value && typeof value === "object" ? value : {};
  return {
    labelColor: normalizeHexColor(input.labelColor, fallback.labelColor),
    labelOpacity: normalizeFloat(input.labelOpacity, fallback.labelOpacity, 0, 1),
    unitColor: normalizeHexColor(input.unitColor, fallback.unitColor),
    defaultValueColor: normalizeHexColor(input.defaultValueColor, fallback.defaultValueColor),
    temperatureValueColor: normalizeHexColor(input.temperatureValueColor, fallback.temperatureValueColor),
    normalTemperatureColor: normalizeHexColor(input.normalTemperatureColor, fallback.normalTemperatureColor),
    coldTemperatureColor: normalizeHexColor(input.coldTemperatureColor, fallback.coldTemperatureColor),
    warmTemperatureColor: normalizeHexColor(input.warmTemperatureColor, fallback.warmTemperatureColor),
    hotTemperatureColor: normalizeHexColor(input.hotTemperatureColor, fallback.hotTemperatureColor),
    coldPulseColor: normalizeHexColor(input.coldPulseColor, fallback.coldPulseColor),
    hotPulseColor: normalizeHexColor(input.hotPulseColor, fallback.hotPulseColor),
    warningPulseColor: normalizeHexColor(input.warningPulseColor, fallback.warningPulseColor),
    coldTickerColor: normalizeHexColor(input.coldTickerColor, fallback.coldTickerColor),
    hotTickerColor: normalizeHexColor(input.hotTickerColor, fallback.hotTickerColor),
    mutedColor: normalizeHexColor(input.mutedColor, fallback.mutedColor),
    symbolColor: normalizeHexColor(input.symbolColor, fallback.symbolColor),
    graphPanelBg: normalizeHexColor(input.graphPanelBg, fallback.graphPanelBg),
    graphPanelBorder: normalizeHexColor(input.graphPanelBorder, fallback.graphPanelBorder),
    logoColor: normalizeHexColor(input.logoColor, fallback.logoColor),
    doorIconColor: normalizeOptionalHexColor(input.doorIconColor, fallback.doorIconColor),
    windowIconColor: normalizeOptionalHexColor(input.windowIconColor, fallback.windowIconColor),
    fanIconColor: normalizeOptionalHexColor(input.fanIconColor, fallback.fanIconColor),
  };
}

function normalizeImageReference(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("/")) return raw;
  if (isAllowedImageKey(raw)) return `/api/site-image?key=${encodeURIComponent(raw)}`;
  return fallback;
}

function normalizeText(value, fallback, maxLength) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  return raw ? raw.slice(0, maxLength) : fallback;
}

function normalizeSummaryText(value, fallback, maxLength) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  if (raw.length <= maxLength) return raw;

  const clipped = raw.slice(0, maxLength);
  const sentenceEnd = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("! "), clipped.lastIndexOf("? "));
  if (sentenceEnd > 120) return clipped.slice(0, sentenceEnd + 1).trim();
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 120 ? lastSpace : maxLength).trim()}...`;
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
}

function normalizeOptionalHexColor(value, fallback) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback || "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback || "";
}

function normalizeNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function normalizeFloat(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function isAllowedImageKey(key) {
  return typeof key === "string" && key.startsWith(ADMIN_IMAGE_PREFIX) && !key.includes("..");
}

function isAllowedUploadType(assetType, contentType, format) {
  if (assetType === "logo") return contentType === "image/svg+xml";
  if (assetType === "favicon") return contentType === "image/svg+xml" || contentType === "image/png";
  if (assetType === "plant-image") return ["image/jpeg", "image/png"].includes(contentType) && format === "square";
  if (assetType === "header-video") return contentType === "video/mp4" && format === "mobile-video";
  if (assetType === "display-image") {
    return (
      (contentType === "image/png" && ["display-164x466", "round-466"].includes(format)) ||
      (contentType === "application/octet-stream" && format === "display-rgb565-164x466")
    );
  }
  return ["image/jpeg", "image/png"].includes(contentType) && ["desktop", "mobile", "image"].includes(format);
}

function getUploadExtension(contentType) {
  if (contentType === "image/svg+xml") return "svg";
  if (contentType === "image/png") return "png";
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "application/octet-stream") return "bin";
  return "jpg";
}

function sanitizeKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "general";
}

function sanitizeFilename(value) {
  return String(value || "image")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 96) || "image";
}

function getFilenameExtension(filename) {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

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

async function handleIngest(request, env, corsHeaders, ctx) {
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
        error: "Unknown sensor. Supported values: temperature, humidity, rain_today, rain_hour, door, fan, heating, window",
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

    ctx?.waitUntil(refreshStats24hCache(env));
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

async function handleGetDisplayLog(env, corsHeaders) {
  const page = await env.GREENHOUSE_DATA.list({
    prefix: DISPLAY_LOG_PREFIX,
    limit: 1000,
  });
  const entries = await Promise.all(page.keys.map((key) => env.GREENHOUSE_DATA.get(key.name, "json")));
  const legacyLog = (await env.GREENHOUSE_DATA.get(DISPLAY_LOG_KEY, "json")) || [];
  const data = [...(Array.isArray(legacyLog) ? legacyLog : []), ...entries.filter(Boolean)]
    .sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")))
    .slice(-DISPLAY_LOG_MAX_ENTRIES);

  return jsonResponse({ ok: true, data }, 200, corsHeaders);
}

async function handlePostDisplayLog(request, env, corsHeaders) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400, corsHeaders);
  }

  const body = await request.json().catch(() => null);
  const message = String(body?.message || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (!message) {
    return jsonResponse({ ok: false, error: "Missing message" }, 400, corsHeaders);
  }

  const entry = {
    timestamp: new Date().toISOString(),
    device: String(body?.device || "esp32-display").slice(0, 64),
    message,
  };
  const random = crypto.randomUUID();
  await env.GREENHOUSE_DATA.put(`${DISPLAY_LOG_PREFIX}${entry.timestamp}:${random}`, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 7,
  });

  return jsonResponse({ ok: true }, 200, corsHeaders);
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

async function getCachedWeather(env, ctx) {
  const cached = await env.GREENHOUSE_DATA.get(WEATHER_CACHE_KEY, "json");
  const cachedAt = cached?.cachedAt ? new Date(cached.cachedAt).getTime() : 0;
  const hasForecast = Array.isArray(cached?.forecastToday) && cached.forecastToday.length >= 9;
  const isFresh = cachedAt && hasForecast && Date.now() - cachedAt < WEATHER_CACHE_MAX_AGE_MS;

  if (cached && isFresh) return cached;

  if (cached && hasForecast) {
    ctx?.waitUntil?.(refreshWeatherCache(env).catch((error) => console.error("Failed to refresh weather cache", error)));
    return cached;
  }

  return refreshWeatherCache(env);
}

async function refreshWeatherCache(env) {
  const weather = await fetchWeatherSnapshot();
  const cachedWeather = {
    ...weather,
    cachedAt: new Date().toISOString(),
  };

  await env.GREENHOUSE_DATA.put(WEATHER_CACHE_KEY, JSON.stringify(cachedWeather));
  return cachedWeather;
}

async function fetchWeatherSnapshot() {
  const yrRes = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${WEATHER_LATITUDE}&lon=${WEATHER_LONGITUDE}`,
    {
      headers: {
        "User-Agent": "KristinsDrivhus/1.0 drivhus.danaksel.no",
      },
    }
  );

  if (!yrRes.ok) {
    throw new Error(`Weather API error: ${yrRes.status}`);
  }

  const yrJson = await yrRes.json();
  const current = yrJson.properties?.timeseries?.[0];

  if (!current) {
    throw new Error("No weather data available");
  }

  const updatedAtString = yrJson.properties?.meta?.updated_at;
  const updatedAt = normalizeIsoDate(updatedAtString) ?? new Date().toISOString();
  const timeseries = Array.isArray(yrJson.properties?.timeseries) ? yrJson.properties.timeseries : [];
  const rawSymbolCode =
    current.data?.next_1_hours?.summary?.symbol_code ||
    current.data?.next_6_hours?.summary?.symbol_code ||
    "cloudy";
  const baseSymbol = rawSymbolCode.split("_polarlight")[0].split("_polartwilight")[0];
  const details = current.data?.instant?.details || {};
  const temperature = typeof details.air_temperature === "number" ? details.air_temperature : 0;
  const hasFog =
    (details.fog_area_fraction !== undefined && details.fog_area_fraction > 0.5) ||
    (details.visibility !== undefined && details.visibility < 1000) ||
    baseSymbol.includes("fog");
  const symbolCode = hasFog ? "fog" : baseSymbol;
  let description = WEATHER_DESCRIPTIONS[baseSymbol] || WEATHER_DESCRIPTIONS[rawSymbolCode] || `Ukjent (${baseSymbol})`;

  if (hasFog) {
    if (baseSymbol === "cloudy") {
      description = "Overskyet med tåke";
    } else if (baseSymbol.includes("partlycloudy")) {
      description = "Delvis skyet med tåke";
    } else if (!baseSymbol.includes("fog")) {
      description = `${description} og tåke`;
    }
  }

  let uvIndex;
  try {
    const uvRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LATITUDE}&longitude=${WEATHER_LONGITUDE}&current=uv_index`
    );

    if (uvRes.ok) {
      const uvJson = await uvRes.json();
      if (typeof uvJson.current?.uv_index === "number") {
        uvIndex = uvJson.current.uv_index;
      }
    }
  } catch (error) {
    console.warn("Failed to fetch UV data from Open-Meteo", error);
  }

  return {
    temperature,
    symbolCode,
    description,
    updatedAt,
    uvIndex,
    forecastToday: compactWeatherForecastToday(timeseries),
  };
}

function compactWeatherForecastToday(timeseries) {
  const now = new Date();
  const entries = [];

  for (const item of timeseries) {
    const time = new Date(item?.time);
    if (Number.isNaN(time.getTime()) || time < now) continue;

    const details = item.data?.instant?.details || {};
    const rawSymbol =
      item.data?.next_1_hours?.summary?.symbol_code ||
      item.data?.next_6_hours?.summary?.symbol_code ||
      "";
    const baseSymbol = rawSymbol.split("_polarlight")[0].split("_polartwilight")[0];
    const precipitation =
      numberOrNull(item.data?.next_1_hours?.details?.precipitation_amount) ??
      numberOrNull(item.data?.next_6_hours?.details?.precipitation_amount);

    entries.push({
      time: formatTimeLabel(time),
      outdoorTemperature: numberOrNull(details.air_temperature),
      precipitation,
      symbolCode: baseSymbol || rawSymbol,
      description: WEATHER_DESCRIPTIONS[baseSymbol] || WEATHER_DESCRIPTIONS[rawSymbol] || baseSymbol || rawSymbol || "ukjent",
    });

    if (entries.length >= 10) break;
  }

  return entries;
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getLatest(env) {
  const [temperatureEntry, humidityEntry, rainTodayEntry, rainHourEntry, doorEntry, fanEntry, heatingEntry, windowEntry] = await Promise.all([
    env.GREENHOUSE_DATA.get("latest:temperature", "json"),
    env.GREENHOUSE_DATA.get("latest:humidity", "json"),
    env.GREENHOUSE_DATA.get("latest:rain_today", "json"),
    env.GREENHOUSE_DATA.get("latest:rain_hour", "json"),
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
    rainHour: rainHourEntry?.value ?? null,
    rainHourUpdatedAt: rainHourEntry?.timestamp ?? null,
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
                maxIsoDate(
                  rainTodayEntry?.timestamp ?? null,
                  rainHourEntry?.timestamp ?? null
                )
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

async function monitorDataHealth(env) {
  const latest = await getLatest(env);
  const health = buildDataHealth(latest);
  const previous = await env.GREENHOUSE_DATA.get(DATA_HEALTH_STATE_KEY, "json");
  const isActive = health.status !== "ok";
  const wasActive = previous?.active === true;
  const affectedSensorsChanged =
    JSON.stringify(previous?.affectedSensors || []) !== JSON.stringify(health.affectedSensors);
  const alertChanged =
    isActive &&
    wasActive &&
    (previous?.status !== health.status || affectedSensorsChanged);
  const hasTransition = isActive !== wasActive || alertChanged;
  const state = {
    ...health,
    active: isActive,
    activeSince: isActive
      ? wasActive
        ? previous.activeSince
        : health.alertStartedAt || health.checkedAt
      : null,
    lastTransitionAt:
      hasTransition
        ? health.checkedAt
        : previous?.lastTransitionAt || health.checkedAt,
    recoveredAt:
      !isActive && wasActive
        ? health.checkedAt
        : previous?.recoveredAt || null,
  };

  if (isActive && !wasActive) {
    console.warn(
      "Greenhouse sensor data alert",
      JSON.stringify({
        event: "greenhouse_data_stale",
        status: health.status,
        affectedSensors: health.affectedSensors,
        sensors: health.sensors,
        activeSince: state.activeSince,
      }),
    );
  } else if (alertChanged) {
    console.warn(
      "Greenhouse sensor data alert changed",
      JSON.stringify({
        event: "greenhouse_data_alert_changed",
        previousStatus: previous.status,
        status: health.status,
        affectedSensors: health.affectedSensors,
        sensors: health.sensors,
        activeSince: state.activeSince,
      }),
    );
  } else if (!isActive && wasActive) {
    console.info(
      "Greenhouse sensor data recovered",
      JSON.stringify({
        event: "greenhouse_data_recovered",
        recoveredAt: state.recoveredAt,
        previousActiveSince: previous.activeSince || null,
      }),
    );
  }

  await env.GREENHOUSE_DATA.put(DATA_HEALTH_STATE_KEY, JSON.stringify(state));
  return state;
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

async function getCachedStats24h(env, ctx) {
  const cached = await env.GREENHOUSE_DATA.get(STATS_24H_CACHE_KEY, "json");
  if (isFreshCache(cached, STATS_24H_CACHE_MAX_AGE_MS)) {
    return cached.data;
  }

  if (cached?.data) {
    ctx?.waitUntil(refreshStats24hCache(env));
    return cached.data;
  }

  return refreshStats24hCache(env);
}

async function refreshStats24hCache(env) {
  const data = await getStats24h(env);
  await env.GREENHOUSE_DATA.put(
    STATS_24H_CACHE_KEY,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      data,
    }),
    { expirationTtl: 60 * 60 }
  );
  return data;
}

function isFreshCache(cached, maxAgeMs) {
  if (!cached?.updatedAt) return false;
  const updatedAt = new Date(cached.updatedAt).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < maxAgeMs;
}

async function getDisplayStats(env) {
  const now = new Date();
  const since = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const [temperatureEntries, humidityEntries] = await Promise.all([
    listSensorHistoryEntries(env, "temperature", since),
    listSensorHistoryEntries(env, "humidity", since),
  ]);

  return {
    hours: 12,
    intervalMinutes: 30,
    temperature: aggregateDisplaySeries(temperatureEntries, since, now, 30),
    humidity: aggregateDisplaySeries(humidityEntries, since, now, 30),
  };
}

async function handlePlantAnalysis(env, corsHeaders) {
  try {
    const analysis = await generatePlantAnalysis(env);
    await env.GREENHOUSE_DATA.put(PLANT_ANALYSIS_KEY, JSON.stringify(analysis));
    await recordPlantAnalysisRun(env, analysis, "manual");
    return jsonResponse({ ok: true, data: analysis }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Kunne ikke lage planteanalyse." },
      error?.statusCode || 502,
      corsHeaders
    );
  }
}

async function handleGetPlantAnalysis(env, corsHeaders) {
  const analysis = await env.GREENHOUSE_DATA.get(PLANT_ANALYSIS_KEY, "json");
  if (!analysis) {
    return jsonResponse({ ok: true, data: null }, 200, corsHeaders);
  }

  return jsonResponse({ ok: true, data: analysis }, 200, corsHeaders);
}

async function refreshDailyPlantAnalysisIfDue(env) {
  const now = new Date();
  const config = await getSiteConfig(env);
  if (config.plantAnalysisSchedule?.enabled === false) return;
  const osloParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const parts = Object.fromEntries(osloParts.map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const [scheduledHour, scheduledMinute] = String(config.plantAnalysisSchedule?.time || "06:00").split(":").map(Number);

  if (hour !== scheduledHour || minute !== scheduledMinute) return;

  const lastRun = await env.GREENHOUSE_DATA.get(PLANT_ANALYSIS_DAILY_KEY);
  if (lastRun === today) return;

  try {
    const analysis = await generatePlantAnalysis(env);
    await Promise.all([
      env.GREENHOUSE_DATA.put(PLANT_ANALYSIS_KEY, JSON.stringify(analysis)),
      env.GREENHOUSE_DATA.put(PLANT_ANALYSIS_DAILY_KEY, today),
      recordPlantAnalysisRun(env, analysis, "scheduled"),
    ]);
  } catch (error) {
    console.error("Failed to refresh daily plant analysis", error);
  }
}

async function recordPlantAnalysisRun(env, analysis, trigger) {
  const prices = {
    "gpt-5.5": { input: 5, output: 30 },
    "gpt-5.4": { input: 2.5, output: 15 },
    "gpt-5.4-mini": { input: 0.75, output: 4.5 },
    "gpt-5-mini": { input: 0.25, output: 2 },
  };
  const model = analysis.model || "gpt-5.4-mini";
  const usage = analysis.runUsage || analysis.usage || {};
  const inputTokens = numberOrNull(usage.inputTokens) || 0;
  const outputTokens = numberOrNull(usage.outputTokens) || 0;
  const rate = prices[model];
  const costUsd = rate ? (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000 : null;
  const entry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(), trigger, model,
    reason: analysis.refresh?.reason || "unknown",
    detail: analysis.refresh?.detail || "",
    analyzedPlants: analysis.refresh?.analyzedPlants || 0,
    reusedPlants: analysis.refresh?.reusedPlants || 0,
    inputTokens, outputTokens, totalTokens: inputTokens + outputTokens,
    estimatedCostUsd: costUsd,
    estimatedCostNok: costUsd === null ? null : costUsd * 10.5,
    nokRate: costUsd === null ? null : 10.5,
  };
  const history = (await env.GREENHOUSE_DATA.get(PLANT_ANALYSIS_HISTORY_KEY, "json")) || [];
  await env.GREENHOUSE_DATA.put(PLANT_ANALYSIS_HISTORY_KEY, JSON.stringify([entry, ...history].slice(0, 100)));
}

async function generatePlantAnalysis(env) {
  if (!env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY mangler i Cloudflare Worker secrets.");
    error.statusCode = 503;
    throw error;
  }

  const config = await getSiteConfig(env);
  const analysisModel = env.OPENAI_MODEL || config.plantAnalysisModel || "gpt-5.4-mini";
  const now = new Date();
  const activeYear = config.activePlantSeasonYear || 2026;
  const libraryById = new Map((config.plantLibrary || []).map((plant) => [plant.id, plant]));
  const seasonEntries = (config.plantSeasons?.[String(activeYear)] || []);
  const plants = seasonEntries
    .filter((entry) => entry.active && !isPlantSeasonFinished(entry, now))
    .map((entry) => {
      const library = libraryById.get(entry.libraryId);
      if (!library) return null;
      const history = Object.entries(config.plantSeasons || {})
        .flatMap(([year, entries]) => (entries || [])
          .filter((season) => season.libraryId === entry.libraryId && Number(year) !== activeYear)
          .map((season) => ({ year: Number(year), ...season })));
      return { ...entry, ...library, seasonId: entry.id, libraryId: library.id, history: compactPlantHistory(history) };
    })
    .filter(Boolean);

  if (plants.length === 0) {
    const error = new Error("Ingen aktive planter er satt opp i admin.");
    error.statusCode = 400;
    throw error;
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [latest, stats24h, weather, temperatureEntries, humidityEntries] = await Promise.all([
    getLatest(env),
    getCachedStats24h(env),
    getCachedWeather(env, null).catch(() => null),
    listSensorHistoryEntries(env, "temperature", since),
    listSensorHistoryEntries(env, "humidity", since),
  ]);

  const climate = buildPlantClimateProfile(stats24h, weather, temperatureEntries, humidityEntries, latest);
  const plantPayloads = plants.map((plant) => ({
    id: plant.seasonId,
    name: plant.name,
    type: plant.plantType,
    group: plant.plantGroup,
    loc: plant.growingLocation,
    place: plant.plantingPlace,
    note: plant.note,
    acq: plant.acquisition,
    bought: plant.purchaseSource,
    life: [
      ...(plant.acquisition === "seed" && plant.seedDate ? [{ d: plant.seedDate, e: "seeded", l: plant.seedLocation }] : []),
      ...(plant.greenhouseDate ? [{ d: plant.greenhouseDate, e: "greenhouse", m: plant.plantingPlace }] : []),
      ...(plant.observations || []).map((entry) => ({ d: entry.date, e: entry.stage, l: entry.growingLocation, m: entry.growingMedium, n: entry.note })),
      ...(plant.finished && plant.harvestDate ? [{ d: plant.harvestDate, e: "finished" }] : []),
    ].sort((a, b) => String(a.d).localeCompare(String(b.d))),
    hist: plant.history,
  }));
  const previousAnalysis = await env.GREENHOUSE_DATA.get(PLANT_ANALYSIS_KEY, "json");
  const climateFingerprint = await hashAnalysisInput({ v: PLANT_ANALYSIS_PROMPT_VERSION, climate: fingerprintPlantClimate(climate) });
  const plantFingerprints = Object.fromEntries(await Promise.all(plantPayloads.map(async (plant) => [plant.id, await hashAnalysisInput(plant)])));
  const previousClimateFingerprint = previousAnalysis?.fingerprints?.climate || "";
  const previousPlantFingerprints = previousAnalysis?.fingerprints?.plants || {};
  const climateChanged = !previousAnalysis || previousClimateFingerprint !== climateFingerprint;
  const previousRunAt = new Date(previousAnalysis?.generatedAt || 0).getTime();
  const climateCooldownActive = Number.isFinite(previousRunAt) && now.getTime() - previousRunAt < PLANT_ANALYSIS_CLIMATE_COOLDOWN_MS;
  const climateRisk = getPlantClimateRisk(climate);
  const previousClimateRisk = previousAnalysis?.climateRisk || {};
  const newCriticalRisk = climateRisk.critical && !previousClimateRisk.critical;
  const modelChanged = Boolean(previousAnalysis) && previousAnalysis.model !== analysisModel;
  const climateRequiresFullAnalysis = climateChanged && (!climateCooldownActive || newCriticalRisk);
  const analyzeAll = !previousAnalysis || modelChanged || climateRequiresFullAnalysis;
  const plantsToAnalyze = analyzeAll ? plants : plants.filter((plant) => previousPlantFingerprints[plant.seasonId] !== plantFingerprints[plant.seasonId]);
  const refreshReason = !previousAnalysis ? "initial" : modelChanged ? "model" : climateRequiresFullAnalysis ? "climate" : plantsToAnalyze.length ? "plant-data" : "unchanged";
  const refreshDetail = modelChanged
    ? `Modell endret til ${analysisModel}`
    : climateRequiresFullAnalysis
      ? (newCriticalRisk ? "Ny kritisk klimaterskel" : "Klimaprofil endret etter 12 timers sperre")
      : climateChanged && climateCooldownActive
        ? "Klimaendring utsatt av 12 timers sperre"
        : plantsToAnalyze.length ? "Plantedata eller observasjon endret" : "Ingen relevante endringer";

  if (plantsToAnalyze.length === 0 && previousAnalysis) {
    return { ...previousAnalysis, runUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, refresh: { reason: refreshReason, detail: refreshDetail, analyzedPlants: 0, reusedPlants: plants.length } };
  }
  const selectedIds = new Set(plantsToAnalyze.map((plant) => plant.seasonId));

  const payload = {
    gen: now.toISOString(),
    month: getNorwegianMonth(now),
    season: getNorwegianSeason(now),
    year: activeYear,
    climate,
    gh: {
      notes: config.plantAnalysisNotes,
    },
    plants: plantPayloads.filter((plant) => selectedIds.has(plant.id)),
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: analysisModel,
      reasoning: { effort: "low" },
      text: { format: {
        type: "json_schema",
        name: "greenhouse_plant_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["generatedAt", "month", "season", "items"],
          properties: {
            generatedAt: { type: "string" },
            month: { type: "string" },
            season: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "status", "assessment", "watering", "development"],
                properties: {
                  id: { type: "string" },
                  status: { type: "string", enum: ["trives", "følg med", "stress"] },
                  assessment: { type: "string" },
                  watering: { type: "string" },
                  development: {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "text"],
                    properties: {
                      type: { type: "string", enum: ["ripening", "flowering", "harvest"] },
                      text: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      } },
      instructions:
        "Du er en kunnskapsrik og vennlig norsk gartner og veksthusrådgiver. Lag korte, praktiske plantevurderinger basert på temperatur og luftfuktighet siste 24 timer, værprognose, måned, årstid og oppgitte plantedata. Ikke gi bastante diagnoser. Ikke gjenta plantenavnet i plantefeltene. Skriv naturlig, hyggelig og presist. Returner bare gyldig JSON.",
      input:
        "Returner JSON nøyaktig på denne formen: {\"generatedAt\":\"ISO\",\"month\":\"juli\",\"season\":\"sommer\",\"items\":[{\"id\":\"samme id som input\",\"status\":\"trives|følg med|stress\",\"assessment\":\"maks 18 ord\",\"watering\":\"maks 16 ord\",\"development\":{\"type\":\"ripening|flowering|harvest\",\"text\":\"maks 12 ord\"}}]}. " +
        "Det må være ett item per inputplante, med helt identisk id. Assessment beskriver bare viktigste tilstand eller risiko. Watering gir ett konkret vanningsråd. Ikke start tekst med plantenavn eller etiketter. Development er obligatorisk og skal bare angi et konkret tidsvindu, for eksempel 'slutten av juli til midten av august'. Det skal aldri inneholde stellråd eller handlinger. Registrert utviklingsstadium og observasjonsdato er viktigste grunnlag for tidsanslaget. Anslå ellers nøkternt fra art/sort, så-/plantedato, utviklingstid, sesong og temperatur; skriv 'Kan ikke anslås fra registrerte data' bare når et faglig anslag er umulig. Bruk flowering for Blomst, harvest for Urte og Grønnsak, ripening for Frukt. " +
        "Climate er en terskelbasert profil for hele drivhuset. Feltmap: type=plantType,group=plantGroup,place=currentGrowingMedium,loc=currentGrowingLocation,life=chronologicalLifecycle(d=date,e=event,l=location,m=medium,n=note),hist=kompakt tidligere sesong. Data:\n" +
        JSON.stringify(payload),
      max_output_tokens: Math.min(1800, 260 + plantsToAnalyze.length * 85),
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error?.message || `OpenAI API svarte ${response.status}`);
  }

  const text = extractOpenAIText(result);
  let parsed;
  try {
    parsed = parseJsonObjectFromOpenAIText(text);
  } catch {
    throw new Error("OpenAI svarte ikke med gyldig JSON.");
  }

  const freshAnalysis = normalizePlantAnalysis(parsed, payload, plantsToAnalyze, result?.usage);
  const freshById = new Map(freshAnalysis.items.map((item) => [item.id, item]));
  const previousById = new Map((previousAnalysis?.items || []).map((item) => [item.id, item]));
  return {
    ...freshAnalysis,
    items: plants.map((plant) => freshById.get(plant.seasonId) || previousById.get(plant.seasonId)).filter(Boolean),
    fingerprints: { climate: analyzeAll ? climateFingerprint : previousClimateFingerprint, plants: plantFingerprints },
    model: analysisModel,
    runUsage: freshAnalysis.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    climateRisk: analyzeAll ? climateRisk : previousClimateRisk,
    refresh: {
      reason: refreshReason,
      detail: refreshDetail,
      analyzedPlants: plantsToAnalyze.length,
      reusedPlants: plants.length - plantsToAnalyze.length,
    },
  };
}

function isPlantSeasonFinished(entry, now = new Date()) {
  if (entry?.finished === true) return true;
  const raw = String(entry?.harvestDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const finishedAt = new Date(`${raw}T23:59:59`);
  return Number.isFinite(finishedAt.getTime()) && finishedAt <= now;
}

function extractOpenAIText(result) {
  if (typeof result?.output_text === "string") return result.output_text;
  const chunks = [];
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n");
}

function parseJsonObjectFromOpenAIText(text) {
  const raw = String(text || "").trim();
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }
    throw new Error("No JSON object found");
  }
}

function normalizePlantAnalysis(parsed, payload, plants, usage) {
  const allowedStatuses = new Set(["trives", "følg med", "stress"]);
  const items = Array.isArray(parsed?.items)
    ? parsed.items
    : Array.isArray(parsed?.plants)
      ? parsed.plants
      : Array.isArray(parsed?.analysis)
        ? parsed.analysis
        : Array.isArray(parsed?.plantAnalysis)
          ? parsed.plantAnalysis
          : [];
  const normalizeKey = (value) => String(value || "").trim().toLowerCase();
  const byId = new Map(items.map((item) => [normalizeKey(item?.id), item]).filter(([key]) => key));
  const byLibraryId = new Map(items.map((item) => [normalizeKey(item?.libraryId), item]).filter(([key]) => key));
  const byName = new Map(items.map((item) => [normalizeKey(item?.name || item?.plantName), item]).filter(([key]) => key));
  const pickText = (item, keys, fallback, maxLength) => {
    for (const key of keys) {
      const value = item?.[key];
      if (typeof value === "string" && value.trim()) return normalizeText(value, fallback, maxLength);
    }
    return normalizeText("", fallback, maxLength);
  };
  const normalizeStatus = (value) => {
    const raw = normalizeKey(value);
    if (allowedStatuses.has(raw)) return raw;
    if (["ok", "god", "bra", "thriving", "trives godt"].includes(raw)) return "trives";
    if (["stress", "kritisk", "alvorlig", "problem"].includes(raw)) return "stress";
    return "følg med";
  };
  const fallbackStatus = () => {
    const maxTemp = numberOrNull(payload?.climate?.t?.max);
    const minTemp = numberOrNull(payload?.climate?.t?.min);
    const maxHumidity = numberOrNull(payload?.climate?.h?.max);
    if ((typeof maxTemp === "number" && maxTemp > 30) || (typeof minTemp === "number" && minTemp < 12) || (typeof maxHumidity === "number" && maxHumidity > 82)) {
      return "følg med";
    }
    return "trives";
  };
  const fallbackSummary = (plant) => {
    const type = plant.plantType || "plante";
    if (type === "Urte") return `${plant.name} har gode vekstforhold når varme, lys og jevn fukt holdes stabile gjennom dagen.`;
    if (type === "Blomst") return `${plant.name} vurderes mot blomstring og etablering, med særlig vekt på jevn fukt og temperatur uten store sprang.`;
    if (type === "Frukt") return `${plant.name} vurderes mot videre utvikling og modning, der stabil varme og god lufting er viktigst nå.`;
    return `${plant.name} har et brukbart vekstgrunnlag, men temperaturtopper og vannbalanse bør følges tett.`;
  };
  const fallbackWatch = (plant) => {
    if (plant.acquisition === "seed" && plant.seedDate) return "Følg ekstra med på rotsonen og jevn vanning siden planten er registrert fra frø denne sesongen.";
    if (plant.plantingPlace) return `Sjekk fuktigheten jevnlig i ${plant.plantingPlace.toLowerCase()}, særlig etter varme perioder.`;
    return "Hold luftingen stabil og unngå raske skift mellom tørr og våt rotsonen.";
  };
  const fallbackWatering = (plant) => {
    return "Sjekk jordfuktigheten og vann ved roten tidlig på dagen ved behov.";
  };
  const fallbackForecast = (plant) => {
    if (plant.plantType === "Urte") return "Kan begynne å høstes: når planten har tett nyvekst og tåler lett klipping.";
    if (plant.plantType === "Blomst") return "Forventet blomstring: vurderes etter videre etablering og temperatur de neste ukene.";
    if (plant.plantType === "Frukt") return "Forventet modning: avhenger av videre varme og lys gjennom resten av sesongen.";
    if (plant.plantType === "Grønnsak") return "Antatt høsteklar: vurderes etter videre vekst og stabil sommervarme.";
    return "";
  };

  return {
    generatedAt: normalizeIsoDate(parsed?.generatedAt) || payload.gen,
    month: normalizeText(parsed?.month, payload.month, 24),
    season: normalizeText(parsed?.season, payload.season, 24),
    usage: usage && typeof usage === "object"
      ? {
          inputTokens: numberOrNull(usage.input_tokens),
          outputTokens: numberOrNull(usage.output_tokens),
          totalTokens: numberOrNull(usage.total_tokens),
        }
      : undefined,
    items: plants.map((plant) => {
      const item =
        byId.get(normalizeKey(plant.seasonId || plant.id)) ||
        byLibraryId.get(normalizeKey(plant.libraryId)) ||
        byName.get(normalizeKey(plant.name)) ||
        {};
      const hasItem = Object.keys(item).length > 0;
      const status = hasItem ? normalizeStatus(item.status || item.state || item.condition) : fallbackStatus();
      const developmentType = plant.plantType === "Blomst" ? "flowering" : plant.plantType === "Frukt" ? "ripening" : "harvest";
      const rawDevelopmentText = typeof item?.development?.text === "string"
        ? normalizeText(item.development.text, "", 100)
        : pickText(item, ["forecast", "expectedDevelopment", "prediction", "prognose"], fallbackForecast(plant), 100)
            .replace(/^(Forventet modning|Forventet blomstring|Antatt høsteklar|Kan begynne å høstes):\s*/i, "");
      const looksLikeCareAdvice = /^(hold|rist|vann|sjekk|følg|fjern|bind|la |unngå|sørg)/i.test(rawDevelopmentText);
      const developmentText = looksLikeCareAdvice ? fallbackForecast(plant).replace(/^[^:]+:\s*/, "") : rawDevelopmentText;
      return {
        id: plant.seasonId || plant.id,
        assessedAt: payload.gen,
        libraryId: plant.libraryId || "",
        name: plant.name,
        plantType: plant.plantType || "",
        plantingPlace: plant.plantingPlace || "",
        status,
        assessment: pickText(item, ["assessment", "summary", "vurdering", "message"], fallbackSummary(plant), 140)
          .replace(new RegExp(`^${String(plant.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), ""),
        watering: pickText(item, ["watering", "vanning"], fallbackWatering(plant), 130),
        development: {
          type: ["ripening", "flowering", "harvest"].includes(item?.development?.type) ? item.development.type : developmentType,
          text: capitalizeNorwegianText(developmentText || "Kan ikke anslås fra registrerte data."),
        },
      };
    }),
  };
}

function compactSensorEntries(entries) {
  const points = entries.slice(-96);
  const stride = Math.max(1, Math.ceil(points.length / 8));
  return points.filter((_, index) => index % stride === 0 || index === points.length - 1).map((entry) => ({
    time: entry.bucketStart || entry.timestamp,
    value: numberOrNull(entry.value),
    min: numberOrNull(entry.min ?? entry.value),
    max: numberOrNull(entry.max ?? entry.value),
  }));
}

function capitalizeNorwegianText(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toLocaleUpperCase("nb-NO") + text.slice(1) : "";
}

function buildPlantClimateProfile(stats24h, weather, temperatureEntries, humidityEntries, latest) {
  const average = (entries) => {
    const values = entries.map((entry) => numberOrNull(entry.value ?? entry.max ?? entry.min)).filter((value) => value !== null);
    return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  };
  const hoursAt = (entries, predicate) => new Set(entries.filter((entry) => predicate(numberOrNull(entry.max ?? entry.value), numberOrNull(entry.min ?? entry.value))).map((entry) => String(entry.bucketStart || entry.timestamp || "").slice(0, 13))).size;
  const forecast = compactWeatherForecast(weather?.forecastToday || []);
  return {
    t: { min: numberOrNull(stats24h?.temperature?.min), max: numberOrNull(stats24h?.temperature?.max), avg: average(temperatureEntries), hotH: hoursAt(temperatureEntries, (max) => max !== null && max >= 30), coldH: hoursAt(temperatureEntries, (_, min) => min !== null && min < 12) },
    h: { min: numberOrNull(stats24h?.humidity?.min), max: numberOrNull(stats24h?.humidity?.max), avg: average(humidityEntries), highH: hoursAt(humidityEntries, (max) => max !== null && max >= 82) },
    rain: numberOrNull(latest?.rainToday),
    fc: forecast,
  };
}

function fingerprintPlantClimate(climate) {
  const band = (value, limits) => {
    if (value === null) return "na";
    return String(limits.findIndex((limit) => value < limit));
  };
  const forecastTemps = (climate?.fc || []).map((item) => item.temp).filter((value) => value !== null);
  const forecastRain = (climate?.fc || []).reduce((sum, item) => sum + (item.rain || 0), 0);
  return {
    tMin: band(climate?.t?.min, [8, 12, 16, 20]),
    tMax: band(climate?.t?.max, [23, 29, 32, 36]),
    hot: band(climate?.t?.hotH, [1, 3, 6]),
    hMax: band(climate?.h?.max, [70, 82, 90]),
    humid: band(climate?.h?.highH, [1, 3, 6]),
    fcMax: band(forecastTemps.length ? Math.max(...forecastTemps) : null, [23, 29, 32, 36]),
    fcRain: band(forecastRain, [0.1, 2, 8]),
    fcWeather: [...new Set((climate?.fc || []).map((item) => item.d).filter(Boolean))].sort().join("|").slice(0, 160),
  };
}

function getPlantClimateRisk(climate) {
  const forecastTemps = (climate?.fc || []).map((item) => item.temp).filter((value) => value !== null);
  const forecastRain = (climate?.fc || []).reduce((sum, item) => sum + (item.rain || 0), 0);
  const maxTemperature = numberOrNull(climate?.t?.max);
  const minTemperature = numberOrNull(climate?.t?.min);
  const maxHumidity = numberOrNull(climate?.h?.max);
  const forecastMax = forecastTemps.length ? Math.max(...forecastTemps) : null;
  const reasons = [];
  if (maxTemperature !== null && maxTemperature >= 32) reasons.push("temperatur over 32 °C");
  if (minTemperature !== null && minTemperature < 8) reasons.push("temperatur under 8 °C");
  if (maxHumidity !== null && maxHumidity >= 90) reasons.push("luftfuktighet over 90 %");
  if (forecastMax !== null && forecastMax >= 32) reasons.push("meldt temperatur over 32 °C");
  if (forecastRain >= 8) reasons.push("kraftig nedbør i prognosen");
  return { critical: reasons.length > 0, reasons };
}

async function hashAnalysisInput(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function compactWeatherForecast(forecast) {
  return (Array.isArray(forecast) ? forecast : []).slice(0, 10).map((item) => ({
    t: item.time || item.updatedAt || "",
    d: item.description || item.symbolCode || "",
    temp: numberOrNull(item.outdoorTemperature ?? item.temperature),
    rain: numberOrNull(item.precipitation),
  }));
}

function compactPlantHistory(history) {
  return history
    .slice(-4)
    .map((entry) => ({
      year: entry.year,
      acquisition: entry.acquisition,
      seedDate: entry.seedDate,
      seedLocation: entry.seedLocation,
      greenhouseDate: entry.greenhouseDate,
      finished: entry.finished,
      finishReason: entry.finishReason,
      harvestDate: entry.harvestDate,
      plantingPlace: entry.plantingPlace,
    }))
    .filter((entry) => entry.seedDate || entry.greenhouseDate || entry.finished || entry.harvestDate || entry.plantingPlace);
}

function getNorwegianMonth(date) {
  return new Intl.DateTimeFormat("nb-NO", { month: "long", timeZone: "Europe/Oslo" }).format(date);
}

function getNorwegianSeason(date) {
  const month = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Europe/Oslo" }).format(date));
  if (month === 12 || month <= 2) return "vinter";
  if (month <= 5) return "vår";
  if (month <= 8) return "sommer";
  return "høst";
}

function aggregateDisplaySeries(entries, since, now, intervalMinutes) {
  const intervalMs = intervalMinutes * 60 * 1000;
  const bucketCount = Math.floor((now.getTime() - since.getTime()) / intervalMs) + 1;
  const buckets = Array.from({ length: bucketCount }, () => ({ sum: 0, count: 0 }));

  for (const entry of entries) {
    const time = new Date(entry.bucketStart || entry.timestamp).getTime();
    if (!Number.isFinite(time) || time < since.getTime() || time > now.getTime()) continue;

    const value = numberOrNull(entry.value);
    const min = numberOrNull(entry.min);
    const max = numberOrNull(entry.max);
    const numeric = value ?? (min !== null && max !== null ? (min + max) / 2 : min ?? max);
    if (numeric === null) continue;

    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((time - since.getTime()) / intervalMs)));
    buckets[index].sum += numeric;
    buckets[index].count += 1;
  }

  const values = [];
  let lastValue = null;
  for (const bucket of buckets) {
    if (bucket.count > 0) {
      lastValue = Math.round((bucket.sum / bucket.count) * 10) / 10;
      values.push(lastValue);
    } else {
      values.push(lastValue);
    }
  }

  return values;
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

    rain_hour: "rain_hour",

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

function getOsloDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
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
  const perHour = new Map();

  for (const entry of entries) {
    const entryDate = new Date(entry.bucketStart);
    const hourKey = getOsloHourKey(entryDate);
    const existing = perHour.get(hourKey);
    const entryMin = numberOrNull(entry.min ?? entry.value);
    const entryMax = numberOrNull(entry.max ?? entry.value);

    if (!existing) {
      perHour.set(hourKey, {
        latest: entry,
        min: entryMin,
        max: entryMax,
      });
      continue;
    }

    if (entryMin !== null) {
      existing.min = existing.min === null ? entryMin : Math.min(existing.min, entryMin);
    }

    if (entryMax !== null) {
      existing.max = existing.max === null ? entryMax : Math.max(existing.max, entryMax);
    }

    if (new Date(entry.timestamp) > new Date(existing.latest.timestamp)) {
      existing.latest = entry;
    }
  }

  let lastKnown = null;

  return slots.map((slot) => {
    const hour = perHour.get(slot.key);

    if (hour) {
      const entry = hour.latest;
      const value = formatHistoryValue(sensor, entry.value);
      lastKnown = {
        value,
        timestamp: entry.timestamp,
        bucketStart: entry.bucketStart,
      };
      return {
        time: slot.time,
        value,
        min: formatHistoryValue(sensor, hour.min),
        max: formatHistoryValue(sensor, hour.max),
        timestamp: entry.timestamp,
        bucketStart: entry.bucketStart,
      };
    }

    if (lastKnown) {
      return {
        time: slot.time,
        value: lastKnown.value,
        min: lastKnown.value,
        max: lastKnown.value,
        timestamp: lastKnown.timestamp,
        bucketStart: lastKnown.bucketStart,
      };
    }

    return {
      time: slot.time,
      value: null,
      min: null,
      max: null,
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
