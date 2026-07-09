import { displayTheme, getDefaultDisplayThemeForSlot } from "../../shared/display-theme";

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

export interface PlantConfig {
  id: string;
  name: string;
  plantType: string;
  plantingPlace: string;
  active: boolean;
  note: string;
  image: string;
}

export type PlantType = "Blomst" | "Urte" | "Frukt" | "Grønnsak";
export type PlantAcquisition = "seed" | "plant";
export type SeedLocation = "Innendørs" | "Utendørs" | "Drivhus";

export interface PlantLibraryEntry {
  id: string;
  name: string;
  plantType: PlantType;
  description: string;
  image: string;
}

export interface PlantSeasonEntry {
  id: string;
  year: number;
  libraryId: string;
  acquisition: PlantAcquisition;
  seedDate: string;
  seedLocation: SeedLocation | "";
  greenhouseDate: string;
  purchaseSource: string;
  harvestDate: string;
  plantingPlace: string;
  active: boolean;
  note: string;
}

export interface PlantAnalysisThemeMode {
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  ingressColor: string;
  watchTextColor: string;
  thrivingPillBg: string;
  watchPillBg: string;
  stressPillBg: string;
  pillTextColor: string;
}

export interface PlantAnalysisTheme {
  light: PlantAnalysisThemeMode;
  dark: PlantAnalysisThemeMode;
}

export interface PlantAnalysisItem {
  id: string;
  name: string;
  plantType?: string;
  plantingPlace?: string;
  libraryId?: string;
  forecast?: string;
  status: "trives" | "følg med" | "stress";
  summary: string;
  watch: string;
  detail?: string;
}

export interface PlantAnalysisResponse {
  generatedAt: string;
  month: string;
  season: string;
  contextSummary: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  items: PlantAnalysisItem[];
}

