export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshWeatherCache(env));
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
        return await handleIngest(request, env, corsHeaders);
      }

      if (url.pathname === "/api/latest" && request.method === "GET") {
        const latest = await getLatest(env);
        return jsonResponse({ ok: true, data: latest }, 200, corsHeaders);
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
        const stats24h = await getStats24h(env);
        return jsonResponse({ ok: true, data: stats24h }, 200, corsHeaders);
      }

      if (url.pathname === "/api/site-config" && request.method === "GET") {
        const config = await getSiteConfig(env);
        return jsonResponse({ ok: true, data: config }, 200, corsHeaders);
      }

      if (url.pathname === "/api/site-image" && request.method === "GET") {
        return await handleSiteImage(request, env, corsHeaders);
      }

      if (url.pathname === "/manifest.webmanifest" && request.method === "GET") {
        return await handleSiteManifest(env, corsHeaders);
      }

      if (url.pathname === "/admin/api/config" && request.method === "GET") {
        const config = await getSiteConfig(env);
        return jsonResponse({ ok: true, data: config }, 200, corsHeaders);
      }

      if (url.pathname === "/admin/api/config" && request.method === "PUT") {
        return await handleSaveSiteConfig(request, env, corsHeaders);
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

const WEATHER_CACHE_KEY = "latest:weather";
const WEATHER_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const WEATHER_LATITUDE = 59.87;
const WEATHER_LONGITUDE = 10.67;

const DEFAULT_SITE_CONFIG = {
  showHeroImage: true,
  visibleStatuses: {
    door: true,
    fan: true,
    window: true,
  },
  headerImages: {
    coldNight: {
      label: "Kald natt",
      description: "Natt og under 12°C",
      mobile: "/cold.jpg",
      desktop: "/cold.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
    },
    night: {
      label: "Natt",
      description: "Etter solnedgang og før soloppgang",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
    },
    cold: {
      label: "Kaldt",
      description: "Under 12°C",
      mobile: "/cold.jpg",
      desktop: "/cold.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
    },
    rain: {
      label: "Regn",
      description: "Regn eller torden fra Yr",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
    },
    normal: {
      label: "Normalt",
      description: "12-22.9°C",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
    },
    warm: {
      label: "Varmt",
      description: "23-28°C",
      mobile: "/warm.jpg",
      desktop: "/warm.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
    },
    hot: {
      label: "Svært varmt",
      description: "Over 28°C",
      mobile: "/hot.jpg",
      desktop: "/hot.jpg",
      mobileVideo: "",
      darkModeColor: "#2d3a21",
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

const SITE_CONFIG_KEY = "admin/site-config.json";
const ADMIN_IMAGE_PREFIX = "admin/images/";
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
  const bucket = getAssetBucket(env);
  const stored = bucket ? await readR2Json(bucket, SITE_CONFIG_KEY) : null;
  return normalizeSiteConfig(stored);
}

async function handleSaveSiteConfig(request, env, corsHeaders) {
  const bucket = getAssetBucket(env);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket is not configured" }, 500, corsHeaders);
  }

  const body = await request.json();
  const config = normalizeSiteConfig(body);

  await bucket.put(SITE_CONFIG_KEY, JSON.stringify(config, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
  });

  return jsonResponse({ ok: true, data: config }, 200, corsHeaders);
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

  const image = await getImageMetadata(bucket, key);
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

  const image = await getImageMetadata(bucket, key);
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

  const images = await Promise.all(objects.map((object) => getImageMetadata(bucket, object.key, object)));
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

function getAssetBucket(env) {
  return env.GREENHOUSE_ASSETS || env.GREENHOUSE_HISTORY || null;
}

async function getImageMetadata(bucket, key, objectInfo = null) {
  if (!isAllowedImageKey(key)) return null;

  const object = objectInfo && objectInfo.customMetadata ? objectInfo : await bucket.head(key);
  if (!object) return null;

  const customMetadata = object.customMetadata || {};

  return {
    key,
    url: `/api/site-image?key=${encodeURIComponent(key)}`,
    filename: customMetadata.originalName || key.split("/").pop(),
    contentType: object.httpMetadata?.contentType || "",
    size: object.size || null,
    uploadedAt: customMetadata.uploadedAt || object.uploaded?.toISOString?.() || null,
    updatedAt: object.uploaded?.toISOString?.() || null,
    slot: customMetadata.slot || key.split("/")[2] || "general",
    format: customMetadata.format || key.split("/")[3] || "image",
    assetType: customMetadata.assetType || "header",
  };
}

function normalizeSiteConfig(config) {
  const input = config && typeof config === "object" ? config : {};
  const visibleStatuses = input.visibleStatuses && typeof input.visibleStatuses === "object" ? input.visibleStatuses : {};
  const headerImages = input.headerImages && typeof input.headerImages === "object" ? input.headerImages : {};
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
    },
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
    };
  }

  return normalized;
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

function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
}

function normalizeNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function isAllowedImageKey(key) {
  return typeof key === "string" && key.startsWith(ADMIN_IMAGE_PREFIX) && !key.includes("..");
}

function isAllowedUploadType(assetType, contentType, format) {
  if (assetType === "logo") return contentType === "image/svg+xml";
  if (assetType === "favicon") return contentType === "image/svg+xml" || contentType === "image/png";
  if (assetType === "header-video") return contentType === "video/mp4" && format === "mobile-video";
  return ["image/jpeg", "image/png"].includes(contentType) && ["desktop", "mobile", "image"].includes(format);
}

function getUploadExtension(contentType) {
  if (contentType === "image/svg+xml") return "svg";
  if (contentType === "image/png") return "png";
  if (contentType === "video/mp4") return "mp4";
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

async function getCachedWeather(env, ctx) {
  const cached = await env.GREENHOUSE_DATA.get(WEATHER_CACHE_KEY, "json");
  const cachedAt = cached?.cachedAt ? new Date(cached.cachedAt).getTime() : 0;
  const isFresh = cachedAt && Date.now() - cachedAt < WEATHER_CACHE_MAX_AGE_MS;

  if (cached && isFresh) return cached;

  if (cached) {
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
  };
}

function normalizeIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
