export interface HistoryData {
  temperature: Array<{ time: string; value: number | null; min?: number | null; max?: number | null; timestamp: string | null; bucketStart: string | null }>;
  humidity: Array<{ time: string; value: number | null; min?: number | null; max?: number | null; timestamp: string | null; bucketStart: string | null }>;
}

export interface MetricStats {
  min: number | null;
  max: number | null;
}

export interface GreenhouseStats24h {
  temperature?: MetricStats;
  humidity?: MetricStats;
}

export interface LatestData {
  temperature: number;
  humidity: number;
  updatedAt: string;
  temperatureUpdatedAt: string;
  humidityUpdatedAt: string;
  rainToday?: number;
  door?: "open" | "closed";
  doorUpdatedAt?: string;
  window?: number;
  windowUpdatedAt?: string;
  fan?: "on" | "off";
  fanUpdatedAt?: string;
  heating?: "on" | "off";
  heatingUpdatedAt?: string;
}

export interface WeatherData {
  temperature: number;
  symbolCode: string;
  description: string;
  updatedAt?: Date;
  uvIndex?: number;
}

export type HeaderImageSlot = "cold" | "normal" | "warm" | "hot";
export type HeaderImageFormat = "mobile" | "desktop";

export const logoFontOptions = [
  { value: "Cinzel Decorative", label: "Cinzel Decorative" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Lora", label: "Lora" },
  { value: "Libre Baskerville", label: "Libre Baskerville" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Fraunces", label: "Fraunces" },
  { value: "Inter", label: "Inter" },
] as const;

export type LogoFont = (typeof logoFontOptions)[number]["value"];

export interface HeaderImageConfig {
  label: string;
  description: string;
  mobile: string;
  desktop: string;
}

export interface SiteConfig {
  showHeroImage: boolean;
  visibleStatuses: {
    door: boolean;
    fan: boolean;
    window: boolean;
  };
  headerImages: Record<HeaderImageSlot, HeaderImageConfig>;
  branding: {
    siteName: string;
    shortName: string;
    title: string;
    description: string;
    logoText: {
      visible: boolean;
      text: string;
      font: LogoFont;
    };
    logo: {
      url: string;
    };
    favicon: {
      svg: string;
      png32: string;
      appleTouchIcon: string;
      png192: string;
      png512: string;
    };
  };
}

export interface AdminImage {
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number | null;
  uploadedAt: string | null;
  updatedAt: string | null;
  slot: string;
  format: string;
  assetType?: string;
}

const GREENHOUSE_API_BASE =
  typeof window !== "undefined" && window.location.hostname === "127.0.0.1"
    ? "https://drivhus.dan-aksel.workers.dev"
    : "";

function greenhouseApiUrl(path: string) {
  return `${GREENHOUSE_API_BASE}${path}`;
}

export function resolveGreenhouseAssetUrl(path: string) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return greenhouseApiUrl(path);
}

export const defaultSiteConfig: SiteConfig = {
  showHeroImage: true,
  visibleStatuses: {
    door: true,
    fan: true,
    window: true,
  },
  headerImages: {
    cold: {
      label: "Kaldt",
      description: "Under 12°C",
      mobile: "/cold.jpg",
      desktop: "/cold.jpg",
    },
    normal: {
      label: "Normalt",
      description: "12-22.9°C",
      mobile: "/drivhus.png",
      desktop: "/drivhus.png",
    },
    warm: {
      label: "Varmt",
      description: "23-28°C",
      mobile: "/warm.jpg",
      desktop: "/warm.jpg",
    },
    hot: {
      label: "Svært varmt",
      description: "Over 28°C",
      mobile: "/hot.jpg",
      desktop: "/hot.jpg",
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

function normalizeSiteConfig(data: Partial<SiteConfig> | null | undefined): SiteConfig {
  const visibleStatuses = data?.visibleStatuses ?? {};
  const headerImages = data?.headerImages ?? {};
  const branding = data?.branding ?? {};
  const logo = branding.logo ?? {};
  const logoText = branding.logoText ?? {};
  const favicon = branding.favicon ?? {};
  const siteName = typeof branding.siteName === "string" && branding.siteName.trim()
    ? branding.siteName.trim()
    : defaultSiteConfig.branding.siteName;
  const shortName = typeof branding.shortName === "string" && branding.shortName.trim()
    ? branding.shortName.trim()
    : defaultSiteConfig.branding.shortName;
  const title = typeof branding.title === "string" && branding.title.trim()
    ? branding.title.trim()
    : defaultSiteConfig.branding.title;
  const description = typeof branding.description === "string" && branding.description.trim()
    ? branding.description.trim()
    : defaultSiteConfig.branding.description;

  return {
    showHeroImage:
      typeof data?.showHeroImage === "boolean" ? data.showHeroImage : defaultSiteConfig.showHeroImage,
    visibleStatuses: {
      door: typeof visibleStatuses.door === "boolean" ? visibleStatuses.door : defaultSiteConfig.visibleStatuses.door,
      fan: typeof visibleStatuses.fan === "boolean" ? visibleStatuses.fan : defaultSiteConfig.visibleStatuses.fan,
      window: typeof visibleStatuses.window === "boolean" ? visibleStatuses.window : defaultSiteConfig.visibleStatuses.window,
    },
    headerImages: {
      cold: { ...defaultSiteConfig.headerImages.cold, ...(headerImages.cold ?? {}) },
      normal: { ...defaultSiteConfig.headerImages.normal, ...(headerImages.normal ?? {}) },
      warm: { ...defaultSiteConfig.headerImages.warm, ...(headerImages.warm ?? {}) },
      hot: { ...defaultSiteConfig.headerImages.hot, ...(headerImages.hot ?? {}) },
    },
    branding: {
      siteName,
      shortName,
      title,
      description,
      logoText: {
        visible:
          typeof logoText.visible === "boolean"
            ? logoText.visible
            : defaultSiteConfig.branding.logoText.visible,
        text:
          typeof logoText.text === "string" && logoText.text.trim()
            ? logoText.text.trim()
            : defaultSiteConfig.branding.logoText.text,
        font: logoFontOptions.some((font) => font.value === logoText.font)
          ? (logoText.font as LogoFont)
          : defaultSiteConfig.branding.logoText.font,
      },
      logo: {
        url: typeof logo.url === "string" ? logo.url : defaultSiteConfig.branding.logo.url,
      },
      favicon: {
        svg: typeof favicon.svg === "string" && favicon.svg ? favicon.svg : defaultSiteConfig.branding.favicon.svg,
        png32: typeof favicon.png32 === "string" ? favicon.png32 : defaultSiteConfig.branding.favicon.png32,
        appleTouchIcon:
          typeof favicon.appleTouchIcon === "string" && favicon.appleTouchIcon
            ? favicon.appleTouchIcon
            : defaultSiteConfig.branding.favicon.appleTouchIcon,
        png192: typeof favicon.png192 === "string" ? favicon.png192 : defaultSiteConfig.branding.favicon.png192,
        png512: typeof favicon.png512 === "string" ? favicon.png512 : defaultSiteConfig.branding.favicon.png512,
      },
    },
  };
}

export async function fetchLatestGreenhouseData(): Promise<LatestData> {
  const res = await fetch(greenhouseApiUrl("/api/latest"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || {};

  return {
    temperature: data.temperature,
    humidity: data.humidity,
    updatedAt: data.updatedAt,
    temperatureUpdatedAt: data.temperatureUpdatedAt,
    humidityUpdatedAt: data.humidityUpdatedAt,
    rainToday: data.rainToday,
    door: data.door,
    doorUpdatedAt: data.doorUpdatedAt,
    window: data.window,
    windowUpdatedAt: data.windowUpdatedAt,
    fan: data.fan,
    fanUpdatedAt: data.fanUpdatedAt,
    heating: data.heating,
    heatingUpdatedAt: data.heatingUpdatedAt,
  };
}

export async function fetchSiteConfig(): Promise<SiteConfig> {
  const res = await fetch(greenhouseApiUrl("/api/site-config"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return normalizeSiteConfig(json.data);
}

export async function fetchAdminSiteConfig(): Promise<SiteConfig> {
  const res = await fetch(greenhouseApiUrl("/admin/api/config"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return normalizeSiteConfig(json.data);
}

export async function saveAdminSiteConfig(config: SiteConfig): Promise<SiteConfig> {
  const res = await fetch(greenhouseApiUrl("/admin/api/config"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return normalizeSiteConfig(json.data);
}

export async function fetchAdminImages(): Promise<AdminImage[]> {
  const res = await fetch(greenhouseApiUrl("/admin/api/images"), {
    method: "GET",
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function uploadAdminImage(file: File, slot: HeaderImageSlot, format: HeaderImageFormat): Promise<AdminImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("slot", slot);
  formData.set("format", format);

  const res = await fetch(greenhouseApiUrl("/admin/api/images"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function uploadAdminAsset(
  file: File,
  assetType: "logo" | "favicon",
  format: string
): Promise<AdminImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("assetType", assetType);
  formData.set("slot", assetType);
  formData.set("format", format);

  const res = await fetch(greenhouseApiUrl("/admin/api/images"), {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function deleteAdminImage(key: string): Promise<void> {
  const res = await fetch(greenhouseApiUrl(`/admin/api/images?key=${encodeURIComponent(key)}`), {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
}

export async function fetchGreenhouseStats24h(): Promise<GreenhouseStats24h> {
  const res = await fetch(greenhouseApiUrl("/api/stats24h"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data || {};
}

export async function fetchGreenhouseHistory(): Promise<HistoryData> {
  const res = await fetch(greenhouseApiUrl("/api/history"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || {};

  return {
    temperature: data.temperature || [],
    humidity: data.humidity || []
  };
}

// Map Yr symbol codes to Norwegian descriptions
const weatherDescriptions: Record<string, string> = {
  clearsky_day: "Sol",
  clearsky_night: "Klar himmel",
  fair_day: "Lettskyet",
  fair_night: "Lettskyet",
  partlycloudy_day: "Delvis skyet",
  partlycloudy_night: "Delvis skyet",
  cloudy: "Overskyet",
  fog: "Tåke",
  
  // Rain showers
  lightrainshowers_day: "Lette regnbyger",
  lightrainshowers_night: "Lette regnbyger",
  rainshowers_day: "Regnbyger",
  rainshowers_night: "Regnbyger",
  heavyrainshowers_day: "Kraftige regnbyger",
  heavyrainshowers_night: "Kraftige regnbyger",
  
  // Rain
  lightrain: "Lett regn",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  
  // Sleet showers
  lightsleetshowers_day: "Lette sluddbyger",
  lightsleetshowers_night: "Lette sluddbyger",
  sleetshowers_day: "Sluddbyger",
  sleetshowers_night: "Sluddbyger",
  heavysleetshowers_day: "Kraftige sluddbyger",
  heavysleetshowers_night: "Kraftige sluddbyger",
  
  // Sleet
  lightsleet: "Lett sludd",
  sleet: "Sludd",
  heavysleet: "Kraftig sludd",
  
  // Snow showers
  lightsnowshowers_day: "Lette snøbyger",
  lightsnowshowers_night: "Lette snøbyger",
  snowshowers_day: "Snøbyger",
  snowshowers_night: "Snøbyger",
  heavysnowshowers_day: "Kraftige snøbyger",
  heavysnowshowers_night: "Kraftige snøbyger",
  
  // Snow
  lightsnow: "Lett snø",
  snow: "Snø",
  heavysnow: "Kraftig snø",
  
  // Thunder
  thunderstorm: "Tordenvær",
  
  // Rain and thunder
  lightrainshowersandthunder_day: "Lette regnbyger og torden",
  lightrainshowersandthunder_night: "Lette regnbyger og torden",
  rainshowersandthunder_day: "Regnbyger og torden",
  rainshowersandthunder_night: "Regnbyger og torden",
  heavyrainshowersandthunder_day: "Kraftige regnbyger og torden",
  heavyrainshowersandthunder_night: "Kraftige regnbyger og torden",
  lightrainandthunder: "Lett regn og torden",
  rainandthunder: "Regn og torden",
  heavyrainandthunder: "Kraftig regn og torden",
  
  // Sleet and thunder
  lightsleetshowersandthunder_day: "Lette sluddbyger og torden",
  lightsleetshowersandthunder_night: "Lette sluddbyger og torden",
  sleetshowersandthunder_day: "Sluddbyger og torden",
  sleetshowersandthunder_night: "Sluddbyger og torden",
  heavysleetshowersandthunder_day: "Kraftige sluddbyger og torden",
  heavysleetshowersandthunder_night: "Kraftige sluddbyger og torden",
  lightsleetandthunder: "Lett sludd og torden",
  sleetandthunder: "Sludd og torden",
  heavysleetandthunder: "Kraftig sludd og torden",
  
  // Snow and thunder
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

export async function fetchWeatherData(): Promise<WeatherData> {
  // Coordinates for Høybråten, Nesodden
  const lat = 59.87;
  const lon = 10.67;
  
  // Fetch weather data from Yr (temperature + symbol)
  const res = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`
  );

  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  const json = await res.json();
  const current = json.properties?.timeseries?.[0];
  
  if (!current) {
    throw new Error("No weather data available");
  }

  // Get the actual update timestamp from Yr's metadata
  const updatedAtString = json.properties?.meta?.updated_at;
  let updatedAt: Date;
  
  if (updatedAtString) {
    // Safari is strict about date formats, so ensure it's valid
    try {
      updatedAt = new Date(updatedAtString);
      // Check if date is valid
      if (isNaN(updatedAt.getTime())) {
        updatedAt = new Date();
      }
    } catch {
      updatedAt = new Date();
    }
  } else {
    updatedAt = new Date();
  }

  const symbolCode = current.data?.next_1_hours?.summary?.symbol_code || 
                     current.data?.next_6_hours?.summary?.symbol_code || 
                     "cloudy";
  const temperature = current.data?.instant?.details?.air_temperature || 0;
  
  // Fetch UV index from Open-Meteo (Yr doesn't provide UV data)
  let uvIndex: number | undefined;
  try {
    const uvRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index`
    );
    
    if (uvRes.ok) {
      const uvJson = await uvRes.json();
      uvIndex = uvJson.current?.uv_index;
    }
  } catch (error) {
    console.warn('Failed to fetch UV data from Open-Meteo:', error);
    // Continue without UV data
  }
  
  // Get base symbol without polarity variants (_polarlight, _polartwilight)
  const baseSymbol = symbolCode.split("_polarlight")[0].split("_polartwilight")[0];
  
  // Check for fog conditions - Yr combines fog with other weather symbols
  const details = current.data?.instant?.details;
  const fogCondition = details?.fog_area_fraction;
  const visibility = details?.visibility;
  
  // Fog detection: Only trust Yr's actual fog data or symbol code
  // fog_area_fraction and visibility are often undefined in the API response
  const hasFog = (fogCondition !== undefined && fogCondition > 0.5) || 
                 (visibility !== undefined && visibility < 1000) ||
                 baseSymbol.includes('fog'); // Trust Yr's symbol code if it explicitly says fog
  
  // Debug: Log the symbol code and fog conditions
  console.log('Yr symbol code:', symbolCode, '-> base:', baseSymbol);
  console.log('Fog conditions - fog_area_fraction:', fogCondition, 'visibility:', visibility, 'hasFog:', hasFog);
  
  // Adjust description based on fog conditions
  let description = weatherDescriptions[baseSymbol] || weatherDescriptions[symbolCode] || `Ukjent (${baseSymbol})`;
  
  // If we detect fog conditions, modify the description
  if (hasFog) {
    if (baseSymbol === 'cloudy') {
      description = 'Overskyet med tåke';
    } else if (baseSymbol.includes('partlycloudy')) {
      description = 'Delvis skyet med tåke';
    } else if (!baseSymbol.includes('fog')) {
      // Add fog to other conditions if not already mentioned
      description = `${description} og tåke`;
    }
  }

  return {
    temperature,
    symbolCode: hasFog ? 'fog' : baseSymbol,
    description,
    updatedAt,
    uvIndex
  };
}