export interface LatestData {
  temperature: number;
  humidity: number;
  updatedAt: string;
  temperatureUpdatedAt: string;
  humidityUpdatedAt: string;
  rainToday?: number;
  rainTodayUpdatedAt?: string;
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

export type HeaderImageSlot = "coldNight" | "night" | "cold" | "rain" | "normal" | "warm" | "hot";
export type HeaderImageFormat = "mobile" | "desktop";

export interface DisplayImageConfig {
  image: string;
  binary: string;
  source: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  size: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type DisplayThemeModeConfig = typeof displayTheme.dark;

export interface DisplayThemeConfig {
  dark: DisplayThemeModeConfig;
  light: DisplayThemeModeConfig;
}

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
  mobileVideo: string;
  darkModeColor: string;
  display: DisplayImageConfig;
  displayTheme: DisplayThemeConfig;
  plantAnalysisTheme: PlantAnalysisTheme;
}

export interface SiteConfig {
  showHeroImage: boolean;
  visibleStatuses: {
    door: boolean;
    fan: boolean;
    window: boolean;
    plantAnalysis: boolean;
    charts: boolean;
  };
  plants: PlantConfig[];
  activePlantSeasonYear: number;
  plantLibrary: PlantLibraryEntry[];
  plantSeasons: Record<string, PlantSeasonEntry[]>;
  plantAnalysisNotes: string;
  plantAnalysisTheme: PlantAnalysisTheme;
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
      size: number;
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
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return greenhouseApiUrl(path);
}

const defaultPlantAnalysisTheme: PlantAnalysisTheme = {
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

export const plantTypeOptions: PlantType[] = ["Blomst", "Urte", "Frukt", "Grønnsak"];
export const acquisitionOptions: Array<{ value: PlantAcquisition; label: string }> = [
  { value: "seed", label: "Sådd fra frø" },
  { value: "plant", label: "Anskaffet som plante" },
];
export const seedLocationOptions: SeedLocation[] = ["Innendørs", "Utendørs", "Drivhus"];

const defaultPlantLibrary: PlantLibraryEntry[] = [
  { id: "san-marazano-tomater", name: "San Marazano tomater", plantType: "Grønnsak", description: "", image: "" },
  { id: "cherrytomater", name: "Cherrytomater", plantType: "Grønnsak", description: "", image: "" },
  { id: "agurk", name: "Agurk", plantType: "Grønnsak", description: "", image: "" },
  { id: "druer", name: "Druer", plantType: "Frukt", description: "", image: "" },
  { id: "basilikum", name: "Basilikum", plantType: "Urte", description: "Basilikum er en varmekjær urt som dyrkes for sine aromatiske blader.", image: "" },
  { id: "kryptimian", name: "Kryptimian", plantType: "Urte", description: "", image: "" },
  { id: "kiwibaer", name: "Kiwibær", plantType: "Frukt", description: "", image: "" },
  { id: "hvit-fersken", name: "Hvit fersken", plantType: "Frukt", description: "", image: "" },
  { id: "carolina-reaper", name: "Carolina Reaper", plantType: "Grønnsak", description: "", image: "" },
  { id: "gul-habanero", name: "Gul Habanero", plantType: "Grønnsak", description: "", image: "" },
];

const defaultPlantSeasons: Record<string, PlantSeasonEntry[]> = {
  "2026": defaultPlantLibrary.map((plant) => ({
    id: `${plant.id}-2026`,
    year: 2026,
    libraryId: plant.id,
    acquisition: "plant",
    seedDate: "",
    seedLocation: "",
    greenhouseDate: "",
    purchaseSource: "",
    harvestDate: "",
    plantingPlace: "",
    active: true,
    note: "",
  })),
};

export const defaultSiteConfig: SiteConfig = {
  showHeroImage: true,
  visibleStatuses: {
    door: true,
    fan: true,
    window: true,
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
  plantLibrary: defaultPlantLibrary,
  plantSeasons: defaultPlantSeasons,
  plantAnalysisNotes: "",
  plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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
      plantAnalysisTheme: defaultPlantAnalysisTheme,
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

function normalizeSiteConfig(data: Partial<SiteConfig> | null | undefined): SiteConfig {
  const visibleStatuses = data?.visibleStatuses ?? {};
  const plants = Array.isArray(data?.plants) ? data.plants : defaultSiteConfig.plants;
  const activePlantSeasonYear = normalizePlantYear(data?.activePlantSeasonYear, 2026);
  const plantLibrary = normalizePlantLibrary((data as Partial<SiteConfig>)?.plantLibrary, plants);
  const plantSeasons = normalizePlantSeasons((data as Partial<SiteConfig>)?.plantSeasons, plantLibrary, plants, activePlantSeasonYear);
  const activeSeasonPlants = derivePlantsFromSeason(plantLibrary, plantSeasons[String(activePlantSeasonYear)] ?? []);
  const plantAnalysisTheme = data?.plantAnalysisTheme ?? defaultSiteConfig.plantAnalysisTheme;
  const headerImages = data?.headerImages ?? {};
  const legacyDisplayThemeConfig = (data as Partial<SiteConfig> & { displayTheme?: Partial<DisplayThemeConfig> })?.displayTheme;
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
      plantAnalysis: typeof visibleStatuses.plantAnalysis === "boolean" ? visibleStatuses.plantAnalysis : defaultSiteConfig.visibleStatuses.plantAnalysis,
      charts: typeof visibleStatuses.charts === "boolean" ? visibleStatuses.charts : defaultSiteConfig.visibleStatuses.charts,
    },
    plants: activeSeasonPlants.length ? activeSeasonPlants : normalizePlants(plants),
    activePlantSeasonYear,
    plantLibrary,
    plantSeasons,
    plantAnalysisNotes: typeof data?.plantAnalysisNotes === "string" ? data.plantAnalysisNotes.slice(0, 1200) : defaultSiteConfig.plantAnalysisNotes,
    plantAnalysisTheme: normalizePlantAnalysisTheme(plantAnalysisTheme),
    headerImages: {
      coldNight: normalizeHeaderImageConfig(headerImages.coldNight, defaultSiteConfig.headerImages.coldNight, legacyDisplayThemeConfig, plantAnalysisTheme),
      night: normalizeHeaderImageConfig(headerImages.night, defaultSiteConfig.headerImages.night, legacyDisplayThemeConfig, plantAnalysisTheme),
      cold: normalizeHeaderImageConfig(headerImages.cold, defaultSiteConfig.headerImages.cold, legacyDisplayThemeConfig, plantAnalysisTheme),
      rain: normalizeHeaderImageConfig(headerImages.rain, defaultSiteConfig.headerImages.rain, legacyDisplayThemeConfig, plantAnalysisTheme),
      normal: normalizeHeaderImageConfig(headerImages.normal, defaultSiteConfig.headerImages.normal, legacyDisplayThemeConfig, plantAnalysisTheme),
      warm: normalizeHeaderImageConfig(headerImages.warm, defaultSiteConfig.headerImages.warm, legacyDisplayThemeConfig, plantAnalysisTheme),
      hot: normalizeHeaderImageConfig(headerImages.hot, defaultSiteConfig.headerImages.hot, legacyDisplayThemeConfig, plantAnalysisTheme),
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
        size:
          typeof logo.size === "number" && Number.isFinite(logo.size)
            ? Math.min(Math.max(Math.round(logo.size), 20), 72)
            : defaultSiteConfig.branding.logo.size,
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

function normalizePlantYear(value: unknown, fallback: number) {
  const year = typeof value === "number" ? value : Number(value);
  return Number.isFinite(year) ? Math.min(Math.max(Math.round(year), 2020), 2100) : fallback;
}

function normalizePlantType(value: unknown): PlantType {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "blomst") return "Blomst";
  if (raw === "urte" || raw === "urt") return "Urte";
  if (raw === "frukt" || raw.includes("drue") || raw.includes("fersken") || raw.includes("kiwi")) return "Frukt";
  return "Grønnsak";
}

function normalizePlantLibrary(library: unknown, legacyPlants: unknown): PlantLibraryEntry[] {
  const input = Array.isArray(library) && library.length ? library : legacyPlants;
  const seen = new Set<string>();
  const normalized = (Array.isArray(input) ? input : [])
    .map((plant, index) => {
      const item = plant && typeof plant === "object" ? plant as Partial<PlantLibraryEntry & PlantConfig> : {};
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) return null;
      const fallbackId = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `plante-${index + 1}`;
      let id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : fallbackId;
      if (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      return {
        id,
        name: name.slice(0, 80),
        plantType: normalizePlantType(item.plantType),
        description: typeof item.description === "string" ? item.description.slice(0, 500) : "",
        image: typeof item.image === "string" ? item.image : "",
      };
    })
    .filter((plant): plant is PlantLibraryEntry => Boolean(plant));

  return normalized.length ? normalized : defaultPlantLibrary;
}

function normalizePlantSeasons(
  seasons: unknown,
  library: PlantLibraryEntry[],
  legacyPlants: unknown,
  activeYear: number
): Record<string, PlantSeasonEntry[]> {
  const input = seasons && typeof seasons === "object" ? seasons as Record<string, unknown> : {};
  const normalized: Record<string, PlantSeasonEntry[]> = {};

  for (const [yearKey, entries] of Object.entries(input)) {
    const year = normalizePlantYear(yearKey, activeYear);
    const rows = Array.isArray(entries) ? entries : [];
    normalized[String(year)] = rows.map((entry, index) => normalizePlantSeasonEntry(entry, library, year, index)).filter(Boolean) as PlantSeasonEntry[];
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

function normalizePlantSeasonEntry(entry: unknown, library: PlantLibraryEntry[], year: number, index: number): PlantSeasonEntry | null {
  const item = entry && typeof entry === "object" ? entry as Partial<PlantSeasonEntry & PlantConfig> : {};
  const fallbackLibraryId = library[index]?.id || library[0]?.id || "";
  const libraryId = typeof item.libraryId === "string" && item.libraryId.trim() ? item.libraryId.trim() : (typeof item.id === "string" ? item.id : fallbackLibraryId);
  if (!libraryId) return null;
  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${libraryId}-${year}-${index}`,
    year,
    libraryId,
    acquisition: item.acquisition === "seed" ? "seed" : "plant",
    seedDate: normalizeDateString(item.seedDate),
    seedLocation: seedLocationOptions.includes(item.seedLocation as SeedLocation) ? item.seedLocation as SeedLocation : "",
    greenhouseDate: normalizeDateString(item.greenhouseDate),
    purchaseSource: typeof item.purchaseSource === "string" ? item.purchaseSource.slice(0, 160) : "",
    harvestDate: normalizeDateString(item.harvestDate),
    plantingPlace: typeof item.plantingPlace === "string" ? item.plantingPlace.slice(0, 120) : "",
    active: typeof item.active === "boolean" ? item.active : true,
    note: typeof item.note === "string" ? item.note.slice(0, 360) : "",
  };
}

function normalizeDateString(value: unknown) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export function derivePlantsFromSeason(library: PlantLibraryEntry[], season: PlantSeasonEntry[]): PlantConfig[] {
  const byId = new Map(library.map((plant) => [plant.id, plant]));
  return season
    .map((entry) => {
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
    })
    .filter((plant): plant is PlantConfig => Boolean(plant));
}

function normalizePlants(plants: unknown): PlantConfig[] {
  const input = Array.isArray(plants) ? plants : [];
  const normalized = input
    .map((plant, index) => {
      const item = plant && typeof plant === "object" ? plant as Partial<PlantConfig> : {};
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) return null;
      const fallbackId = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `plante-${index + 1}`;
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : fallbackId,
        name: name.slice(0, 80),
        plantType: typeof item.plantType === "string" ? item.plantType.trim().slice(0, 80) : "",
        plantingPlace: typeof item.plantingPlace === "string" ? item.plantingPlace.trim().slice(0, 80) : "",
        active: typeof item.active === "boolean" ? item.active : true,
        note: typeof item.note === "string" ? item.note.slice(0, 240) : "",
        image: typeof item.image === "string" ? item.image : "",
      };
    })
    .filter((plant): plant is PlantConfig => Boolean(plant));

  return normalized.length ? normalized : defaultSiteConfig.plants;
}

function normalizePlantAnalysisTheme(theme: Partial<PlantAnalysisTheme> | undefined): PlantAnalysisTheme {
  return {
    light: normalizePlantAnalysisThemeMode(theme?.light, defaultSiteConfig.plantAnalysisTheme.light),
    dark: normalizePlantAnalysisThemeMode(theme?.dark, defaultSiteConfig.plantAnalysisTheme.dark),
  };
}

function normalizePlantAnalysisThemeMode(
  value: Partial<PlantAnalysisThemeMode> | undefined,
  fallback: PlantAnalysisThemeMode
): PlantAnalysisThemeMode {
  return {
    cardBg: normalizeHexColor(value?.cardBg, fallback.cardBg),
    cardBorder: normalizeHexColor(value?.cardBorder, fallback.cardBorder),
    titleColor: normalizeHexColor(value?.titleColor, fallback.titleColor),
    ingressColor: normalizeHexColor(value?.ingressColor, fallback.ingressColor),
    watchTextColor: normalizeHexColor(value?.watchTextColor, fallback.watchTextColor),
    thrivingPillBg: normalizeHexColor(value?.thrivingPillBg, fallback.thrivingPillBg),
    watchPillBg: normalizeHexColor(value?.watchPillBg, fallback.watchPillBg),
    stressPillBg: normalizeHexColor(value?.stressPillBg, fallback.stressPillBg),
    pillTextColor: normalizeHexColor(value?.pillTextColor, fallback.pillTextColor),
  };
}

function normalizeDisplayThemeConfig(
  value: Partial<DisplayThemeConfig> | undefined,
  fallback: DisplayThemeConfig
): DisplayThemeConfig {
  return {
    dark: normalizeDisplayThemeModeConfig(value?.dark, fallback.dark),
    light: normalizeDisplayThemeModeConfig(value?.light, fallback.light),
  };
}

function normalizeDisplayThemeModeConfig(
  value: Partial<DisplayThemeModeConfig> | undefined,
  fallback: DisplayThemeModeConfig
): DisplayThemeModeConfig {
  return {
    labelColor: normalizeHexColor(value?.labelColor, fallback.labelColor),
    labelOpacity: normalizeNumber(value?.labelOpacity, fallback.labelOpacity, 0, 1),
    unitColor: normalizeHexColor(value?.unitColor, fallback.unitColor),
    defaultValueColor: normalizeHexColor(value?.defaultValueColor, fallback.defaultValueColor),
    temperatureValueColor: normalizeHexColor(value?.temperatureValueColor, fallback.temperatureValueColor),
    normalTemperatureColor: normalizeHexColor(value?.normalTemperatureColor, fallback.normalTemperatureColor),
    coldTemperatureColor: normalizeHexColor(value?.coldTemperatureColor, fallback.coldTemperatureColor),
    warmTemperatureColor: normalizeHexColor(value?.warmTemperatureColor, fallback.warmTemperatureColor),
    hotTemperatureColor: normalizeHexColor(value?.hotTemperatureColor, fallback.hotTemperatureColor),
    coldPulseColor: normalizeHexColor(value?.coldPulseColor, fallback.coldPulseColor),
    hotPulseColor: normalizeHexColor(value?.hotPulseColor, fallback.hotPulseColor),
    warningPulseColor: normalizeHexColor(value?.warningPulseColor, fallback.warningPulseColor),
    coldTickerColor: normalizeHexColor(value?.coldTickerColor, fallback.coldTickerColor),
    hotTickerColor: normalizeHexColor(value?.hotTickerColor, fallback.hotTickerColor),
    mutedColor: normalizeHexColor(value?.mutedColor, fallback.mutedColor),
    symbolColor: normalizeHexColor(value?.symbolColor, fallback.symbolColor),
    graphPanelBg: normalizeHexColor(value?.graphPanelBg, fallback.graphPanelBg),
    graphPanelBorder: normalizeHexColor(value?.graphPanelBorder, fallback.graphPanelBorder),
    logoColor: normalizeHexColor(value?.logoColor, fallback.logoColor),
    doorIconColor: normalizeOptionalHexColor(value?.doorIconColor, fallback.doorIconColor),
    windowIconColor: normalizeOptionalHexColor(value?.windowIconColor, fallback.windowIconColor),
    fanIconColor: normalizeOptionalHexColor(value?.fanIconColor, fallback.fanIconColor),
  };
}

function normalizeHeaderImageConfig(
  input: Partial<HeaderImageConfig> | undefined,
  fallback: HeaderImageConfig,
  legacyDisplayThemeConfig?: Partial<DisplayThemeConfig>,
  legacyPlantAnalysisTheme?: Partial<PlantAnalysisTheme>
): HeaderImageConfig {
  const display = input?.display ?? {};
  const inputWithLegacy = input as Partial<HeaderImageConfig> & { displayTheme?: Partial<DisplayThemeConfig> };
  return {
    ...fallback,
    ...(input ?? {}),
    mobile: typeof input?.mobile === "string" ? input.mobile : fallback.mobile,
    desktop: typeof input?.desktop === "string" ? input.desktop : fallback.desktop,
    mobileVideo: typeof input?.mobileVideo === "string" ? input.mobileVideo : fallback.mobileVideo,
    darkModeColor: normalizeHexColor(input?.darkModeColor, fallback.darkModeColor),
    display: {
      image: typeof display.image === "string" ? display.image : fallback.display.image,
      binary: typeof display.binary === "string" ? display.binary : fallback.display.binary,
      source: typeof display.source === "string" && display.source ? display.source : fallback.display.source,
      zoom: normalizeNumber(display.zoom, fallback.display.zoom, 0.6, 3),
      offsetX: normalizeNumber(display.offsetX, fallback.display.offsetX, -2000, 2000),
      offsetY: normalizeNumber(display.offsetY, fallback.display.offsetY, -2000, 2000),
      size: 466,
      width: 164,
      height: 466,
      x: 302,
      y: 0,
    },
    displayTheme: normalizeDisplayThemeConfig(inputWithLegacy?.displayTheme ?? legacyDisplayThemeConfig, fallback.displayTheme),
    plantAnalysisTheme: normalizePlantAnalysisTheme(inputWithLegacy?.plantAnalysisTheme ?? legacyPlantAnalysisTheme ?? fallback.plantAnalysisTheme),
  };
}

function normalizeHexColor(value: unknown, fallback: string) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback;
}

function normalizeOptionalHexColor(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback || "";
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : fallback || "";
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
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
    rainTodayUpdatedAt: data.rainTodayUpdatedAt,
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

export async function uploadAdminHeaderVideo(file: File, slot: HeaderImageSlot): Promise<AdminImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("assetType", "header-video");
  formData.set("slot", slot);
  formData.set("format", "mobile-video");

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

export async function uploadAdminDisplayImage(file: File, slot: HeaderImageSlot): Promise<AdminImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("assetType", "display-image");
  formData.set("slot", slot);
  formData.set("format", "display-164x466");

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

export async function uploadAdminDisplayBinary(file: File, slot: HeaderImageSlot): Promise<AdminImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("assetType", "display-image");
  formData.set("slot", slot);
  formData.set("format", "display-rgb565-164x466");

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
  assetType: "logo" | "favicon" | "plant-image",
  format: string,
  slot = assetType
): Promise<AdminImage> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("assetType", assetType);
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

export async function deleteAdminImage(key: string): Promise<void> {
  const res = await fetch(greenhouseApiUrl(`/admin/api/images?key=${encodeURIComponent(key)}`), {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
}

export async function renameAdminImage(key: string, filename: string): Promise<AdminImage> {
  const res = await fetch(greenhouseApiUrl("/admin/api/images"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key, filename }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
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

export async function fetchStoredPlantAnalysis(): Promise<PlantAnalysisResponse | null> {
  const res = await fetch(greenhouseApiUrl("/api/plant-analysis"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || `API error: ${res.status}`);
  }

  return json.data || null;
}

export async function generatePlantAnalysis(): Promise<PlantAnalysisResponse> {
  const res = await fetch(greenhouseApiUrl("/admin/api/plant-analysis"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || `API error: ${res.status}`);
  }

  return json.data;
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
  const res = await fetch(greenhouseApiUrl("/api/weather"), {
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
    temperature: data.temperature ?? 0,
    symbolCode: data.symbolCode ?? "cloudy",
    description: data.description ?? "Ukjent",
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    uvIndex: data.uvIndex,
  };
}
