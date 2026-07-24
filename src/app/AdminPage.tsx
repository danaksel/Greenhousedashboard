import { useEffect, useMemo, useRef, useState } from "react";
import SunCalc from "suncalc";
import { Activity, BarChart3, Clock3, Database, Droplets, Eye, GripVertical, ImageIcon, Leaf, Settings2, Thermometer } from "lucide-react";
import {
  defaultSiteConfig,
  acquisitionOptions,
  deleteAdminImage,
  fetchAdminImages,
  fetchAdminSiteConfig,
  fetchLatestGreenhouseData,
  fetchStoredPlantAnalysis,
  fetchPlantAnalysisHistory,
  fetchOpenAiModels,
  fetchNelsonGardenCatalog,
  importNelsonGardenCatalogBatch,
  addNelsonGardenProduct,
  classifyNelsonGardenCatalogBatch,
  fetchWeatherData,
  generatePlantAnalysis,
  generatePlantImages,
  getPlantDevelopmentStageLabel,
  getPlantDevelopmentStageOptions,
  getPlantGrowingLocationLabel,
  logoFontOptions,
  plantTypeOptions,
  plantGroupOptionsByType,
  plantGrowingLocationOptions,
  renameAdminImage,
  resolveGreenhouseAssetUrl,
  saveAdminSiteConfig,
  seedLocationOptions,
  uploadAdminAsset,
  uploadAdminDisplayBinary,
  uploadAdminDisplayImage,
  uploadAdminHeaderVideo,
  uploadAdminImage,
  type AdminImage,
  type DisplayImageConfig,
  type DisplayThemeConfig,
  type DisplayThemeModeConfig,
  type HeaderImageFormat,
  type HeaderImageSlot,
  type LatestData,
  type PlantAnalysisThemeMode,
  type PlantAnalysisResponse,
  type PlantAnalysisRun,
  type PlantConfig,
  type PlantLibraryEntry,
  type PlantDevelopmentStage,
  type PlantSeasonEntry,
  type SiteConfig,
  type SupplierCatalog,
  type WeatherData,
} from "./utils/api";
import { thresholds } from "../config/thresholds";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

const imageSlots: HeaderImageSlot[] = ["coldNight", "night", "cold", "rain", "normal", "warm", "hot"];
const headerVideoGuidance = "MP4/MPEG-4 (H.264), ikke MOV. Web optimized/fast start, uten lyd, sømløs loop. Anbefalt 1920 x 1080 px, 16:9, 3-6 sekunder, maks 10 MB.";
const headerVideoMaxBytes = 10 * 1024 * 1024;
const displayScreenSize = 466;
const displayImageWidth = 164;
const displayImageHeight = 466;
const displayImageX = displayScreenSize - displayImageWidth;
const displayImageY = 0;
const displaySharpenAmount = 0.38;
const greenhouseLatitude = 59.8667;
const greenhouseLongitude = 10.7167;

const statusLabels: Array<{ key: keyof SiteConfig["visibleStatuses"]; label: string }> = [
  { key: "door", label: "Dør" },
  { key: "fan", label: "Vifte" },
  { key: "window", label: "Vindu" },
  { key: "plantLibrary", label: "Plantebibliotek" },
  { key: "plantAnalysis", label: "Analyse" },
  { key: "charts", label: "Statistikk" },
];
const frontPageSectionMeta = {
  climate: { label: "Klima og driftsstatus", description: "Temperatur, luftfuktighet, dør, vindu og vifte." },
  plants: { label: "Plantebibliotek", description: "Kortrekken med planter i aktiv sesong." },
  charts: { label: "Statistikk", description: "Historiske temperatur- og fuktdata." },
} as const;

type DisplayThemeField = { key: keyof DisplayThemeModeConfig; label: string; description: string; type?: "opacity" | "optionalColor" };

const displayThemeFields: DisplayThemeField[] = [
  { key: "labelColor", label: "Overskrifter", description: "Temperatur/Luftfuktighet-label." },
  { key: "labelOpacity", label: "Overskrift opacity", description: "Gjennomsiktighet for label.", type: "opacity" },
  { key: "unitColor", label: "Enhet", description: "°C og %-tegn." },
  { key: "defaultValueColor", label: "Standard tall", description: "Blant annet luftfuktighet." },
  { key: "normalTemperatureColor", label: "Temperatur normal", description: "12-22.9°C." },
  { key: "coldTemperatureColor", label: "Temperatur kald", description: "Under 12°C og regn." },
  { key: "warmTemperatureColor", label: "Temperatur varm", description: "23-28°C." },
  { key: "hotTemperatureColor", label: "Temperatur svært varm", description: "Over 28°C." },
  { key: "coldPulseColor", label: "Puls kald", description: "Varsel/puls ved kaldt." },
  { key: "hotPulseColor", label: "Puls svært varm", description: "Varsel/puls ved varmt." },
  { key: "warningPulseColor", label: "Puls varsel", description: "Generell varselpuls." },
  { key: "coldTickerColor", label: "Ticker kald", description: "Bakgrunn for kald-ticker." },
  { key: "hotTickerColor", label: "Ticker svært varm", description: "Bakgrunn for varm-ticker." },
  { key: "mutedColor", label: "Dempet tekst", description: "Min/maks og hjelpetekst." },
  { key: "symbolColor", label: "Små symboler", description: "Info-symbol på web, wifi/refresh/klokke på skjerm." },
  { key: "graphPanelBg", label: "Grafboks bakgrunn", description: "Bakgrunn for grafboksene på skjerm." },
  { key: "graphPanelBorder", label: "Grafboks kant", description: "Kantlinje for grafboksene på skjerm." },
  { key: "logoColor", label: "Logo/topp", description: "Logo og logotekst øverst på web." },
  { key: "doorIconColor", label: "Dør-symbol", description: "Tom = bruk original SVG.", type: "optionalColor" },
  { key: "windowIconColor", label: "Vindu-symbol", description: "Tom = bruk original SVG.", type: "optionalColor" },
  { key: "fanIconColor", label: "Vifte-symbol", description: "Tom = bruk original SVG.", type: "optionalColor" },
];

const displayThemeGroups: Array<{ id: string; title: string; description: string; fields: Array<keyof DisplayThemeModeConfig> }> = [
  {
    id: "text",
    title: "Tekst og tall",
    description: "Overskrifter, enheter, luftfuktighet og dempet hjelpetekst.",
    fields: ["labelColor", "labelOpacity", "unitColor", "defaultValueColor", "mutedColor"],
  },
  {
    id: "temperature",
    title: "Temperaturgrenser",
    description: "Disse styrer temperaturtallet etter terskel. Egen state-farge brukes ikke.",
    fields: ["normalTemperatureColor", "coldTemperatureColor", "warmTemperatureColor", "hotTemperatureColor"],
  },
  {
    id: "pulse",
    title: "Varsel og ticker",
    description: "Puls styrer tallene. Ticker styrer varselstripen øverst/under bildet.",
    fields: ["coldPulseColor", "hotPulseColor", "warningPulseColor", "coldTickerColor", "hotTickerColor"],
  },
  {
    id: "chrome",
    title: "Grafer, symboler og logo",
    description: "Grafbokser, små infosymboler, skjermens wifi/refresh/klokke og logo.",
    fields: ["symbolColor", "graphPanelBg", "graphPanelBorder", "logoColor"],
  },
  {
    id: "device-icons",
    title: "Dør, vindu og vifte",
    description: "Tomt felt bruker original flerfarget SVG. Bare utfylt farge overstyrer hele symbolet.",
    fields: ["doorIconColor", "windowIconColor", "fanIconColor"],
  },
];

type PlantThemeField = { key: keyof PlantAnalysisThemeMode; label: string; description: string };

const plantThemeFields: PlantThemeField[] = [
  { key: "cardBg", label: "Kort bakgrunn", description: "Standard light #ffffff." },
  { key: "cardBorder", label: "Kort outline", description: "Standard light #d9ded2." },
  { key: "titleColor", label: "Plantetitler", description: "Standard light #505d41." },
  { key: "ingressColor", label: "Ingress", description: "Standard light #505d41." },
  { key: "watchTextColor", label: "Detaljtekst", description: "Teksten under ingress i plantekort." },
  { key: "watchPillBg", label: "Følg med", description: "Pillebakgrunn, hvit tekst." },
  { key: "thrivingPillBg", label: "Trives", description: "Pillebakgrunn, hvit tekst." },
  { key: "stressPillBg", label: "Stress", description: "Pillebakgrunn, hvit tekst." },
  { key: "pillTextColor", label: "Pilletekst", description: "Standard #ffffff." },
];

type AdminSection = "logo" | "visibility" | "plants" | "data" | "metadata" | "header";

const adminSectionGroups = [
  { label: "Drift", sections: [
    { key: "visibility" as const, label: "Oversikt", icon: Eye },
    { key: "plants" as const, label: "Dyrking", icon: Leaf },
  ] },
  { label: "Utseende", sections: [
    { key: "header" as const, label: "Moduser og media", icon: ImageIcon },
    { key: "logo" as const, label: "Profilering", icon: Settings2 },
  ] },
  { label: "System", sections: [
    { key: "data" as const, label: "Datakilder", icon: Database },
    { key: "metadata" as const, label: "Metadata", icon: BarChart3 },
  ] },
];
const adminSections = adminSectionGroups.flatMap((group) => group.sections);

type HomeyIngestDoc = {
  name: string;
  sensor: string;
  aliases: string;
  value: string;
  example: string;
  note: string;
};

const homeyIngestDocs: HomeyIngestDoc[] = [
  {
    name: "Temperatur inne",
    sensor: "temperature",
    aliases: "temp, temperatur",
    value: "Tall i °C",
    example: '{ "sensor": "temperature", "value": 24.1 }',
    note: "Lagres også som 15-minutters historikk for grafer.",
  },
  {
    name: "Luftfuktighet inne",
    sensor: "humidity",
    aliases: "humid, luftfuktighet, fuktighet",
    value: "Tall i %",
    example: '{ "sensor": "humidity", "value": 54.8 }',
    note: "Lagres også som 15-minutters historikk for grafer.",
  },
  {
    name: "Nedbør siden midnatt",
    sensor: "rain_today",
    aliases: "rain, regn",
    value: "Tall i mm",
    example: '{ "sensor": "rain_today", "value": 0.8 }',
    note: "Vises i værwidgeten som akkumulert nedbør.",
  },
  {
    name: "Nedbør siste time",
    sensor: "rain_hour",
    aliases: "–",
    value: "Tall i mm/t",
    example: '{ "sensor": "rain_hour", "value": 0.4 }',
    note: "Vises i værwidgeten som nedbør siste time.",
  },
  {
    name: "Dør",
    sensor: "door",
    aliases: "dør, dor, contact, contact_sensor, contactalarm, contact_alarm",
    value: 'Åpen/lukket: "open", "closed", "ja", "nei", true/false eller 1/0',
    example: '{ "sensor": "door", "value": "open" }',
    note: "Normaliseres til open/closed.",
  },
  {
    name: "Vifte",
    sensor: "fan",
    aliases: "vifte, blower",
    value: 'På/av: "on", "off", "ja", "nei", true/false eller 1/0',
    example: '{ "sensor": "fan", "value": "on" }',
    note: "Normaliseres til on/off.",
  },
  {
    name: "Varme",
    sensor: "heating",
    aliases: "heater, varme, varmeelement, heating_element",
    value: 'På/av: "on", "off", "på", "av", true/false eller 1/0',
    example: '{ "sensor": "heating", "value": "off" }',
    note: "Brukes for å skille varmevifte fra ventilasjon.",
  },
  {
    name: "Vindu",
    sensor: "window",
    aliases: "windows, vindu, vinduer, takvindu, takvinduer",
    value: "Heltall fra 0 til 3",
    example: '{ "sensor": "window", "value": 2 }',
    note: "Verdien betyr antall åpne vinduer.",
  },
];

type HeaderAssetKind = HeaderImageFormat | "mobile-video" | "display-image";

const headerAssetKinds: Array<{ key: HeaderAssetKind; label: string; ratio: string; fallbackFormat: string }> = [
  { key: "desktop", label: "Desktop", ratio: "3:1", fallbackFormat: "JPG/PNG" },
  { key: "mobile", label: "Mobil", ratio: "390:200", fallbackFormat: "JPG/PNG" },
  { key: "mobile-video", label: "Video", ratio: "16:9", fallbackFormat: "MP4" },
  { key: "display-image", label: "Skjerm", ratio: "164:466", fallbackFormat: "PNG" },
];

const adminTagClass =
  "inline-flex items-center rounded-md border border-stone-300 bg-stone-100 px-2 py-1 text-[11px] font-semibold leading-none text-stone-600";
const adminSelectedTagClass =
  "inline-flex items-center rounded-md border border-[#2d3a21] bg-transparent px-2 py-1 text-[11px] font-semibold leading-none text-[#2d3a21]";
const adminPrimaryButtonClass =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg bg-[#5d7342] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-black/10 transition hover:bg-[#4d6137] disabled:cursor-not-allowed disabled:opacity-60";
const adminSecondaryButtonClass =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-[#b9c4ae] bg-white px-4 py-2 text-xs font-semibold text-[#4d5d3e] shadow-sm shadow-black/5 transition hover:border-[#7f936a] hover:bg-[#f7f8f5] disabled:cursor-not-allowed disabled:opacity-45";
const adminDangerButtonClass =
  "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 shadow-sm shadow-black/5 transition hover:bg-red-50";

function isRainWeatherSymbol(symbolCode: string | null | undefined) {
  const symbol = String(symbolCode || "").toLowerCase();
  if (!symbol) return false;
  if (symbol.includes("snow") || symbol.includes("sleet")) return false;
  return symbol.includes("rain") || symbol.includes("thunder");
}

function isNightNow(now = new Date()) {
  const sunTimes = SunCalc.getTimes(now, greenhouseLatitude, greenhouseLongitude);
  return now < sunTimes.sunrise || now >= sunTimes.sunset;
}

function getActiveSlot(temperature: number | null | undefined, symbolCode?: string | null, now = new Date()): HeaderImageSlot {
  const isCold = temperature != null && temperature < thresholds.temperature.min;
  if (isNightNow(now)) return isCold ? "coldNight" : "night";
  if (isCold) return "cold";
  if (isRainWeatherSymbol(symbolCode)) return "rain";
  if (temperature == null) return "normal";
  if (temperature < 23) return "normal";
  if (temperature <= 28) return "warm";
  return "hot";
}

function getValidHexColor(value: string | undefined, fallback: string) {
  const raw = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function formatBytes(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileFormatTag(filename: string | undefined, fallback: string) {
  const extension = filename?.split(".").pop()?.trim().toUpperCase();
  return extension && extension.length <= 5 ? extension : fallback;
}

function isAdminVideoAsset(image: AdminImage) {
  const contentType = String(image.contentType || "").toLowerCase();
  const filename = String(image.filename || image.key || "").toLowerCase();
  return image.assetType === "header-video" || image.format === "mobile-video" || contentType.startsWith("video/") || filename.endsWith(".mp4");
}

function splitFilename(filename: string) {
  const match = filename.match(/^(.*?)(\.[^.]+)$/);
  if (!match) return { base: filename, extension: "" };
  return { base: match[1], extension: match[2] };
}

function sanitizeFilenameBase(value: string) {
  return value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/\.+$/g, "")
    .trim()
    .slice(0, 80);
}

function getUploadSizeGuidance(format: HeaderImageFormat) {
  if (format === "desktop") {
    return "Anbefalt 2400 x 800 px for retina. Minimum 1200 x 400 px. Format 3:1.";
  }

  return "Anbefalt 900 x 460 px for retina. Minimum 780 x 400 px. Format ca. 390:200.";
}

function formatAdminTimestamp(value: string | Date | null | undefined) {
  if (!value) return "Mangler";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukjent";
  return date.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumberValue(value: number | null | undefined, unit: string, decimals = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Mangler";
  return `${value.toFixed(decimals)} ${unit}`;
}

function formatStatusValue(value: string | number | null | undefined, labels: Record<string, string>) {
  if (value === null || value === undefined) return "Mangler";
  return labels[String(value)] ?? String(value);
}

async function svgFileToPngFile(file: File, size: number, filename: string): Promise<File> {
  const svgText = await file.text();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Kunne ikke lese SVG-en"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Kunne ikke lage favicon");

    context.clearRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Kunne ikke eksportere favicon"));
      }, "image/png");
    });

    return new File([pngBlob], filename, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Kunne ikke lese bildet"));
    image.src = resolveGreenhouseAssetUrl(src);
  });
}

async function optimizePlantImageFile(file: File, plantId: string) {
  const url = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(url);
    const targetSize = 512;
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Kunne ikke optimalisere plantebildet");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetSize, targetSize);

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, targetSize, targetSize);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Kunne ikke eksportere optimalisert plantebilde"));
      }, "image/jpeg", 0.84);
    });

    const base = sanitizeFilenameBase(splitFilename(file.name).base || plantId || "plante");
    return new File([blob], `${base}-512.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawDisplayStrip(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  display: Pick<DisplayImageConfig, "zoom" | "offsetX" | "offsetY">,
  x: number,
  y: number,
  width: number,
  height: number
) {
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const scale = coverScale * display.zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const maxPanX = Math.max(0, (drawWidth - width) / 2);
  const maxPanY = Math.max(0, (drawHeight - height) / 2);
  const panX = Math.min(Math.max(display.offsetX, -maxPanX), maxPanX);
  const panY = Math.min(Math.max(display.offsetY, -maxPanY), maxPanY);
  const drawX = x + (width - drawWidth) / 2 - panX;
  const drawY = y + (height - drawHeight) / 2 - panY;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.restore();
}

function sharpenCanvasRegion(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  amount = displaySharpenAmount
) {
  if (amount <= 0 || width < 3 || height < 3) return;

  const imageData = context.getImageData(x, y, width, height);
  const source = new Uint8ClampedArray(imageData.data);
  const target = imageData.data;
  const stride = width * 4;

  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const index = row * stride + col * 4;

      for (let channel = 0; channel < 3; channel++) {
        const center = source[index + channel];
        const average =
          (source[index - 4 + channel] +
            source[index + 4 + channel] +
            source[index - stride + channel] +
            source[index + stride + channel]) /
          4;
        target[index + channel] = Math.max(0, Math.min(255, center + (center - average) * amount));
      }
    }
  }

  context.putImageData(imageData, x, y);
}

async function canvasToPngFile(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Kunne ikke eksportere skjermbildet"));
    }, "image/png");
  });

  return new File([blob], filename, { type: "image/png" });
}

function canvasToRgb565File(canvas: HTMLCanvasElement, filename: string) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Kunne ikke lage RGB565-fil");

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const output = new Uint8Array(canvas.width * canvas.height * 2);

  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 4, targetIndex += 2) {
    const red = data[sourceIndex];
    const green = data[sourceIndex + 1];
    const blue = data[sourceIndex + 2];
    const rgb565 = ((red & 0xf8) << 8) | ((green & 0xfc) << 3) | (blue >> 3);
    output[targetIndex] = rgb565 & 0xff;
    output[targetIndex + 1] = rgb565 >> 8;
  }

  return new File([output], filename, { type: "application/octet-stream" });
}

async function renderDisplayStripCanvas(
  source: string,
  display: Pick<DisplayImageConfig, "zoom" | "offsetX" | "offsetY">
) {
  const image = await loadImageElement(source);
  const canvas = document.createElement("canvas");
  canvas.width = displayImageWidth;
  canvas.height = displayImageHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Kunne ikke lage skjermbilde");

  context.clearRect(0, 0, displayImageWidth, displayImageHeight);
  drawDisplayStrip(context, image, display, 0, 0, displayImageWidth, displayImageHeight);
  sharpenCanvasRegion(context, 0, 0, displayImageWidth, displayImageHeight);

  return canvas;
}

async function renderDisplayStripFile(
  source: string,
  display: Pick<DisplayImageConfig, "zoom" | "offsetX" | "offsetY">,
  filename: string
) {
  const canvas = await renderDisplayStripCanvas(source, display);
  return canvasToPngFile(canvas, filename);
}

function drawDisplayPreviewCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  display: Pick<DisplayImageConfig, "zoom" | "offsetX" | "offsetY">,
  backgroundColor: string
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, displayScreenSize, displayScreenSize);
  context.save();
  context.beginPath();
  context.arc(displayScreenSize / 2, displayScreenSize / 2, displayScreenSize / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, displayScreenSize, displayScreenSize);
  drawDisplayStrip(context, image, display, displayImageX, displayImageY, displayImageWidth, displayImageHeight);
  sharpenCanvasRegion(context, displayImageX, displayImageY, displayImageWidth, displayImageHeight);
  context.restore();
}

export function AdminPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState(() => JSON.stringify(defaultSiteConfig));
  const [images, setImages] = useState<AdminImage[]>([]);
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherFetchedAt, setWeatherFetchedAt] = useState<Date | null>(null);
  const [plantAnalysis, setPlantAnalysis] = useState<PlantAnalysisResponse | null>(null);
  const [plantAnalysisLoading, setPlantAnalysisLoading] = useState(false);
  const [generatingPlantImageId, setGeneratingPlantImageId] = useState<string | null>(null);
  const [generatedPlantImages, setGeneratedPlantImages] = useState<Record<string, AdminImage[]>>({});
  const [plantAnalysisHistory, setPlantAnalysisHistory] = useState<PlantAnalysisRun[]>([]);
  const [openAiModels, setOpenAiModels] = useState<string[]>(["gpt-5.4-mini", "gpt-5-mini"]);
  const [activeSection, setActiveSection] = useState<AdminSection>("visibility");
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantType, setNewPlantType] = useState<PlantLibraryEntry["plantType"]>("Grønnsak");
  const [newPlantGroup, setNewPlantGroup] = useState("");
  const [selectedLibraryPlantId, setSelectedLibraryPlantId] = useState("");
  const [plantWorkspace, setPlantWorkspace] = useState<"season" | "library" | "analysis">("season");
  const [selectedSeasonPlantId, setSelectedSeasonPlantId] = useState("");
  const [editingLibraryPlantId, setEditingLibraryPlantId] = useState("");
  const [plantSearch, setPlantSearch] = useState("");
  const [supplierCatalog, setSupplierCatalog] = useState<SupplierCatalog | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierImporting, setSupplierImporting] = useState(false);
  const [supplierAdding, setSupplierAdding] = useState<string | null>(null);
  const [supplierClassifying, setSupplierClassifying] = useState(false);
  const [supplierClassifyProgress, setSupplierClassifyProgress] = useState(0);
  const [seasonSort, setSeasonSort] = useState<"manual" | "name-asc" | "name-desc" | "type" | "status">("manual");
  const [draggedSeasonPlantId, setDraggedSeasonPlantId] = useState("");
  const [newObservationStage, setNewObservationStage] = useState<PlantDevelopmentStage | "">("");
  const [newObservationDate, setNewObservationDate] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" }));
  const [newObservationNote, setNewObservationNote] = useState("");
  const [selectedHeaderSlot, setSelectedHeaderSlot] = useState<HeaderImageSlot>("normal");
  const [selectedHeaderAssetKind, setSelectedHeaderAssetKind] = useState<HeaderAssetKind>("desktop");
  const [editingImageKey, setEditingImageKey] = useState<string | null>(null);
  const [editingFilenameBase, setEditingFilenameBase] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [displayUploading, setDisplayUploading] = useState(false);
  const [displayPreviewError, setDisplayPreviewError] = useState(false);
  const [displayPreviewVersion, setDisplayPreviewVersion] = useState(0);
  const [displaySourceSize, setDisplaySourceSize] = useState<{ width: number; height: number } | null>(null);
  const [displayLocalSource, setDisplayLocalSource] = useState<{ url: string; filename: string } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headerLibraryRef = useRef<HTMLElement | null>(null);
  const seasonDetailRef = useRef<HTMLElement | null>(null);
  const libraryDetailRef = useRef<HTMLElement | null>(null);
  const displayPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayImageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const displayPreviewImageRef = useRef<HTMLImageElement | null>(null);

  const activeSlot = useMemo(
    () => getActiveSlot(latest?.temperature, weatherData?.symbolCode),
    [latest?.temperature, weatherData?.symbolCode]
  );
  const selectedHeaderConfig = config.headerImages[selectedHeaderSlot];
  const selectedDisplayConfig = selectedHeaderConfig.display;
  const selectedDisplaySource = displayLocalSource?.url || selectedDisplayConfig.source || selectedHeaderConfig.mobile;
  const selectedDarkModeColor = getValidHexColor(
    selectedHeaderConfig.darkModeColor,
    defaultSiteConfig.headerImages[selectedHeaderSlot].darkModeColor
  );
  const displayPanRange = useMemo(() => {
    if (!displaySourceSize) return { x: displayImageWidth / 2, y: displayImageHeight / 2 };
    const coverScale = Math.max(displayImageWidth / displaySourceSize.width, displayImageHeight / displaySourceSize.height);
    const scale = coverScale * selectedDisplayConfig.zoom;
    return {
      x: Math.max(0, Math.round((displaySourceSize.width * scale - displayImageWidth) / 2)),
      y: Math.max(0, Math.round((displaySourceSize.height * scale - displayImageHeight) / 2)),
    };
  }, [displaySourceSize, selectedDisplayConfig.zoom]);
  const configSnapshot = useMemo(() => JSON.stringify(config), [config]);
  const hasUnsavedChanges = !loading && configSnapshot !== savedConfigSnapshot;

  const loadAdminData = async () => {
    setError(null);
    setLoading(true);

    try {
      const [siteConfig, r2Images, latestData, weatherResult, storedPlantAnalysis, analysisHistory, models] = await Promise.all([
        fetchAdminSiteConfig(),
        fetchAdminImages(),
        fetchLatestGreenhouseData().catch(() => null),
        fetchWeatherData()
          .then((data) => ({ data, fetchedAt: new Date() }))
          .catch(() => null),
        fetchStoredPlantAnalysis().catch(() => null),
        fetchPlantAnalysisHistory().catch(() => []),
        fetchOpenAiModels().catch(() => ["gpt-5.4-mini", "gpt-5-mini"]),
      ]);

      setConfig(siteConfig);
      setSavedConfigSnapshot(JSON.stringify(siteConfig));
      setImages(r2Images);
      setLatest(latestData);
      setWeatherData(weatherResult?.data ?? null);
      setWeatherFetchedAt(weatherResult?.fetchedAt ?? null);
      setPlantAnalysis(storedPlantAnalysis);
      setPlantAnalysisHistory(analysisHistory);
      setOpenAiModels(models);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste admin-data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    setSelectedSeasonPlantId("");
    setEditingLibraryPlantId("");
    window.scrollTo({ top: 0 });
  }, [activeSection]);

  useEffect(() => {
    setNewObservationStage("");
    setNewObservationNote("");
    setNewObservationDate(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" }));
  }, [selectedSeasonPlantId]);

  useEffect(() => {
    setSeasonSort(config.plantDisplaySort);
  }, [config.plantDisplaySort]);

  useEffect(() => {
    setDisplayLocalSource(null);
  }, [selectedHeaderSlot]);

  useEffect(() => {
    return () => {
      if (displayLocalSource?.url.startsWith("blob:")) {
        URL.revokeObjectURL(displayLocalSource.url);
      }
    };
  }, [displayLocalSource]);

  useEffect(() => {
    let cancelled = false;
    const cachedImage = displayImageCacheRef.current.get(selectedDisplaySource);

    if (cachedImage) {
      displayPreviewImageRef.current = cachedImage;
      setDisplaySourceSize({ width: cachedImage.naturalWidth, height: cachedImage.naturalHeight });
      setDisplayPreviewError(false);
      setDisplayPreviewVersion((version) => version + 1);
      return;
    }

    loadImageElement(selectedDisplaySource)
      .then((image) => {
        if (cancelled) return;
        displayImageCacheRef.current.set(selectedDisplaySource, image);
        displayPreviewImageRef.current = image;
        setDisplaySourceSize({ width: image.naturalWidth, height: image.naturalHeight });
        setDisplayPreviewError(false);
        setDisplayPreviewVersion((version) => version + 1);
      })
      .catch(() => {
        if (!cancelled) {
          displayPreviewImageRef.current = null;
          setDisplaySourceSize(null);
          setDisplayPreviewError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDisplaySource]);

  useEffect(() => {
    const canvas = displayPreviewCanvasRef.current;
    const image = displayPreviewImageRef.current;
    if (!canvas || !image) return;

    const frame = window.requestAnimationFrame(() => {
      drawDisplayPreviewCanvas(canvas, image, selectedDisplayConfig, selectedDarkModeColor);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedDisplaySource, selectedDisplayConfig.zoom, selectedDisplayConfig.offsetX, selectedDisplayConfig.offsetY, selectedDarkModeColor, displayPreviewError, displayPreviewVersion]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateConfig = (updater: (current: SiteConfig) => SiteConfig) => {
    setConfig((current) => updater(current));
    setMessage(null);
  };

  const setBrandingText = (
    key: "siteName" | "shortName" | "title" | "description",
    value: string
  ) => {
    updateConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        [key]: value,
      },
    }));
  };

  const updateLogoText = (updates: Partial<SiteConfig["branding"]["logoText"]>) => {
    updateConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        logoText: {
          ...current.branding.logoText,
          ...updates,
        },
      },
    }));
  };

  const activeSeasonKey = String(config.activePlantSeasonYear);
  const activeSeasonPlants = config.plantSeasons[activeSeasonKey] ?? [];
  const plantLibraryById = new Map(config.plantLibrary.map((plant) => [plant.id, plant]));
  const availableLibraryPlants = config.plantLibrary.filter(
    (plant) => !activeSeasonPlants.some((season) => season.libraryId === plant.id)
  );
  const selectedSeasonPlant = activeSeasonPlants.find((plant) => plant.id === selectedSeasonPlantId) ?? activeSeasonPlants[0] ?? null;
  const selectedSeasonLibraryPlant = selectedSeasonPlant ? plantLibraryById.get(selectedSeasonPlant.libraryId) ?? null : null;
  const analysisBySeasonId = new Map((plantAnalysis?.items || []).map((item) => [item.id, item]));
  const analysisByLibraryId = new Map((plantAnalysis?.items || []).map((item) => [item.libraryId || item.id, item]));
  const getSeasonAnalysis = (plant: PlantSeasonEntry) => analysisBySeasonId.get(plant.id) || analysisByLibraryId.get(plant.libraryId);
  const selectedSeasonAnalysis = selectedSeasonPlant ? getSeasonAnalysis(selectedSeasonPlant) : null;
  const selectedPlantTimeline = selectedSeasonPlant ? [
    ...(selectedSeasonPlant.acquisition === "seed" && selectedSeasonPlant.seedDate ? [{ id: "system-seed", date: selectedSeasonPlant.seedDate, title: "Sådd", detail: selectedSeasonPlant.seedLocation || "Såsted ikke angitt", kind: "system" as const }] : []),
    ...(selectedSeasonPlant.greenhouseDate ? [{ id: "system-greenhouse", date: selectedSeasonPlant.greenhouseDate, title: "Flyttet til drivhus", detail: selectedSeasonPlant.plantingPlace || "", kind: "system" as const }] : []),
    ...(selectedSeasonPlant.observations || []).map((entry) => ({ id: entry.id, date: entry.date, title: getPlantDevelopmentStageLabel(entry.stage), detail: [getPlantGrowingLocationLabel(entry.growingLocation), entry.growingMedium, entry.note].filter(Boolean).join(" · "), kind: "observation" as const })),
    ...(selectedSeasonPlant.finished && selectedSeasonPlant.harvestDate ? [{ id: "system-finished", date: selectedSeasonPlant.harvestDate, title: selectedSeasonPlant.finishReason === "moved-out" ? "Ferdig" : "Høstet", detail: selectedSeasonPlant.finishReason === "moved-out" ? "Planten er flyttet ut av drivhuset" : "Planten er høstet", kind: "finished" as const }] : []),
  ].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const displayedSeasonPlants = [...activeSeasonPlants].sort((a, b) => {
    if (seasonSort === "manual") return 0;
    const plantA = plantLibraryById.get(a.libraryId);
    const plantB = plantLibraryById.get(b.libraryId);
    const nameA = plantA?.name || "";
    const nameB = plantB?.name || "";
    if (seasonSort === "name-desc") return nameB.localeCompare(nameA, "nb-NO");
    if (seasonSort === "type") return (plantA?.plantType || "").localeCompare(plantB?.plantType || "", "nb-NO") || nameA.localeCompare(nameB, "nb-NO");
    if (seasonSort === "status") {
      const ranks = { stress: 0, "følg med": 1, trives: 2 } as const;
      const statusA = getSeasonAnalysis(a)?.status || "følg med";
      const statusB = getSeasonAnalysis(b)?.status || "følg med";
      return Number(b.active) - Number(a.active) || (ranks[statusA] ?? 1) - (ranks[statusB] ?? 1) || nameA.localeCompare(nameB, "nb-NO");
    }
    return nameA.localeCompare(nameB, "nb-NO");
  });
  const normalizedPlantSearch = plantSearch.trim().toLocaleLowerCase("nb-NO");
  const filteredLibraryPlants = config.plantLibrary.filter((plant) =>
    !normalizedPlantSearch || `${plant.name} ${plant.plantType} ${plant.plantGroup} ${plant.description}`.toLocaleLowerCase("nb-NO").includes(normalizedPlantSearch)
  );
  const editingLibraryPlant = config.plantLibrary.find((plant) => plant.id === editingLibraryPlantId) ?? filteredLibraryPlants[0] ?? null;
  const overviewMetrics = [
    { label: "Temperatur", value: latest?.temperature == null ? "–" : `${latest.temperature.toFixed(1)}°C`, detail: "I drivhuset", icon: Thermometer },
    { label: "Luftfuktighet", value: latest?.humidity == null ? "–" : `${latest.humidity.toFixed(0)}%`, detail: "I drivhuset", icon: Droplets },
    { label: "Aktive planter", value: String(activeSeasonPlants.filter((plant) => plant.active).length), detail: `Sesong ${config.activePlantSeasonYear}`, icon: Leaf },
    { label: "Plantebibliotek", value: String(config.plantLibrary.length), detail: "Permanente planter", icon: Database },
    { label: "Aktiv modus", value: config.headerImages[activeSlot].label, detail: config.headerImages[activeSlot].description, icon: Activity },
    { label: "Siste data", value: latest?.updatedAt ? new Date(latest.updatedAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }) : "–", detail: latest?.updatedAt ? new Date(latest.updatedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) : "Ingen sensordata", icon: Clock3 },
  ];
  const selectSeasonPlant = (id: string) => {
    setSelectedSeasonPlantId(id);
    if (window.innerWidth < 1280) window.requestAnimationFrame(() => seasonDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const selectLibraryPlant = (id: string) => {
    setEditingLibraryPlantId(id);
    if (window.innerWidth < 1280) window.requestAnimationFrame(() => libraryDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const persistConfig = async (nextConfig: SiteConfig, successMessage = "Lagret") => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveAdminSiteConfig(nextConfig);
      setConfig(saved);
      setSavedConfigSnapshot(JSON.stringify(saved));
      setMessage(successMessage);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const addObservation = async () => {
    if (saving || !selectedSeasonPlant || !newObservationStage || !newObservationDate) return;
    const observation = { id: `${selectedSeasonPlant.id}-${Date.now().toString(36)}`, date: newObservationDate, stage: newObservationStage, note: newObservationNote.trim(), growingLocation: selectedSeasonPlant.growingLocation, growingMedium: selectedSeasonPlant.plantingPlace };
    const observations = [...(selectedSeasonPlant.observations || []), observation].sort((a, b) => a.date.localeCompare(b.date));
    const latestObservation = observations.at(-1)!;
    const yearKey = String(config.activePlantSeasonYear);
    const nextConfig = { ...config, plantSeasons: { ...config.plantSeasons, [yearKey]: (config.plantSeasons[yearKey] || []).map((plant) => plant.id === selectedSeasonPlant.id ? { ...plant, observations, developmentStage: latestObservation.stage, observedAt: latestObservation.date, observation: latestObservation.note } : plant) } };
    const saved = await persistConfig(nextConfig, "Observasjonen er lagt til og lagret.");
    if (saved) {
      setNewObservationStage("");
      setNewObservationNote("");
      setNewObservationDate(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" }));
    }
  };
  const removeObservation = (observationId: string) => {
    if (!selectedSeasonPlant) return;
    const observations = (selectedSeasonPlant.observations || []).filter((item) => item.id !== observationId);
    const latestObservation = [...observations].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    updatePlant(selectedSeasonPlant.id, { observations, developmentStage: latestObservation?.stage || "", observedAt: latestObservation?.date || "", observation: latestObservation?.note || "" });
  };

  const updatePlantLibrary = (updater: (plants: PlantLibraryEntry[]) => PlantLibraryEntry[]) => {
    updateConfig((current) => ({
      ...current,
      plantLibrary: updater(current.plantLibrary),
    }));
  };

  const updateActiveSeasonPlants = (updater: (plants: PlantSeasonEntry[]) => PlantSeasonEntry[]) => {
    updateConfig((current) => {
      const key = String(current.activePlantSeasonYear);
      const nextSeason = updater(current.plantSeasons[key] ?? []);
      return {
        ...current,
        plantSeasons: {
          ...current.plantSeasons,
          [key]: nextSeason,
        },
      };
    });
  };

  const setActivePlantYear = (year: number) => {
    updateConfig((current) => ({
      ...current,
      activePlantSeasonYear: year,
      plantSeasons: {
        ...current.plantSeasons,
        [String(year)]: current.plantSeasons[String(year)] ?? [],
      },
    }));
  };

  const addPlant = () => {
    const name = newPlantName.trim();
    if (!name) return;
    const idBase = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "plante";
    const id = `${idBase}-${Date.now().toString(36)}`;
    const seasonId = `${id}-${config.activePlantSeasonYear}`;
    updateConfig((current) => {
      const yearKey = String(current.activePlantSeasonYear);
      return {
        ...current,
        plantLibrary: [...current.plantLibrary, { id, name, plantType: newPlantType, plantGroup: newPlantGroup, description: "", image: "" }],
        plantSeasons: {
          ...current.plantSeasons,
          [yearKey]: [
            ...(current.plantSeasons[yearKey] ?? []),
            {
              id: seasonId,
              year: current.activePlantSeasonYear,
              libraryId: id,
              acquisition: "plant",
              seedDate: "",
              seedLocation: "",
              greenhouseDate: "",
              purchaseSource: "",
              finished: false,
              finishReason: "",
              harvestDate: "",
              plantingPlace: "",
              growingLocation: "",
              developmentStage: "",
              observedAt: "",
              observation: "",
              observations: [],
              active: true,
              note: "",
            },
          ],
        },
      };
    });
    setNewPlantName("");
    setNewPlantType("Grønnsak");
    setNewPlantGroup("");
    setMessage(`${name} er lagt til. Husk å lagre.`);
  };

  const addLibraryPlant = () => {
    const name = newPlantName.trim();
    if (!name) return;
    const idBase = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plante";
    const id = `${idBase}-${Date.now().toString(36)}`;
    updatePlantLibrary((plants) => [...plants, { id, name, plantType: newPlantType, plantGroup: newPlantGroup, description: "", image: "" }]);
    setEditingLibraryPlantId(id);
    setNewPlantName("");
    setNewPlantGroup("");
    setMessage(`${name} er opprettet i plantebiblioteket. Husk å lagre.`);
  };

  const loadSupplierCatalog = async () => {
    try {
      setError(null);
      setSupplierCatalog(await fetchNelsonGardenCatalog());
    } catch (catalogError) {
      setError(catalogError instanceof Error ? catalogError.message : "Kunne ikke hente produktkatalogen.");
    }
  };

  const importSupplierCatalog = async () => {
    setSupplierImporting(true);
    setError(null);
    try {
      let cursor = 0;
      let catalog: SupplierCatalog;
      do {
        catalog = await importNelsonGardenCatalogBatch(cursor);
        setSupplierCatalog(catalog);
        cursor = catalog.cursor || 0;
      } while (!catalog.done);
      setMessage(`Nelson Garden-katalogen er oppdatert med ${catalog.products.length} frøprodukter.`);
    } catch (catalogError) {
      setError(catalogError instanceof Error ? catalogError.message : "Importen stoppet.");
    } finally {
      setSupplierImporting(false);
    }
  };

  const addSupplierProductToLibrary = async (articleNumber: string) => {
    setSupplierAdding(articleNumber);
    setError(null);
    try {
      const entry = await addNelsonGardenProduct(articleNumber);
      updatePlantLibrary((plants) => plants.some((plant) => plant.id === entry.id)
        ? plants.map((plant) => plant.id === entry.id ? { ...plant, ...entry } : plant)
        : [...plants, entry]);
      setEditingLibraryPlantId(entry.id);
      setMessage(`${entry.name} er lagt til i plantebiblioteket. Husk å lagre.`);
    } catch (catalogError) {
      setError(catalogError instanceof Error ? catalogError.message : "Kunne ikke legge produktet til.");
    } finally {
      setSupplierAdding(null);
    }
  };

  const classifySupplierCatalog = async () => {
    setSupplierClassifying(true); setSupplierClassifyProgress(0); setError(null);
    try {
      let cursor = 0; let result;
      do { result = await classifyNelsonGardenCatalogBatch(cursor); cursor = result.cursor; setSupplierClassifyProgress(cursor); } while (!result.done);
      await loadSupplierCatalog();
      setMessage(`${result.total} Nelson Garden-produkter er klassifisert mot eksisterende plantetyper og plantegrupper.`);
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "Klassifiseringen stoppet.");
    } finally { setSupplierClassifying(false); }
  };

  const addPlantFromLibraryById = (libraryId: string) => {
    const plant = config.plantLibrary.find((item) => item.id === libraryId);
    if (!plant) return;
    updateActiveSeasonPlants((plants) => [
      ...plants,
      {
        id: `${libraryId}-${config.activePlantSeasonYear}-${Date.now().toString(36)}`,
        year: config.activePlantSeasonYear,
        libraryId,
        acquisition: "plant",
        seedDate: "",
        seedLocation: "",
        greenhouseDate: "",
        purchaseSource: "",
        finished: false,
        finishReason: "",
        harvestDate: "",
        plantingPlace: "",
        growingLocation: "",
        developmentStage: "",
        observedAt: "",
        observation: "",
        observations: [],
        active: true,
        note: "",
      },
    ]);
    setSelectedLibraryPlantId("");
    setMessage(`${plant.name} er lagt til i ${config.activePlantSeasonYear}. Husk å lagre.`);
  };

  const addPlantFromLibrary = () => addPlantFromLibraryById(selectedLibraryPlantId);

  const updatePlant = (id: string, updates: Partial<PlantSeasonEntry>) => {
    updateActiveSeasonPlants((plants) => plants.map((plant) => plant.id === id ? { ...plant, ...updates } : plant));
  };

  const updateLibraryPlant = (id: string, updates: Partial<PlantLibraryEntry>) => {
    updatePlantLibrary((plants) => plants.map((plant) => plant.id === id ? { ...plant, ...updates } : plant));
  };

  const deleteLibraryPlant = (plant: PlantLibraryEntry) => {
    const seasonCount = Object.values(config.plantSeasons).reduce((total, season) => total + season.filter((entry) => entry.libraryId === plant.id).length, 0);
    const consequence = seasonCount ? ` Planten fjernes også fra ${seasonCount} sesongoppføring${seasonCount === 1 ? "" : "er"}.` : "";
    if (!window.confirm(`Slette ${plant.name} fra plantebiblioteket?${consequence}`)) return;
    updateConfig((current) => ({
      ...current,
      plantLibrary: current.plantLibrary.filter((entry) => entry.id !== plant.id),
      plantSeasons: Object.fromEntries(Object.entries(current.plantSeasons).map(([year, season]) => [year, season.filter((entry) => entry.libraryId !== plant.id)])),
    }));
    setEditingLibraryPlantId("");
    setMessage(`${plant.name} er fjernet fra biblioteket. Husk å lagre.`);
  };

  const movePlant = (fromIndex: number, toIndex: number) => {
    updateActiveSeasonPlants((plants) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= plants.length || toIndex >= plants.length) {
        return plants;
      }

      const next = [...plants];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  const movePlantById = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    updateActiveSeasonPlants((plants) => {
      const fromIndex = plants.findIndex((plant) => plant.id === sourceId);
      const toIndex = plants.findIndex((plant) => plant.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return plants;
      const next = [...plants];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  const moveFrontPageSection = (index: number, direction: -1 | 1) => {
    updateConfig((current) => {
      const next = [...current.frontPageSectionOrder];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, frontPageSectionOrder: next };
    });
  };

  const removePlant = (id: string) => {
    const season = activeSeasonPlants.find((item) => item.id === id);
    const plant = season ? plantLibraryById.get(season.libraryId) : null;
    updateActiveSeasonPlants((plants) => plants.filter((item) => item.id !== id));
    setMessage(`${plant?.name || "Planten"} er fjernet fra sesongen. Husk å lagre.`);
  };

  const setPlantThemeValue = (
    mode: keyof SiteConfig["plantAnalysisTheme"],
    key: keyof PlantAnalysisThemeMode,
    value: string
  ) => {
    updateConfig((current) => ({
      ...current,
      headerImages: Object.fromEntries(imageSlots.map((slot) => [
        slot,
        {
          ...current.headerImages[slot],
          plantAnalysisTheme: {
            ...current.headerImages.normal.plantAnalysisTheme,
            [mode]: {
              ...current.headerImages.normal.plantAnalysisTheme[mode],
              [key]: value,
            },
          },
        },
      ])) as SiteConfig["headerImages"],
    }));
  };

  const handlePlantImageUpload = async (plant: PlantLibraryEntry, file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Plantebildet må være PNG eller JPG.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const optimizedFile = await optimizePlantImageFile(file, plant.id);
      const image = await uploadAdminAsset(optimizedFile, "plant-image", "square", plant.id);
      setImages((current) => [image, ...current.filter((item) => item.key !== image.key)]);
      updateLibraryPlant(plant.id, { image: image.url });
      setMessage(`${image.filename} er optimalisert og valgt for ${plant.name}. Husk å lagre.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp plantebildet");
    } finally {
      setUploading(false);
    }
  };

  const handleGeneratePlantImages = async (plant: PlantLibraryEntry) => {
    setGeneratingPlantImageId(plant.id);
    setError(null);
    setMessage(null);
    try {
      const result = await generatePlantImages(plant.id);
      setImages((current) => [...result.images, ...current.filter((item) => !result.images.some((generated) => generated.key === item.key))]);
      setGeneratedPlantImages((current) => ({ ...current, [plant.id]: result.images }));
      setMessage(`To forslag for ${plant.name} er generert og lagret i plantens R2-bibliotek.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke generere plantebilder");
    } finally {
      setGeneratingPlantImageId(null);
    }
  };

  const handleGeneratePlantAnalysis = async () => {
    setPlantAnalysisLoading(true);
    setError(null);
    setMessage(null);

    try {
      const analysis = await generatePlantAnalysis();
      setPlantAnalysis(analysis);
      setPlantAnalysisHistory(await fetchPlantAnalysisHistory().catch(() => plantAnalysisHistory));
      setMessage("Ny planteanalyse er generert og lagret.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke generere planteanalyse");
    } finally {
      setPlantAnalysisLoading(false);
    }
  };

  const setImage = (slot: HeaderImageSlot, format: HeaderImageFormat, value: string) => {
    updateConfig((current) => ({
      ...current,
      headerImages: {
        ...current.headerImages,
        [slot]: {
          ...current.headerImages[slot],
          [format]: value,
        },
      },
    }));
  };

  const applyImage = (slot: HeaderImageSlot, format: HeaderImageFormat, image: AdminImage) => {
    setImage(slot, format, image.url);
    setMessage(`${image.filename} er valgt for ${config.headerImages[slot].label.toLowerCase()} / ${format === "desktop" ? "desktop" : "mobil"}. Husk å lagre.`);
  };

  const setMobileVideo = (slot: HeaderImageSlot, value: string) => {
    updateConfig((current) => ({
      ...current,
      headerImages: {
        ...current.headerImages,
        [slot]: {
          ...current.headerImages[slot],
          mobileVideo: value,
        },
      },
    }));
  };

  const setHeaderDarkModeColor = (slot: HeaderImageSlot, value: string) => {
    updateConfig((current) => ({
      ...current,
      headerImages: {
        ...current.headerImages,
        [slot]: {
          ...current.headerImages[slot],
          darkModeColor: value,
        },
      },
    }));
  };

  const setDisplayThemeValue = (
    _slot: HeaderImageSlot,
    mode: keyof DisplayThemeConfig,
    key: keyof DisplayThemeModeConfig,
    value: string | number
  ) => {
    updateConfig((current) => ({
      ...current,
      headerImages: Object.fromEntries(imageSlots.map((slot) => [
        slot,
        {
          ...current.headerImages[slot],
          displayTheme: {
            ...current.headerImages.normal.displayTheme,
            [mode]: {
              ...current.headerImages.normal.displayTheme[mode],
              [key]: value,
            },
          },
        },
      ])) as SiteConfig["headerImages"],
    }));
  };

  const resetDisplayThemeForSlot = (_slot: HeaderImageSlot) => {
    updateConfig((current) => ({
      ...current,
      headerImages: Object.fromEntries(imageSlots.map((slot) => [
        slot,
        {
          ...current.headerImages[slot],
          displayTheme: defaultSiteConfig.headerImages.normal.displayTheme,
          plantAnalysisTheme: defaultSiteConfig.headerImages.normal.plantAnalysisTheme,
        },
      ])) as SiteConfig["headerImages"],
    }));
    setMessage("Standardtemaet er tilbakestilt. Husk å lagre.");
  };

  const setSemanticThemeValue = (
    mode: keyof DisplayThemeConfig,
    role: "primary" | "secondary" | "surface" | "border" | "normal" | "cold" | "warning" | "critical" | "positive",
    value: string
  ) => {
    const displayKeys: Partial<Record<typeof role, Array<keyof DisplayThemeModeConfig>>> = {
      primary: ["labelColor", "logoColor"],
      secondary: ["unitColor", "mutedColor", "symbolColor"],
      surface: ["graphPanelBg"],
      border: ["graphPanelBorder"],
      normal: ["defaultValueColor", "normalTemperatureColor", "temperatureValueColor"],
      cold: ["coldTemperatureColor", "coldPulseColor", "coldTickerColor"],
      warning: ["warmTemperatureColor", "warningPulseColor"],
      critical: ["hotTemperatureColor", "hotPulseColor", "hotTickerColor"],
    };
    const plantKeys: Partial<Record<typeof role, Array<keyof PlantAnalysisThemeMode>>> = {
      primary: ["titleColor", "ingressColor"],
      secondary: ["watchTextColor"],
      surface: ["cardBg"],
      border: ["cardBorder"],
      warning: ["watchPillBg"],
      critical: ["stressPillBg"],
      positive: ["thrivingPillBg"],
    };

    updateConfig((current) => {
      const displayMode = { ...current.headerImages.normal.displayTheme[mode] };
      const plantMode = { ...current.headerImages.normal.plantAnalysisTheme[mode] };
      for (const key of displayKeys[role] || []) (displayMode[key] as string | number) = value;
      for (const key of plantKeys[role] || []) plantMode[key] = value;

      return {
        ...current,
        headerImages: Object.fromEntries(imageSlots.map((slot) => [slot, {
          ...current.headerImages[slot],
          displayTheme: { ...current.headerImages.normal.displayTheme, [mode]: displayMode },
          plantAnalysisTheme: { ...current.headerImages.normal.plantAnalysisTheme, [mode]: plantMode },
        }])) as SiteConfig["headerImages"],
      };
    });
  };

  const setDisplayConfig = (slot: HeaderImageSlot, updates: Partial<DisplayImageConfig>) => {
    updateConfig((current) => ({
      ...current,
      headerImages: {
        ...current.headerImages,
        [slot]: {
          ...current.headerImages[slot],
          display: {
            ...current.headerImages[slot].display,
            ...updates,
            size: displayScreenSize,
            width: displayImageWidth,
            height: displayImageHeight,
            x: displayImageX,
            y: displayImageY,
          },
        },
      },
    }));
  };

  const setDisplaySourceFromFile = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Skjermbildet må komme fra PNG eller JPG.");
      return;
    }

    if (displayLocalSource?.url.startsWith("blob:")) {
      URL.revokeObjectURL(displayLocalSource.url);
    }

    const url = URL.createObjectURL(file);
    setDisplayLocalSource({ url, filename: file.name });
    setDisplayConfig(selectedHeaderSlot, {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  };

  const setDisplaySourceFromAsset = (slot: HeaderImageSlot, source: string) => {
    setDisplayLocalSource(null);
    setDisplayConfig(slot, {
      source,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  };

  useEffect(() => {
    const nextOffsetX = Math.min(Math.max(selectedDisplayConfig.offsetX, -displayPanRange.x), displayPanRange.x);
    const nextOffsetY = Math.min(Math.max(selectedDisplayConfig.offsetY, -displayPanRange.y), displayPanRange.y);
    if (nextOffsetX === selectedDisplayConfig.offsetX && nextOffsetY === selectedDisplayConfig.offsetY) return;
    setDisplayConfig(selectedHeaderSlot, {
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    });
  }, [
    displayPanRange.x,
    displayPanRange.y,
    selectedDisplayConfig.offsetX,
    selectedDisplayConfig.offsetY,
    selectedHeaderSlot,
  ]);

  const handleGenerateDisplayImage = async () => {
    const slot = selectedHeaderSlot;
    const slotConfig = config.headerImages[slot];
    const display = slotConfig.display;
    const source = displayLocalSource?.url || display.source || slotConfig.mobile;

    setDisplayUploading(true);
    setError(null);
    setMessage(null);

    try {
      const filenameBase = displayLocalSource?.filename?.replace(/\.[^.]+$/i, "") || `${slot}-display`;
      const canvas = await renderDisplayStripCanvas(source, display);
      const pngFile = await canvasToPngFile(canvas, `${filenameBase}-display-164x466.png`);
      const binaryFile = canvasToRgb565File(canvas, `${filenameBase}-display-rgb565-164x466.bin`);
      const [image, binary] = await Promise.all([
        uploadAdminDisplayImage(pngFile, slot),
        uploadAdminDisplayBinary(binaryFile, slot),
      ]);
      setImages((current) => [image, binary, ...current.filter((item) => item.key !== image.key && item.key !== binary.key)]);
      setDisplayConfig(slot, {
        image: image.url,
        binary: binary.url,
        source: displayLocalSource ? image.url : source,
        zoom: displayLocalSource ? 1 : display.zoom,
        offsetX: displayLocalSource ? 0 : display.offsetX,
        offsetY: displayLocalSource ? 0 : display.offsetY,
      });
      setDisplayLocalSource(null);
      setMessage(`Skjermbildet er generert for ${slotConfig.label.toLowerCase()}. Husk å lagre.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke generere skjermbildet");
    } finally {
      setDisplayUploading(false);
    }
  };

  const applyVideo = (slot: HeaderImageSlot, video: AdminImage) => {
    setMobileVideo(slot, video.url);
    setMessage(`${video.filename} er valgt som mobilvideo for ${config.headerImages[slot].label.toLowerCase()}. Husk å lagre.`);
  };

  const handleSave = async () => {
    await persistConfig(config);
  };

  const handleSlotImageUpload = async (
    slot: HeaderImageSlot,
    format: HeaderImageFormat,
    file: File | undefined
  ) => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const image = await uploadAdminImage(file, slot, format);
      setImages((current) => [image, ...current.filter((item) => item.key !== image.key)]);
      setImage(slot, format, image.url);
      setMessage(`Bildet er lastet opp og valgt for ${config.headerImages[slot].label.toLowerCase()} / ${format === "desktop" ? "desktop" : "mobil"}. Husk å lagre.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp bildet");
    } finally {
      setUploading(false);
    }
  };

  const handleSlotVideoUpload = async (slot: HeaderImageSlot, file: File | undefined) => {
    if (!file) return;

    if (file.type !== "video/mp4") {
      setError("Header-video må være MP4 (H.264). MOV bør eksporteres/konverteres til MP4 før opplasting.");
      return;
    }

    if (file.size > headerVideoMaxBytes) {
      setError("Header-video må være maks 10 MB.");
      return;
    }

    setVideoUploading(true);
    setError(null);
    setMessage(null);

    try {
      const video = await uploadAdminHeaderVideo(file, slot);
      setImages((current) => [video, ...current.filter((item) => item.key !== video.key)]);
      setMobileVideo(slot, video.url);
      setMessage(`Videoen er lastet opp og valgt for ${config.headerImages[slot].label.toLowerCase()} / mobil. Husk å lagre.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp video");
    } finally {
      setVideoUploading(false);
    }
  };

  const setLogo = (url: string) => {
    updateConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        logo: {
          ...current.branding.logo,
          url,
        },
      },
    }));
  };

  const setLogoSize = (size: number) => {
    updateConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        logo: {
          ...current.branding.logo,
          size,
        },
      },
    }));
  };

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;

    setLogoUploading(true);
    setError(null);
    setMessage(null);

    try {
      const logo = await uploadAdminAsset(file, "logo", "svg");
      setImages((current) => [logo, ...current.filter((item) => item.key !== logo.key)]);
      setLogo(logo.url);
      setMessage("Logoen er lastet opp og valgt. Husk å lagre.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const setFaviconConfig = (favicon: SiteConfig["branding"]["favicon"]) => {
    updateConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        favicon,
      },
    }));
  };

  const handleFaviconUpload = async (file: File | undefined) => {
    if (!file) return;

    setFaviconUploading(true);
    setError(null);
    setMessage(null);

    try {
      const baseName = file.name.replace(/\.svg$/i, "") || "favicon";
      const [svg, png32, png180, png192, png512] = await Promise.all([
        uploadAdminAsset(file, "favicon", "svg"),
        svgFileToPngFile(file, 32, `${baseName}-32.png`).then((png) => uploadAdminAsset(png, "favicon", "png32")),
        svgFileToPngFile(file, 180, `${baseName}-180.png`).then((png) => uploadAdminAsset(png, "favicon", "apple-touch-icon")),
        svgFileToPngFile(file, 192, `${baseName}-192.png`).then((png) => uploadAdminAsset(png, "favicon", "png192")),
        svgFileToPngFile(file, 512, `${baseName}-512.png`).then((png) => uploadAdminAsset(png, "favicon", "png512")),
      ]);

      const uploaded = [svg, png32, png180, png192, png512];
      setImages((current) => [
        ...uploaded,
        ...current.filter((item) => !uploaded.some((asset) => asset.key === item.key)),
      ]);
      setFaviconConfig({
        svg: svg.url,
        png32: png32.url,
        appleTouchIcon: png180.url,
        png192: png192.url,
        png512: png512.url,
      });
      setMessage("Favicon er generert i alle størrelser og valgt. Husk å lagre.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lage favicon");
    } finally {
      setFaviconUploading(false);
    }
  };

  const handleUseFaviconAsset = async (asset: AdminImage) => {
    try {
      const res = await fetch(resolveGreenhouseAssetUrl(asset.url));
      if (!res.ok) throw new Error("Kunne ikke hente favicon fra R2");
      const blob = await res.blob();
      const file = new File([blob], asset.filename.endsWith(".svg") ? asset.filename : `${asset.filename}.svg`, {
        type: "image/svg+xml",
      });
      await handleFaviconUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke bruke favicon");
    }
  };

  const replaceDeletedImageReferences = (current: SiteConfig, deletedUrl: string): SiteConfig => {
    const next: SiteConfig = {
      ...current,
      headerImages: {
        ...current.headerImages,
      },
    };

    for (const slot of imageSlots) {
      next.headerImages[slot] = {
        ...next.headerImages[slot],
        desktop:
          next.headerImages[slot].desktop === deletedUrl
            ? defaultSiteConfig.headerImages[slot].desktop
            : next.headerImages[slot].desktop,
        mobile:
          next.headerImages[slot].mobile === deletedUrl
            ? defaultSiteConfig.headerImages[slot].mobile
            : next.headerImages[slot].mobile,
        mobileVideo:
          next.headerImages[slot].mobileVideo === deletedUrl
            ? defaultSiteConfig.headerImages[slot].mobileVideo
            : next.headerImages[slot].mobileVideo,
        display: {
          ...next.headerImages[slot].display,
          image:
            next.headerImages[slot].display.image === deletedUrl
              ? defaultSiteConfig.headerImages[slot].display.image
              : next.headerImages[slot].display.image,
          binary:
            next.headerImages[slot].display.binary === deletedUrl
              ? defaultSiteConfig.headerImages[slot].display.binary
              : next.headerImages[slot].display.binary,
          source:
            next.headerImages[slot].display.source === deletedUrl
              ? defaultSiteConfig.headerImages[slot].display.source
              : next.headerImages[slot].display.source,
        },
      };
    }

    next.branding = {
      ...current.branding,
      logo: {
        ...current.branding.logo,
        url:
          current.branding.logo.url === deletedUrl
            ? defaultSiteConfig.branding.logo.url
            : current.branding.logo.url,
      },
      favicon: {
        svg:
          current.branding.favicon.svg === deletedUrl
            ? defaultSiteConfig.branding.favicon.svg
            : current.branding.favicon.svg,
        png32:
          current.branding.favicon.png32 === deletedUrl
            ? defaultSiteConfig.branding.favicon.png32
            : current.branding.favicon.png32,
        appleTouchIcon:
          current.branding.favicon.appleTouchIcon === deletedUrl
            ? defaultSiteConfig.branding.favicon.appleTouchIcon
            : current.branding.favicon.appleTouchIcon,
        png192:
          current.branding.favicon.png192 === deletedUrl
            ? defaultSiteConfig.branding.favicon.png192
            : current.branding.favicon.png192,
        png512:
          current.branding.favicon.png512 === deletedUrl
            ? defaultSiteConfig.branding.favicon.png512
            : current.branding.favicon.png512,
      },
    };

    next.plantLibrary = current.plantLibrary.map((plant) => ({
      ...plant,
      image: plant.image === deletedUrl ? "" : plant.image,
    }));

    return next;
  };

  const handleDeleteImage = async (image: AdminImage) => {
    const confirmed = window.confirm(`Slette ${image.filename} fra R2?`);
    if (!confirmed) return;

    setError(null);
    setMessage(null);

    try {
      await deleteAdminImage(image.key);
      setImages((current) => current.filter((item) => item.key !== image.key));
      setConfig((current) => replaceDeletedImageReferences(current, image.url));
      setMessage("Bildet er slettet. Eventuelle referanser er satt tilbake til standardbilde. Husk å lagre.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slette bildet");
    }
  };

  const startRenameImage = (image: AdminImage) => {
    const { base } = splitFilename(image.filename);
    setEditingImageKey(image.key);
    setEditingFilenameBase(base);
  };

  const cancelRenameImage = () => {
    setEditingImageKey(null);
    setEditingFilenameBase("");
  };

  const saveRenameImage = async (image: AdminImage) => {
    const { base, extension } = splitFilename(image.filename);
    const nextBase = sanitizeFilenameBase(editingFilenameBase);

    if (!nextBase || nextBase === base) {
      cancelRenameImage();
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const renamed = await renameAdminImage(image.key, `${nextBase}${extension}`);
      setImages((current) => current.map((item) => (item.key === renamed.key ? renamed : item)));
      setMessage("Filnavnet er endret.");
      cancelRenameImage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke endre filnavnet");
    }
  };

  const handleReloadAdminData = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Du har ulagrede endringer. Vil du forkaste dem og laste admin-data på nytt?")
    ) {
      return;
    }

    void loadAdminData();
  };

  const openHeaderLibrary = (kind: HeaderAssetKind) => {
    setSelectedHeaderAssetKind(kind);
    window.requestAnimationFrame(() => {
      headerLibraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const headerAssets = images.filter((image) => (image.assetType ?? "header") === "header" && !isAdminVideoAsset(image));
  const headerVideoAssets = images.filter(isAdminVideoAsset);
  const displayImageAssets = images.filter((image) => image.assetType === "display-image");
  const logoAssets = images.filter((image) => image.assetType === "logo");
  const faviconAssets = images.filter((image) => image.assetType === "favicon");
  const plantImageAssets = images.filter((image) => image.assetType === "plant-image");
  const getPlantImageAssets = (plant: PlantLibraryEntry) =>
    plantImageAssets.filter((image) => image.slot === plant.id || image.url === plant.image);
  const imageBackgroundPalette = useMemo(() => {
    const display = config.headerImages.normal.displayTheme.dark;
    const plants = config.headerImages.normal.plantAnalysisTheme.dark;
    return [
      { label: "Primær tekst", color: display.labelColor },
      { label: "Sekundær tekst", color: display.mutedColor },
      { label: "Flater og kort", color: display.graphPanelBg },
      { label: "Kantlinjer", color: display.graphPanelBorder },
      { label: "Normalverdi", color: display.normalTemperatureColor },
      { label: "Kald", color: display.coldTemperatureColor },
      { label: "Varm / følg med", color: display.warmTemperatureColor },
      { label: "Svært varm / stress", color: display.hotTemperatureColor },
      { label: "Trives", color: plants.thrivingPillBg },
    ];
  }, [config.headerImages.normal.displayTheme.dark, config.headerImages.normal.plantAnalysisTheme.dark]);
  const dataRows = [
    {
      name: "Temperatur inne",
      source: "Homey -> Worker KV",
      value: formatNumberValue(latest?.temperature, "°C"),
      updatedAt: formatAdminTimestamp(latest?.temperatureUpdatedAt),
    },
    {
      name: "Luftfuktighet inne",
      source: "Homey -> Worker KV",
      value: formatNumberValue(latest?.humidity, "%"),
      updatedAt: formatAdminTimestamp(latest?.humidityUpdatedAt),
    },
    {
      name: "Nedbør siden midnatt",
      source: "Homey -> Worker KV",
      value: formatNumberValue(latest?.rainToday, "mm"),
      updatedAt: formatAdminTimestamp(latest?.rainTodayUpdatedAt),
    },
    {
      name: "Nedbør siste time",
      source: "Homey -> Worker KV",
      value: formatNumberValue(latest?.rainHour, "mm/t"),
      updatedAt: formatAdminTimestamp(latest?.rainHourUpdatedAt),
    },
    {
      name: "Dør",
      source: "Homey -> Worker KV",
      value: formatStatusValue(latest?.door, { open: "Åpen", closed: "Lukket" }),
      updatedAt: formatAdminTimestamp(latest?.doorUpdatedAt),
    },
    {
      name: "Vifte",
      source: "Homey -> Worker KV",
      value: formatStatusValue(latest?.fan, { on: "På", off: "Av" }),
      updatedAt: formatAdminTimestamp(latest?.fanUpdatedAt),
    },
    {
      name: "Varme",
      source: "Homey -> Worker KV",
      value: formatStatusValue(latest?.heating, { on: "På", off: "Av" }),
      updatedAt: formatAdminTimestamp(latest?.heatingUpdatedAt),
    },
    {
      name: "Vinduer åpne",
      source: "Homey -> Worker KV",
      value: latest?.window == null ? "Mangler" : `${latest.window}/3`,
      updatedAt: formatAdminTimestamp(latest?.windowUpdatedAt),
    },
    {
      name: "Utetemperatur",
      source: "Yr locationforecast",
      value: formatNumberValue(weatherData?.temperature, "°C"),
      updatedAt: formatAdminTimestamp(weatherData?.updatedAt),
    },
    {
      name: "Værtekst",
      source: "Yr locationforecast",
      value: weatherData?.description ?? "Mangler",
      updatedAt: formatAdminTimestamp(weatherData?.updatedAt),
    },
    {
      name: "Værsymbol",
      source: "Yr locationforecast",
      value: weatherData?.symbolCode ?? "Mangler",
      updatedAt: formatAdminTimestamp(weatherData?.updatedAt),
    },
    {
      name: "UV-indeks",
      source: "Open-Meteo",
      value: weatherData?.uvIndex == null ? "Mangler" : weatherData.uvIndex.toFixed(1),
      updatedAt: formatAdminTimestamp(weatherFetchedAt),
    },
  ];

  const primeVideoPreview = (video: HTMLVideoElement) => {
    if (video.readyState > 0 && video.currentTime < 0.04) {
      try {
        video.currentTime = 0.05;
      } catch {
        // Some browsers disallow seeking before enough data is available.
      }
    }
    void video.play().catch(() => undefined);
  };

  const renderAdminVideoPreview = (src: string, label: string) => (
    <video
      src={resolveGreenhouseAssetUrl(src)}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-label={label}
      onLoadedMetadata={(event) => primeVideoPreview(event.currentTarget)}
      onLoadedData={(event) => primeVideoPreview(event.currentTarget)}
      className="h-full w-full object-cover object-center"
    />
  );

  const getHeaderAssetValue = (slot: HeaderImageSlot, kind: HeaderAssetKind) => {
    const slotConfig = config.headerImages[slot];
    if (kind === "mobile-video") return slotConfig.mobileVideo;
    if (kind === "display-image") return slotConfig.display.image;
    return slotConfig[kind];
  };

  const getSelectedHeaderAsset = (value: string) => images.find((image) => image.url === value);

  const renderDisplayThemeControls = () => {
    const slot = selectedHeaderSlot;
    const slotTheme = config.headerImages.normal.displayTheme;
    if (slot !== "normal") {
      return (
        <div className="mb-4 rounded-lg border border-[#d8ded1] bg-white/70 p-5">
          <h3 className="font-semibold text-[#2d3a21]">Bruker standardtemaet fra Normalt</h3>
          <p className="mt-1 text-sm text-stone-600">
            Light- og dark-fargene er felles for alle moduser. Velg Normalt for å redigere designet.
            Denne modusen beholder fortsatt eget bilde, skjermutsnitt og darkmode-bakgrunn.
          </p>
          <button type="button" onClick={() => setSelectedHeaderSlot("normal")} className={`${adminSecondaryButtonClass} mt-4`}>
            Gå til standardtema
          </button>
        </div>
      );
    }

    const semanticFields: Array<{ role: Parameters<typeof setSemanticThemeValue>[1]; label: string; description: string }> = [
      { role: "primary", label: "Primær tekst", description: "Overskrifter, logo og plantetitler." },
      { role: "secondary", label: "Sekundær tekst", description: "Enheter, symboler og hjelpetekst." },
      { role: "surface", label: "Flater og kort", description: "Grafer og plantekort." },
      { role: "border", label: "Kantlinjer", description: "Kort, grafer og paneler." },
      { role: "normal", label: "Normalverdi", description: "Standard tall og normal temperatur." },
      { role: "cold", label: "Kald", description: "Kald temperatur, puls og ticker." },
      { role: "warning", label: "Varm / følg med", description: "Varm temperatur og advarsel." },
      { role: "critical", label: "Svært varm / stress", description: "Kritisk temperatur og stress." },
      { role: "positive", label: "Trives", description: "Positiv status i planteanalysen." },
    ];
    const semanticValue = (mode: keyof DisplayThemeConfig, role: Parameters<typeof setSemanticThemeValue>[1]) => {
      const display = slotTheme[mode];
      const plant = selectedHeaderConfig.plantAnalysisTheme[mode];
      if (role === "primary") return display.labelColor;
      if (role === "secondary") return display.mutedColor;
      if (role === "surface") return display.graphPanelBg;
      if (role === "border") return display.graphPanelBorder;
      if (role === "normal") return display.normalTemperatureColor;
      if (role === "cold") return display.coldTemperatureColor;
      if (role === "warning") return display.warmTemperatureColor;
      if (role === "critical") return display.hotTemperatureColor;
      return plant.thrivingPillBg;
    };
    const renderSemanticPalette = (mode: keyof DisplayThemeConfig) => (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {semanticFields.map((field) => {
          const value = semanticValue(mode, field.role);
          return (
            <label key={`${mode}-${field.role}`} className="rounded-lg border border-[#e1e6dc] bg-[#f7f8f5] p-3">
              <span className="block text-sm font-semibold text-[#2d3a21]">{field.label}</span>
              <span className="block text-xs text-stone-500">{field.description}</span>
              <div className="mt-3 flex items-center gap-2">
                <input type="color" value={value} onChange={(event) => setSemanticThemeValue(mode, field.role, event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#cbd3c2] bg-white p-1" aria-label={field.label} />
                <input type="text" value={value} onChange={(event) => setSemanticThemeValue(mode, field.role, event.target.value)} className="min-w-0 flex-1 rounded-md border border-[#cbd3c2] bg-white px-2 py-2 text-xs" pattern="#[0-9a-fA-F]{6}" />
              </div>
            </label>
          );
        })}
      </div>
    );
    const renderThemePreview = (mode: keyof DisplayThemeConfig) => {
      const theme = slotTheme[mode];
      const plants = selectedHeaderConfig.plantAnalysisTheme[mode];
      const pageBg = mode === "dark" ? selectedHeaderConfig.darkModeColor : "#e8ede3";
      return (
        <aside className="overflow-hidden rounded-2xl border border-[#cbd3c2] shadow-sm" style={{ backgroundColor: pageBg }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.graphPanelBorder }}>
            <span className="font-serif text-lg" style={{ color: theme.logoColor }}>Kristins drivhus</span>
            <span className="text-xs" style={{ color: theme.mutedColor }}>Live preview</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {[
              { label: "Temperatur", value: "21.4", unit: "°C", color: theme.normalTemperatureColor },
              { label: "Luftfuktighet", value: "58", unit: "%", color: theme.defaultValueColor },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border p-3" style={{ backgroundColor: theme.graphPanelBg, borderColor: theme.graphPanelBorder }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.labelColor, opacity: theme.labelOpacity }}>{metric.label}</p>
                <p className="mt-1 text-2xl font-light" style={{ color: metric.color }}>{metric.value}<span className="ml-1 text-sm" style={{ color: theme.unitColor }}>{metric.unit}</span></p>
                <p className="mt-1 text-[10px]" style={{ color: theme.mutedColor }}>Min 17.8 · Maks 24.2</p>
              </div>
            ))}
            <div className="col-span-2 rounded-xl border p-3" style={{ backgroundColor: theme.graphPanelBg, borderColor: theme.graphPanelBorder }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: theme.labelColor, opacity: theme.labelOpacity }}>Status og utvikling</p>
                <span className="text-[10px]" style={{ color: theme.mutedColor }}>Siste 24 timer</span>
              </div>
              <div className="mt-3 flex h-12 items-end gap-1" aria-hidden="true">
                {[35, 48, 42, 62, 55, 76, 68, 86, 72, 92].map((height, index) => (
                  <span key={index} className="flex-1 rounded-t-sm" style={{ height: `${height}%`, backgroundColor: index > 7 ? theme.warmTemperatureColor : theme.symbolColor, opacity: 0.85 }} />
                ))}
              </div>
              <div className="mt-3 flex gap-3 text-[10px]" style={{ color: theme.mutedColor }}>
                <span>● Dør lukket</span><span>● Vifte av</span><span>● Vindu 20%</span>
              </div>
            </div>
            <article className="col-span-2 rounded-xl border p-3" style={{ backgroundColor: plants.cardBg, borderColor: plants.cardBorder }}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold" style={{ color: plants.titleColor }}>Cherrytomater</h4>
                <span className="rounded-full px-2 py-1 text-[9px] font-semibold uppercase" style={{ backgroundColor: plants.watchPillBg, color: plants.pillTextColor }}>Følg med</span>
              </div>
              <p className="mt-2 text-xs" style={{ color: plants.ingressColor }}>Planten trives, men trenger jevn vanning i varme perioder.</p>
              <p className="mt-1 text-[10px]" style={{ color: plants.watchTextColor }}>Kontroller jorden senere i dag.</p>
            </article>
          </div>
        </aside>
      );
    };
    const renderPlantThemeField = (mode: keyof SiteConfig["plantAnalysisTheme"], field: PlantThemeField) => {
      const value = selectedHeaderConfig.plantAnalysisTheme[mode][field.key];
      return (
        <label key={`${mode}-${field.key}`} className="rounded-lg border border-[#e1e6dc] bg-[#f7f8f5] p-2">
          <span className="block text-xs font-semibold text-[#2d3a21]">{field.label}</span>
          <span className="block text-[11px] leading-snug text-stone-500">{field.description}</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(event) => setPlantThemeValue(mode, field.key, event.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[#cbd3c2] bg-white p-1"
            />
            <input
              type="text"
              value={value}
              onChange={(event) => setPlantThemeValue(mode, field.key, event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[#cbd3c2] bg-white px-2 py-1.5 text-xs"
            />
          </div>
        </label>
      );
    };
    const renderPlantThemePreview = (mode: keyof SiteConfig["plantAnalysisTheme"]) => {
      const theme = selectedHeaderConfig.plantAnalysisTheme[mode];
      return (
        <div className="mx-auto w-full max-w-[390px] rounded-[28px] border border-[#cbd3c2] bg-[#e8ede3] p-4 shadow-inner">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">Mobilpreview</p>
          <article className="rounded-lg border p-3 shadow-sm" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold" style={{ color: theme.titleColor }}>Cherrytomater</h4>
              <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ backgroundColor: theme.watchPillBg, color: theme.pillTextColor }}>
                Følg med
              </span>
            </div>
            <div className="flex gap-3">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-black/5">
                <span className="px-2 text-center text-[10px]" style={{ color: theme.ingressColor }}>Bilde</span>
              </div>
              <div>
                <p className="text-sm font-medium leading-snug" style={{ color: theme.ingressColor }}>
                  Planten tåler forholdene godt, men varme topper krever jevn lufting.
                </p>
                <p className="mt-2 text-xs" style={{ color: theme.watchTextColor }}>Følg med på ujevn vanning etter varme perioder.</p>
              </div>
            </div>
          </article>
        </div>
      );
    };
    const renderField = (mode: keyof DisplayThemeConfig, field: DisplayThemeField) => {
      const value = slotTheme[mode][field.key];
      const isOpacity = field.type === "opacity";
      const isOptionalColor = field.type === "optionalColor";
      const colorValue = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";

      return (
        <label key={`${mode}-${field.key}`} className="rounded-lg border border-[#e1e6dc] bg-[#f7f8f5] p-2">
          <span className="block text-xs font-semibold text-[#2d3a21]">{field.label}</span>
          <span className="block text-[11px] leading-snug text-stone-500">{field.description}</span>
          {isOpacity ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={typeof value === "number" ? value : 1}
                onChange={(event) => setDisplayThemeValue(slot, mode, field.key, Number(event.target.value))}
                className="min-w-0 flex-1 accent-[#5d7342]"
              />
              <span className="w-10 text-right text-xs font-semibold text-stone-600">
                {Math.round((typeof value === "number" ? value : 1) * 100)}%
              </span>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-[#cbd3c2]"
                style={{ backgroundColor: colorValue, opacity: isOptionalColor && !value ? 0.2 : 1 }}
                aria-hidden="true"
              />
              <input
                type="color"
                value={colorValue}
                onChange={(event) => setDisplayThemeValue(slot, mode, field.key, event.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-[#cbd3c2] bg-white p-1"
                aria-label={field.label}
              />
              <input
                type="text"
                value={String(value)}
                onChange={(event) => setDisplayThemeValue(slot, mode, field.key, event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-[#cbd3c2] bg-white px-2 py-1.5 text-xs"
                pattern="#[0-9a-fA-F]{6}"
              />
              {isOptionalColor && (
                <button
                  type="button"
                  onClick={() => setDisplayThemeValue(slot, mode, field.key, "")}
                  className="rounded-md border border-[#cbd3c2] bg-white px-2 py-1.5 text-xs font-semibold text-[#4d5d3e]"
                >
                  Fjern
                </button>
              )}
            </div>
          )}
        </label>
      );
    };

    const renderMode = (mode: keyof DisplayThemeConfig, title: string, description: string) => (
      <div className="rounded-lg border border-[#d8ded1] bg-white/75 p-3">
        <div className="mb-3">
          <h4 className="font-semibold text-[#2d3a21]">{title}</h4>
          <p className="text-xs text-stone-500">{description}</p>
        </div>
        <Accordion type="multiple" defaultValue={["text", "temperature"]} className="rounded-lg border border-[#e1e6dc] bg-white/60">
          {displayThemeGroups.map((group) => (
            <AccordionItem key={`${mode}-${group.id}`} value={group.id} className="border-[#e1e6dc] px-3">
              <AccordionTrigger className="py-3 text-[#2d3a21] hover:no-underline">
                <span>
                  <span className="block font-semibold">{group.title}</span>
                  <span className="block text-xs font-normal leading-snug text-stone-500">{group.description}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.fields
                    .map((fieldKey) => displayThemeFields.find((field) => field.key === fieldKey))
                    .filter((field): field is DisplayThemeField => Boolean(field))
                    .map((field) => renderField(mode, field))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );

    return (
      <div className="mb-4 rounded-lg border border-[#d8ded1] bg-white/60 p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
          <h3 className="font-semibold">Standardtema for alle moduser</h3>
          <p className="text-sm text-stone-600">
            Normalt definerer light- og dark-paletten som brukes av alle temperatur- og værmoduser.
          </p>
          </div>
          <button
            type="button"
            onClick={() => resetDisplayThemeForSlot(slot)}
            className={adminSecondaryButtonClass}
          >
            Tilbakestill
          </button>
        </div>
        <Tabs defaultValue="dark">
          <TabsList className="mb-3 border border-[#cbd3c2] bg-[#f7f8f5]">
            <TabsTrigger value="dark" className="data-[state=active]:bg-[#5d7342] data-[state=active]:text-white">Dark mode + skjerm</TabsTrigger>
            <TabsTrigger value="light" className="data-[state=active]:bg-[#5d7342] data-[state=active]:text-white">Light mode web</TabsTrigger>
          </TabsList>
          <TabsContent value="dark">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
              {renderSemanticPalette("dark")}
              {renderThemePreview("dark")}
            </div>
            <details className="mt-4 rounded-lg border border-[#d8ded1] bg-white/75 p-3">
              <summary className="cursor-pointer font-semibold text-[#2d3a21]">Avanserte dark-innstillinger</summary>
              <div className="mt-4">
                {renderMode("dark", "Detaljstyring for dark mode + skjerm", "Brukes også av den runde skjermen.")}
                <div className="mt-4 rounded-lg border border-[#d8ded1] p-3">
                  <h4 className="font-semibold text-[#2d3a21]">Planteanalyse</h4>
                  <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="grid gap-2 sm:grid-cols-2">{plantThemeFields.map((field) => renderPlantThemeField("dark", field))}</div>
                    {renderPlantThemePreview("dark")}
                  </div>
                </div>
              </div>
            </details>
          </TabsContent>
          <TabsContent value="light">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
              {renderSemanticPalette("light")}
              {renderThemePreview("light")}
            </div>
            <details className="mt-4 rounded-lg border border-[#d8ded1] bg-white/75 p-3">
              <summary className="cursor-pointer font-semibold text-[#2d3a21]">Avanserte light-innstillinger</summary>
              <div className="mt-4">
                {renderMode("light", "Detaljstyring for light mode", "Brukes av web i lys modus.")}
                <div className="mt-4 rounded-lg border border-[#d8ded1] p-3">
                  <h4 className="font-semibold text-[#2d3a21]">Planteanalyse</h4>
                  <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="grid gap-2 sm:grid-cols-2">{plantThemeFields.map((field) => renderPlantThemeField("light", field))}</div>
                    {renderPlantThemePreview("light")}
                  </div>
                </div>
              </div>
            </details>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  const renderSelectedHeaderCard = (slot: HeaderImageSlot, kind: HeaderAssetKind) => {
    const slotConfig = config.headerImages[slot];
    const assetKind = headerAssetKinds.find((item) => item.key === kind);
    const value = getHeaderAssetValue(slot, kind);
    const selectedAsset = getSelectedHeaderAsset(value);
    const isVideo = kind === "mobile-video";
    const previewClass = kind === "desktop" ? "aspect-[3/1]" : isVideo ? "aspect-video" : "aspect-[390/200]";
    const formatTag = getFileFormatTag(selectedAsset?.filename, assetKind?.fallbackFormat ?? "");

    return (
      <article key={kind} className="rounded-lg border border-[#d8ded1] bg-white/70 p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">{assetKind?.label}</h4>
            <p className="mt-0.5 text-[11px] text-stone-500">
              {selectedAsset?.filename ?? (isVideo && !value ? "Ingen video valgt" : "Standard")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <span className={adminTagClass}>{assetKind?.ratio}</span>
            <span className={adminTagClass}>{formatTag}</span>
          </div>
        </div>

        <div className={`overflow-hidden rounded-lg bg-stone-200 ${previewClass}`}>
          {isVideo && value ? (
            renderAdminVideoPreview(value, `${slotConfig.label} mobilvideo`)
          ) : (
            <img
              src={resolveGreenhouseAssetUrl(isVideo ? slotConfig.mobile : value)}
              alt={`${slotConfig.label} ${assetKind?.label.toLowerCase()}`}
              className="h-full w-full object-cover object-center"
            />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openHeaderLibrary(kind)}
            className={adminPrimaryButtonClass}
          >
            Bibliotek
          </button>
          {isVideo ? (
            <>
              <button
                type="button"
                onClick={() => setMobileVideo(slot, defaultSiteConfig.headerImages[slot].mobileVideo)}
                className={adminSecondaryButtonClass}
                disabled={!value}
              >
                Fjern
              </button>
              <label className={adminPrimaryButtonClass}>
                {videoUploading ? "Laster opp" : "Last opp"}
                <input
                  type="file"
                  accept="video/mp4"
                  disabled={videoUploading}
                  onChange={(event) => {
                    void handleSlotVideoUpload(slot, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </>
          ) : (
            <>
              <label className={adminPrimaryButtonClass}>
                {uploading ? "Laster opp" : "Last opp"}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={uploading}
                  onChange={(event) => {
                    void handleSlotImageUpload(slot, kind, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </>
          )}
        </div>
      </article>
    );
  };

  const renderDisplayImageEditor = (slot: HeaderImageSlot) => {
    const slotConfig = config.headerImages[slot];
    const display = slotConfig.display;
    const savedDisplayUrl = display.image || "";
    let lastSavedSlotConfig = defaultSiteConfig.headerImages[slot];
    try {
      lastSavedSlotConfig = (JSON.parse(savedConfigSnapshot) as SiteConfig).headerImages[slot] ?? lastSavedSlotConfig;
    } catch {
      lastSavedSlotConfig = slotConfig;
    }
    const lastSavedDisplay = lastSavedSlotConfig.display;
    const activeDisplayUrl = lastSavedDisplay.image || "";
    const activeBinaryUrl = lastSavedDisplay.binary || "";
    const activeDisplayAsset = getSelectedHeaderAsset(activeDisplayUrl);
    const activeBinaryAsset = getSelectedHeaderAsset(activeBinaryUrl);
    const displayDraftChanged = JSON.stringify(display) !== JSON.stringify(lastSavedDisplay);
    const activeDarkModeColor = getValidHexColor(lastSavedSlotConfig.darkModeColor, defaultSiteConfig.headerImages[slot].darkModeColor);

    return (
      <article className="rounded-lg border border-[#d8ded1] bg-white/70 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">Rund skjerm</h4>
            <p className="mt-0.5 text-xs text-stone-500">
              Eksporterer en 164 x 466 PNG-stripe for admin og en RGB565-binærfil for ESP32-skjermen.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={adminTagClass}>164 x 466</span>
            <span className={adminTagClass}>x=302</span>
            <span className={adminTagClass}>PNG</span>
            <span className={adminTagClass}>RGB565</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div>
            <div
              className="mx-auto grid h-[240px] w-[240px] place-items-center overflow-hidden rounded-full border-4 border-[#2d3a21] bg-[#2d3a21] shadow-inner"
              style={{ backgroundColor: selectedDarkModeColor }}
            >
              <canvas
                ref={displayPreviewCanvasRef}
                width={displayScreenSize}
                height={displayScreenSize}
                aria-label={`${slotConfig.label} skjerm-preview`}
                className="h-full w-full"
              />
              {displayPreviewError && (
                <span className="px-8 text-center text-sm text-white/70">Kunne ikke lage preview</span>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-stone-500">
              Previewen viser hele 466px-skjermen: bakgrunnsfarge + bildestripen slik firmware klipper den.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setDisplaySourceFromAsset(slot, slotConfig.mobile)}
                className={adminSecondaryButtonClass}
              >
                Bruk mobilbilde
              </button>
              <button
                type="button"
                onClick={() => setDisplaySourceFromAsset(slot, slotConfig.desktop)}
                className={adminSecondaryButtonClass}
              >
                Bruk desktopbilde
              </button>
              <label className={adminPrimaryButtonClass}>
                Last opp kilde
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(event) => {
                    setDisplaySourceFromFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 flex justify-between gap-3 font-semibold">
                  Zoom <span className="text-stone-500">{display.zoom.toFixed(2)}x</span>
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={3}
                  step={0.01}
                  value={display.zoom}
                  onChange={(event) => setDisplayConfig(slot, { zoom: Number(event.target.value) })}
                  className="w-full accent-[#5d7342]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 flex justify-between gap-3 font-semibold">
                  X i bilde <span className="text-stone-500">{Math.round(display.offsetX)} px</span>
                </span>
                <input
                  type="range"
                  min={-displayPanRange.x}
                  max={displayPanRange.x}
                  step={1}
                  value={display.offsetX}
                  onChange={(event) => setDisplayConfig(slot, { offsetX: Number(event.target.value) })}
                  className="w-full accent-[#5d7342]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 flex justify-between gap-3 font-semibold">
                  Y i bilde <span className="text-stone-500">{Math.round(display.offsetY)} px</span>
                </span>
                <input
                  type="range"
                  min={-displayPanRange.y}
                  max={displayPanRange.y}
                  step={1}
                  value={display.offsetY}
                  onChange={(event) => setDisplayConfig(slot, { offsetY: Number(event.target.value) })}
                  className="w-full accent-[#5d7342]"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDisplayConfig(slot, { zoom: 1, offsetX: 0, offsetY: 0 })}
                className={adminSecondaryButtonClass}
              >
                Sentrer
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateDisplayImage()}
                disabled={displayUploading}
                className={adminPrimaryButtonClass}
              >
                {displayUploading ? "Genererer" : "Generer skjermbilde"}
              </button>
              {savedDisplayUrl && (
                <button
                  type="button"
                  onClick={() => setDisplayConfig(slot, { image: "", binary: "", source: slotConfig.mobile, zoom: 1, offsetX: 0, offsetY: 0 })}
                  className={adminSecondaryButtonClass}
                >
                  Fjern valgt
                </button>
              )}
            </div>

            <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Aktivt etter siste lagring</p>
                    <p className="mt-1 text-sm font-semibold text-[#2d3a21]">{lastSavedSlotConfig.label}</p>
                  </div>
                  {displayDraftChanged && <span className={adminTagClass}>Endringer ikke lagret</span>}
                </div>
                {activeDisplayUrl ? (
                  <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)]">
                    <div
                      className="relative h-20 w-20 overflow-hidden rounded-full border border-[#cbd3c2]"
                      style={{ backgroundColor: activeDarkModeColor }}
                    >
                      <img
                        src={resolveGreenhouseAssetUrl(activeDisplayUrl)}
                        alt="Aktivt skjermbilde"
                        className="absolute top-0 h-full object-cover"
                        style={{ left: `${(displayImageX / displayScreenSize) * 100}%`, width: `${(displayImageWidth / displayScreenSize) * 100}%` }}
                      />
                    </div>
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="truncate">
                        <span className="font-semibold">PNG:</span> {activeDisplayAsset?.filename ?? "Lagret skjermbilde"}
                      </p>
                      <p className={activeBinaryUrl ? "truncate" : "text-amber-700"}>
                        <span className="font-semibold">Firmware BIN:</span>{" "}
                        {activeBinaryUrl ? activeBinaryAsset?.filename ?? "Klar" : "Mangler. Generer skjermbilde på nytt og lagre."}
                      </p>
                      <p>
                        <span className="font-semibold">Bakgrunn:</span> {activeDarkModeColor}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-stone-600">
                    Ingen skjermfil er lagret for denne modusen. Firmware bruker innebygget fallback-bilde.
                  </p>
                )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderHeaderAssetLibrary = (slot: HeaderImageSlot, kind: HeaderAssetKind) => {
    const selectedUrl = getHeaderAssetValue(slot, kind);
    const isVideo = kind === "mobile-video";
    const isDisplay = kind === "display-image";
    const assets = isDisplay
      ? displayImageAssets.filter((image) => (image.slot === slot || image.slot === "general") && ["display-164x466", "round-466"].includes(image.format))
      : isVideo
        ? headerVideoAssets.filter((video) => video.slot === slot || video.slot === "general")
        : headerAssets.filter((image) => (image.slot === slot || image.slot === "general") && image.format === kind);

    if (loading) {
      return <div className="rounded-lg bg-[#f7f8f5] p-5 text-sm text-stone-500">Laster filer fra R2</div>;
    }

    if (assets.length === 0) {
      return <div className="rounded-lg bg-[#f7f8f5] p-5 text-sm text-stone-500">Ingen filer funnet for dette formatet.</div>;
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => {
          const isSelected = selectedUrl === asset.url;
          const { extension } = splitFilename(asset.filename);
          const isEditing = editingImageKey === asset.key;
          return (
            <article
              key={asset.key}
              className={`rounded-lg border bg-[#f7f8f5] p-3 transition ${
                isSelected ? "border-[#5d7342] ring-2 ring-[#5d7342]" : "border-[#d8ded1]"
              }`}
            >
              <div
                className={`relative overflow-hidden rounded-lg bg-stone-200 ${
                  kind === "desktop" ? "aspect-[3/1]" : isVideo ? "aspect-video" : isDisplay ? "grid min-h-48 place-items-center" : "aspect-[390/200]"
                }`}
              >
                {isVideo ? (
                  renderAdminVideoPreview(asset.url, asset.filename)
                ) : isDisplay ? (
                  <div
                    className="relative h-40 w-40 overflow-hidden rounded-full border border-[#cbd3c2]"
                    style={{ backgroundColor: selectedDarkModeColor }}
                  >
                    <img
                      src={resolveGreenhouseAssetUrl(asset.url)}
                      alt={asset.filename}
                      className="absolute top-0 h-full object-cover"
                      style={{ left: `${(displayImageX / displayScreenSize) * 100}%`, width: `${(displayImageWidth / displayScreenSize) * 100}%` }}
                    />
                  </div>
                ) : (
                  <img
                    src={resolveGreenhouseAssetUrl(asset.url)}
                    alt={asset.filename}
                    className="h-full w-full object-cover object-center"
                  />
                )}
                {isSelected && (
                  <span className="absolute right-2 top-2 rounded-md border border-[#2d3a21] bg-white/95 px-2 py-1 text-[11px] font-semibold leading-none text-[#2d3a21] shadow-sm">
                    Valgt
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-3">
                {isEditing ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveRenameImage(asset);
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <input
                        type="text"
                        value={editingFilenameBase}
                        onChange={(event) => setEditingFilenameBase(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") cancelRenameImage();
                        }}
                        autoFocus
                        className="min-w-0 flex-1 rounded-md border border-[#9daa8f] bg-white px-3 py-2 text-sm font-semibold text-[#2d3a21]"
                      />
                      <span className="shrink-0 text-sm font-semibold text-stone-500">{extension}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className="rounded-md bg-[#5d7342] px-3 py-1.5 text-xs font-semibold text-white">
                        Lagre
                      </button>
                      <button type="button" onClick={cancelRenameImage} className="rounded-md border border-[#cbd3c2] bg-white px-3 py-1.5 text-xs font-semibold text-[#4d5d3e]">
                        Avbryt
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => startRenameImage(asset)}
                      className="block max-w-full break-words text-left text-sm font-semibold leading-snug text-[#2d3a21] underline-offset-2 hover:underline"
                      title="Klikk for å endre filnavn"
                    >
                      {asset.filename}
                    </button>
                    <p className="mt-1 text-xs text-stone-500">{formatBytes(asset.size)}</p>
                  </div>
                )}

                {!isEditing && (
                  <div className="flex flex-wrap gap-2">
                    {!isSelected && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isVideo) applyVideo(slot, asset);
                          else if (isDisplay) {
                            setDisplayConfig(slot, {
                              image: asset.url,
                              binary: "",
                              source: asset.url,
                              zoom: 1,
                              offsetX: 0,
                              offsetY: 0,
                            });
                            setMessage(`${asset.filename} er valgt for skjermen. Husk å lagre.`);
                          } else {
                            applyImage(slot, kind, asset);
                          }
                        }}
                        className={adminPrimaryButtonClass}
                      >
                        Bruk
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteImage(asset)}
                      className={adminDangerButtonClass}
                    >
                      Slett
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f5f3] text-[#252c27]">
      <header className="sticky top-0 z-30 border-b border-black/15 bg-[#222824] px-4 py-2.5 text-white shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[#5d7342]">
              {config.branding.logo.url ? (
                <span
                  className="block h-5 w-5 bg-white"
                  style={{
                    WebkitMask: `url("${resolveGreenhouseAssetUrl(config.branding.logo.url)}") center / contain no-repeat`,
                    mask: `url("${resolveGreenhouseAssetUrl(config.branding.logo.url)}") center / contain no-repeat`,
                  }}
                  aria-hidden="true"
                />
              ) : (
                <Leaf className="h-4 w-4" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Kristins drivhus</h1>
              <p className="text-xs text-white/55">Administrasjon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !hasUnsavedChanges}
            className={`inline-flex min-w-[9rem] justify-center overflow-hidden rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed ${
              hasUnsavedChanges
                ? "bg-[#759354] text-white hover:bg-[#668247] disabled:opacity-60"
                : "bg-white/10 text-white/55 disabled:opacity-100"
            }`}
          >
            {saving ? "Lagrer" : hasUnsavedChanges ? "Lagre endringer" : "Lagret"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
        {(message || error) && (
          <div className={`rounded-md border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-[#d9ddda] bg-white text-[#4d5d3e]"}`}>
            {error || message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-[196px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="sm:sticky sm:top-[68px] sm:h-[calc(100vh-84px)] sm:self-start">
            <label className="relative block sm:hidden">
              <span className="sr-only">Velg adminområde</span>
              <select value={activeSection} onChange={(event) => setActiveSection(event.target.value as AdminSection)} className="h-11 w-full appearance-none rounded-md border border-[#cfd5d1] bg-white px-4 pr-10 text-sm font-semibold text-[#354039] shadow-sm">
                {adminSectionGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-[#647068]">⌄</span>
            </label>
            <nav className="hidden sm:block">
              {adminSectionGroups.map((group) => (
                <div key={group.label} className="contents sm:mb-5 sm:block">
                  <p className="mb-1 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#89918c] sm:block">{group.label}</p>
                  {group.sections.map((section) => {
                    const active = activeSection === section.key;
                    const Icon = section.icon;
                    return <button key={section.key} type="button" onClick={() => setActiveSection(section.key)} className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition sm:mb-0.5 sm:w-full ${active ? "bg-[#dde5d7] text-[#354329]" : "text-[#5f6862] hover:bg-white hover:text-[#29312c]"}`} aria-current={active ? "page" : undefined}><Icon className="h-4 w-4 shrink-0" /><span>{section.label}</span></button>;
                  })}
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-4">
            {activeSection === "visibility" && (
              <>
                <section className="border-b border-[#d9ddda] pb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#748078]">Drift</p>
                  <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                    <div><h2 className="text-2xl font-semibold tracking-tight text-[#202622]">Oversikt</h2><p className="mt-1 text-sm text-[#68716b]">Kjernedata og styring av innholdet på forsiden.</p></div>
                    <div className="flex items-center gap-3"><p className="text-xs text-[#78817b]">{plantAnalysis ? `Analyse oppdatert ${new Date(plantAnalysis.generatedAt).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Ingen lagret analyse"}</p><button type="button" onClick={() => void handleGeneratePlantAnalysis()} disabled={plantAnalysisLoading || hasUnsavedChanges} title={hasUnsavedChanges ? "Lagre endringene før analysen kjøres" : "Kjør analyse"} className="rounded-md bg-[#5d7342] px-3 py-2 text-sm font-semibold text-white disabled:opacity-45">{plantAnalysisLoading ? "Analyserer …" : "Kjør analyse"}</button></div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[#d9ddda] bg-[#d9ddda] shadow-sm xl:grid-cols-3">
                  {overviewMetrics.map((metric) => {
                    const Icon = metric.icon;
                    return <article key={metric.label} className="flex min-w-0 items-center gap-3 bg-white px-4 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#edf1ea] text-[#60734e]"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7b847e]">{metric.label}</span><span className="block truncate text-xl font-semibold tracking-tight text-[#29312c]">{metric.value}</span><span className="block truncate text-xs text-[#818983]">{metric.detail}</span></span></article>;
                  })}
                </section>

                <section className="rounded-md border border-[#d9ddda] bg-white p-5 shadow-sm">
                  <div className="mb-4"><h2 className="text-base font-semibold">Innhold på forsiden</h2><p className="mt-1 text-sm text-[#747d77]">Velg hvilke moduler som skal være tilgjengelige for besøkende.</p></div>
                  <label className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span>Headerbilde</span>
                    <input
                      type="checkbox"
                      checked={config.showHeroImage}
                      onChange={(event) =>
                        updateConfig((current) => ({ ...current, showHeroImage: event.target.checked }))
                      }
                      className="h-5 w-5 accent-[#5d7342]"
                    />
                  </label>
                  <div className="mt-4 border-t border-[#e1e4e2] pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[#7b847e]">Seksjoner og rekkefølge</p><div className="grid gap-2">{config.frontPageSectionOrder.map((section, index) => { const meta = frontPageSectionMeta[section]; const visible = section === "climate" ? config.visibleStatuses.door || config.visibleStatuses.fan || config.visibleStatuses.window : section === "plants" ? config.visibleStatuses.plantLibrary : section === "analysis" ? config.visibleStatuses.plantAnalysis : config.visibleStatuses.charts; return <article key={section} className="grid gap-3 rounded-md border border-[#d9ddda] bg-[#fafbfa] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"><div className="flex overflow-hidden rounded-md border border-[#d6dbd7] bg-white"><button type="button" onClick={() => moveFrontPageSection(index, -1)} disabled={index === 0} className="px-2 py-1.5 disabled:opacity-25">↑</button><button type="button" onClick={() => moveFrontPageSection(index, 1)} disabled={index === config.frontPageSectionOrder.length - 1} className="border-l border-[#d6dbd7] px-2 py-1.5 disabled:opacity-25">↓</button></div><div className="min-w-0"><p className="text-sm font-semibold">{meta.label}</p><p className="text-xs text-[#78817b]">{meta.description}</p>{section === "climate" && <div className="mt-2 flex flex-wrap gap-3 text-xs">{(["door", "window", "fan"] as const).map((key) => <label key={key} className="flex items-center gap-1.5"><input type="checkbox" checked={config.visibleStatuses[key]} onChange={(event) => updateConfig((current) => ({ ...current, visibleStatuses: { ...current.visibleStatuses, [key]: event.target.checked } }))} className="accent-[#5d7342]" />{key === "door" ? "Dør" : key === "window" ? "Vindu" : "Vifte"}</label>)}</div>}{section === "analysis" && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={config.frontPageSectionDefaults.analysisExpanded} onChange={(event) => updateConfig((current) => ({ ...current, frontPageSectionDefaults: { ...current.frontPageSectionDefaults, analysisExpanded: event.target.checked } }))} className="accent-[#5d7342]" />Åpen ved lasting</label>}{section === "charts" && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={config.frontPageSectionDefaults.chartsExpanded} onChange={(event) => updateConfig((current) => ({ ...current, frontPageSectionDefaults: { ...current.frontPageSectionDefaults, chartsExpanded: event.target.checked } }))} className="accent-[#5d7342]" />Åpen ved lasting</label>}</div>{section !== "climate" && <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={visible} onChange={(event) => { const key = section === "plants" ? "plantLibrary" : section === "analysis" ? "plantAnalysis" : "charts"; updateConfig((current) => ({ ...current, visibleStatuses: { ...current.visibleStatuses, [key]: event.target.checked } })); }} className="h-5 w-5 accent-[#5d7342]" />Vis</label>}</article>; })}</div></div>
                </section>

              </>
            )}

            {activeSection === "data" && (
              <>
                <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Datapunkter</h2>
                      <p className="text-sm text-stone-600">
                        Oversikt over verdier som driver frontend, hvor de kommer fra, og når de sist ble oppdatert.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleReloadAdminData}
                      className={adminSecondaryButtonClass}
                    >
                      Oppdater data
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[#d8ded1]">
                    <div className="grid min-w-[760px] grid-cols-[1.1fr_1fr_0.8fr_1fr] gap-3 bg-[#f7f8f5] px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">
                      <span>Navn</span>
                      <span>Kilde</span>
                      <span>Siste verdi</span>
                      <span>Sist inn</span>
                    </div>
                    <div className="divide-y divide-[#d8ded1] bg-white/75">
                      {dataRows.map((row) => (
                        <div key={row.name} className="grid min-w-[760px] grid-cols-[1.1fr_1fr_0.8fr_1fr] gap-3 px-4 py-3 text-sm">
                          <span className="font-semibold text-[#2d3a21]">{row.name}</span>
                          <span className="text-stone-600">{row.source}</span>
                          <span className="font-medium">{row.value}</span>
                          <span className="text-stone-600">{row.updatedAt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Homey</p>
                      <p className="mt-1 text-sm text-stone-600">Sender sensordata til Worker via `/ingest`.</p>
                    </div>
                    <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Yr</p>
                      <p className="mt-1 text-sm text-stone-600">Henter utetemperatur, værtekst og symbolkode ved lasting/refresh.</p>
                    </div>
                    <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Open-Meteo</p>
                      <p className="mt-1 text-sm text-stone-600">Henter UV-indeks fordi Yr ikke leverer UV i denne integrasjonen.</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold">Homey-dokumentasjon</h2>
                    <p className="text-sm text-stone-600">
                      Alle Homey-flows sender én verdi av gangen til Cloudflare Worker.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                    <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                      <span className="text-sm font-semibold">Endpoint</span>
                      <code className="rounded-md bg-white px-3 py-2 text-sm text-[#2d3a21]">POST https://drivhus.dan-aksel.workers.dev/ingest</code>
                      <span className="text-sm font-semibold">Headers</span>
                      <div className="space-y-2">
                        <code className="block rounded-md bg-white px-3 py-2 text-sm text-[#2d3a21]">Authorization: Bearer &lt;secretkey&gt;</code>
                        <code className="block rounded-md bg-white px-3 py-2 text-sm text-[#2d3a21]">Content-Type: application/json</code>
                      </div>
                      <span className="text-sm font-semibold">Body</span>
                      <code className="rounded-md bg-white px-3 py-2 text-sm text-[#2d3a21]">{'{ "sensor": "humidity", "value": 54.8 }'}</code>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-lg border border-[#d8ded1]">
                    <div className="grid min-w-[1040px] grid-cols-[0.9fr_0.8fr_1fr_1.25fr_1.35fr] gap-3 bg-[#f7f8f5] px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">
                      <span>Datapunkt</span>
                      <span>Sensor</span>
                      <span>Alias</span>
                      <span>Verdi</span>
                      <span>Eksempel</span>
                    </div>
                    <div className="divide-y divide-[#d8ded1] bg-white/75">
                      {homeyIngestDocs.map((doc) => (
                        <div key={doc.sensor} className="grid min-w-[1040px] grid-cols-[0.9fr_0.8fr_1fr_1.25fr_1.35fr] gap-3 px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-[#2d3a21]">{doc.name}</p>
                            <p className="mt-1 text-xs text-stone-500">{doc.note}</p>
                          </div>
                          <code className="text-xs font-semibold text-[#2d3a21]">{doc.sensor}</code>
                          <span className="text-xs text-stone-600">{doc.aliases}</span>
                          <span className="text-xs text-stone-600">{doc.value}</span>
                          <code className="break-all rounded-md bg-[#f7f8f5] px-2 py-1 text-xs text-[#2d3a21]">{doc.example}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeSection === "metadata" && (
              <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                <h2 className="mb-4 text-base font-semibold">Sidens metadata</h2>
                <div className="space-y-4">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Navn</span>
                    <input
                      type="text"
                      value={config.branding.siteName}
                      onChange={(event) => setBrandingText("siteName", event.target.value)}
                      className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                      maxLength={80}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Kort navn</span>
                    <input
                      type="text"
                      value={config.branding.shortName}
                      onChange={(event) => setBrandingText("shortName", event.target.value)}
                      className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                      maxLength={32}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Title</span>
                    <input
                      type="text"
                      value={config.branding.title}
                      onChange={(event) => setBrandingText("title", event.target.value)}
                      className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                      maxLength={80}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Meta-beskrivelse</span>
                    <textarea
                      value={config.branding.description}
                      onChange={(event) => setBrandingText("description", event.target.value)}
                      className="min-h-24 w-full resize-y rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                      maxLength={180}
                    />
                  </label>
                  <p className="text-xs leading-relaxed text-stone-500">
                    Navn og kort navn brukes i manifest. Title og meta-beskrivelse brukes i fanen og delingsmetadata.
                  </p>
                </div>
              </section>
            )}

            {activeSection === "logo" && (
              <>
            <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold">Logo</h2>
                <p className="text-sm text-stone-600">Last opp SVG. Fargen overstyres av CSS i frontend.</p>
                <p className="mt-1 text-xs text-stone-500">Anbefalt kvadratisk eller kompakt symbol, ca. 1:1. Hold motivet innenfor viewBox.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Aktiv logo</p>
                  <div className="flex h-28 items-center justify-center rounded-lg bg-[#e8ede3]">
                    {config.branding.logo.url ? (
                      <span
                        className="block bg-[#2d3a21]"
                        style={{
                          width: config.branding.logo.size,
                          height: config.branding.logo.size,
                          WebkitMask: `url("${resolveGreenhouseAssetUrl(config.branding.logo.url)}") center / contain no-repeat`,
                          mask: `url("${resolveGreenhouseAssetUrl(config.branding.logo.url)}") center / contain no-repeat`,
                        }}
                      />
                    ) : (
                      <span className="text-sm text-stone-500">Standardlogo</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLogo(defaultSiteConfig.branding.logo.url);
                      setMessage("Standardlogo er valgt. Husk å lagre.");
                    }}
                    className="mt-3 rounded-full border border-[#cbd3c2] px-3 py-1.5 text-xs font-semibold text-[#4d5d3e]"
                  >
                    Bruk standardlogo
                  </button>
                  <div className="mt-4 border-t border-[#d8ded1] pt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="logo-size" className="text-sm font-semibold">
                        Logostørrelse
                      </label>
                      <span className="text-xs text-stone-500">{config.branding.logo.size}px</span>
                    </div>
                    <input
                      id="logo-size"
                      type="range"
                      min={20}
                      max={72}
                      step={1}
                      value={config.branding.logo.size}
                      onChange={(event) => setLogoSize(Number(event.target.value))}
                      className="w-full accent-[#5d7342]"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-stone-500">
                      <span>20px</span>
                      <span>72px</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLogoSize(defaultSiteConfig.branding.logo.size)}
                      className="mt-3 rounded-full border border-[#cbd3c2] px-3 py-1.5 text-xs font-semibold text-[#4d5d3e]"
                    >
                      Standard størrelse
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold">Tekst ved logo</h3>
                        <p className="text-xs text-stone-500">Vises til høyre for logomark i toppmenyen.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.branding.logoText.visible}
                        onChange={(event) => updateLogoText({ visible: event.target.checked })}
                        className="h-5 w-5 accent-[#5d7342]"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Tekst</span>
                        <input
                          type="text"
                          value={config.branding.logoText.text}
                          onChange={(event) => updateLogoText({ text: event.target.value })}
                          className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                          maxLength={48}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Google-font</span>
                        <select
                          value={config.branding.logoText.font}
                          onChange={(event) => updateLogoText({ font: event.target.value as SiteConfig["branding"]["logoText"]["font"] })}
                          className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                        >
                          {logoFontOptions.map((font) => (
                            <option key={font.value} value={font.value} style={{ fontFamily: `'${font.value}', serif` }}>
                              {font.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 rounded-lg border border-[#d8ded1] bg-white p-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Forhåndsvisning</p>
                      <p
                        className="truncate text-2xl text-[#2d3a21]"
                        style={{ fontFamily: `'${config.branding.logoText.font}', serif`, fontWeight: 400 }}
                      >
                        {config.branding.logoText.text || "Kristins drivhus"}
                      </p>
                    </div>
                  </div>

                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#9daa8f] bg-[#f7f8f5] px-4 py-6 text-center transition hover:bg-white">
                    <span className="text-sm font-semibold">{logoUploading ? "Laster opp" : "Last opp logo"}</span>
                    <span className="mt-1 text-xs text-stone-500">Kun SVG. Fyll/stroke i filen blir ignorert visuelt på siden.</span>
                    <input
                      type="file"
                      accept="image/svg+xml,.svg"
                      disabled={logoUploading}
                      onChange={(event) => {
                        void handleLogoUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  {logoAssets.length === 0 ? (
                    <div className="rounded-lg bg-[#f7f8f5] p-4 text-sm text-stone-500">Ingen SVG-logoer i R2 ennå.</div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {logoAssets.map((logo) => (
                        <article key={logo.key} className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-3">
                          <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-[#e8ede3]">
                            <span
                              className="block h-12 w-12 bg-[#2d3a21]"
                              style={{
                                WebkitMask: `url("${resolveGreenhouseAssetUrl(logo.url)}") center / contain no-repeat`,
                                mask: `url("${resolveGreenhouseAssetUrl(logo.url)}") center / contain no-repeat`,
                              }}
                            />
                          </div>
                          <p className="truncate text-sm font-semibold">{logo.filename}</p>
                          <p className="text-xs text-stone-500">{formatBytes(logo.size)}</p>
                          {config.branding.logo.url === logo.url && (
                            <span className="mt-2 inline-flex rounded-full border border-[#2d3a21] px-2 py-1 text-[11px] font-semibold text-[#2d3a21]">Valgt</span>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setLogo(logo.url);
                                setMessage("Logo er valgt. Husk å lagre.");
                              }}
                              className="rounded-full bg-[#5d7342] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Bruk logo
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteImage(logo)}
                              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              Slett
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold">Favicon</h2>
                <p className="text-sm text-stone-600">Last opp én SVG, så genereres nødvendige PNG-varianter automatisk.</p>
                <p className="mt-1 text-xs text-stone-500">Anbefalt kvadratisk SVG, 1:1. Hold motivet lesbart ned til 32 x 32 px.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">Aktiv favicon</p>
                  <div className="flex h-28 items-center justify-center rounded-lg bg-white">
                    <img
                      src={resolveGreenhouseAssetUrl(config.branding.favicon.svg)}
                      alt="Aktiv favicon"
                      className="h-14 w-14 object-contain"
                    />
                  </div>
                  <p className="mt-3 text-xs text-stone-500">Genereres som SVG, 32 px, 180 px, 192 px og 512 px.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFaviconConfig(defaultSiteConfig.branding.favicon);
                      setMessage("Standardfavicon er valgt. Husk å lagre.");
                    }}
                    className="mt-3 rounded-full border border-[#cbd3c2] px-3 py-1.5 text-xs font-semibold text-[#4d5d3e]"
                  >
                    Bruk standardfavicon
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#9daa8f] bg-[#f7f8f5] px-4 py-6 text-center transition hover:bg-white">
                    <span className="text-sm font-semibold">{faviconUploading ? "Genererer" : "Last opp favicon"}</span>
                    <span className="mt-1 text-xs text-stone-500">SVG inn, SVG + PNG-størrelser ut i R2.</span>
                    <input
                      type="file"
                      accept="image/svg+xml,.svg"
                      disabled={faviconUploading}
                      onChange={(event) => {
                        void handleFaviconUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  {faviconAssets.length === 0 ? (
                    <div className="rounded-lg bg-[#f7f8f5] p-4 text-sm text-stone-500">Ingen favicon-filer i R2 ennå.</div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {faviconAssets.map((asset) => (
                        <article key={asset.key} className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-3">
                          <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-white">
                            <img src={resolveGreenhouseAssetUrl(asset.url)} alt={asset.filename} className="h-10 w-10 object-contain" />
                          </div>
                          <p className="truncate text-sm font-semibold">{asset.filename}</p>
                          <p className="text-xs text-stone-500">{[asset.format, formatBytes(asset.size)].filter(Boolean).join(" · ")}</p>
                          {Object.values(config.branding.favicon).includes(asset.url) && (
                            <span className="mt-2 inline-flex rounded-full border border-[#2d3a21] px-2 py-1 text-[11px] font-semibold text-[#2d3a21]">I bruk</span>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {asset.format === "svg" && (
                              <button
                                type="button"
                                onClick={() => void handleUseFaviconAsset(asset)}
                                className="rounded-full bg-[#5d7342] px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Bruk favicon
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDeleteImage(asset)}
                              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              Slett
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
              </>
            )}

            {activeSection === "plants" && (
              <section className="min-w-0">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#d9ddda] pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#748078]">Dyrking</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#202622]">Planter og sesonger</h2>
                    <p className="mt-1 max-w-2xl text-sm text-[#68716b]">Administrer årets planter, permanent bibliotekdata og analysegrunnlag.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-[#4d5650]">
                      Sesong
                      <select value={config.activePlantSeasonYear} onChange={(event) => setActivePlantYear(Number(event.target.value))} className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm shadow-sm">
                        {Array.from(new Set([...Object.keys(config.plantSeasons).map(Number), config.activePlantSeasonYear])).sort((a, b) => b - a).map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={() => setActivePlantYear(config.activePlantSeasonYear + 1)} className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm font-medium text-[#39443d] shadow-sm hover:bg-[#f7f8f7]">Opprett {config.activePlantSeasonYear + 1}</button>
                  </div>
                </div>

                <div className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b border-[#d9ddda]">
                  {([
                    ["season", `Aktiv sesong (${activeSeasonPlants.length})`],
                    ["library", `Plantebibliotek (${config.plantLibrary.length})`],
                    ["analysis", "Analyse"],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setPlantWorkspace(key)} className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${plantWorkspace === key ? "border-[#5d7342] text-[#344326]" : "border-transparent text-[#707a73] hover:text-[#344326]"}`}>{label}</button>
                  ))}
                </div>

                {plantWorkspace === "season" && (
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
                    <div className="min-w-0 overflow-hidden rounded-md border border-[#d9ddda] bg-white shadow-sm">
                      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e1e4e2] bg-[#fafbfa] p-3">
                        <label className="min-w-56 flex-1 text-xs font-semibold uppercase tracking-[0.05em] text-[#69736c]">
                          Legg til fra bibliotek
                          <div className="mt-1 flex gap-2">
                            <select value={selectedLibraryPlantId} onChange={(event) => setSelectedLibraryPlantId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm font-normal normal-case tracking-normal">
                              <option value="">Velg plante</option>
                              {availableLibraryPlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
                            </select>
                            <button type="button" onClick={addPlantFromLibrary} disabled={!selectedLibraryPlantId} className="h-9 rounded-md bg-[#5d7342] px-4 text-sm font-semibold text-white disabled:opacity-40">Legg til</button>
                          </div>
                        </label>
                        <div className="flex items-center gap-2"><label className="text-xs font-semibold uppercase tracking-[0.05em] text-[#69736c]">Visning på forsiden<select value={seasonSort} onChange={(event) => { const value = event.target.value as typeof seasonSort; setSeasonSort(value); updateConfig((current) => ({ ...current, plantDisplaySort: value })); }} className="ml-2 h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm font-normal normal-case tracking-normal"><option value="manual">Manuell rekkefølge</option><option value="name-asc">Navn A–Å</option><option value="name-desc">Navn Å–A</option><option value="type">Plantetype</option><option value="status">Status</option></select></label><button type="button" onClick={() => setPlantWorkspace("library")} className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm font-medium text-[#465149]">Ny plante</button></div>
                      </div>
                      {seasonSort !== "manual" && <p className="border-b border-[#e1e4e2] bg-[#f7f8f7] px-4 py-2 text-xs text-[#69736c]">Denne sorteringen brukes også på plantekortene på forsiden. Velg «Manuell rekkefølge» for å dra kortene i ønsket orden.</p>}
                      <div className="hidden grid-cols-[28px_minmax(180px,1.4fr)_100px_110px_minmax(120px,1fr)] gap-3 border-b border-[#e1e4e2] bg-[#f5f6f5] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#78817b] md:grid">
                        <span /><span>Plante</span><span>Type</span><span>Status</span><span>Vekstmedium</span>
                      </div>
                      <div className="divide-y divide-[#e6e8e7]">
                        {displayedSeasonPlants.map((seasonPlant, index) => {
                          const plant = plantLibraryById.get(seasonPlant.libraryId);
                          if (!plant) return null;
                          const selected = selectedSeasonPlant?.id === seasonPlant.id;
                          return (
                            <div key={seasonPlant.id} draggable={seasonSort === "manual"} onDragStart={(event) => { setDraggedSeasonPlantId(seasonPlant.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => { if (seasonSort === "manual") { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { event.preventDefault(); movePlantById(draggedSeasonPlantId, seasonPlant.id); setDraggedSeasonPlantId(""); }} onDragEnd={() => setDraggedSeasonPlantId("")} className={`grid cursor-pointer gap-2 px-4 py-3 transition md:grid-cols-[28px_minmax(180px,1.4fr)_100px_110px_minmax(120px,1fr)] md:items-center md:gap-3 ${selected ? "bg-[#eef2ea]" : "hover:bg-[#f8f9f8]"} ${draggedSeasonPlantId === seasonPlant.id ? "opacity-45" : ""}`} onClick={() => selectSeasonPlant(seasonPlant.id)}>
                              <span className={`hidden md:grid ${seasonSort === "manual" ? "cursor-grab text-[#879189] active:cursor-grabbing" : "text-[#c8ceca]"}`} title={seasonSort === "manual" ? "Dra for å endre rekkefølge" : "Velg manuell rekkefølge for å dra"}><GripVertical className="h-4 w-4" /></span>
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-[#edf0ed]">
                                  {plant.image ? <img src={resolveGreenhouseAssetUrl(plant.image)} alt="" className="h-full w-full object-cover" /> : <Leaf className="h-4 w-4 text-[#82907f]" />}
                                </div>
                                <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#29312c]">{plant.name}</p><p className="truncate text-xs text-[#7a837d] md:hidden">{plant.plantType} · {seasonPlant.plantingPlace || "Ingen plassering"}</p></div>
                              </div>
                              <span className="hidden text-sm text-[#59635c] md:block">{plant.plantType}</span>
                              <span className={`hidden w-fit rounded-full px-2 py-1 text-[11px] font-semibold md:inline-flex ${!seasonPlant.active ? "bg-stone-100 text-stone-500" : seasonPlant.finished ? "bg-stone-200 text-stone-700" : getSeasonAnalysis(seasonPlant)?.status === "stress" ? "bg-red-50 text-red-700" : getSeasonAnalysis(seasonPlant)?.status === "trives" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{!seasonPlant.active ? "Inaktiv" : seasonPlant.finished ? (seasonPlant.finishReason === "moved-out" ? "Ferdig" : "Høstet") : getSeasonAnalysis(seasonPlant)?.status === "trives" ? "Trives" : getSeasonAnalysis(seasonPlant)?.status === "stress" ? "Stress" : getSeasonAnalysis(seasonPlant) ? "Følg med" : "Ikke analysert"}</span>
                              <span className="hidden truncate text-sm text-[#59635c] md:block">{seasonPlant.plantingPlace || "–"}</span>
                              {seasonSort === "manual" && <div className="ml-auto flex overflow-hidden rounded-md border border-[#d6dbd7] bg-white md:hidden" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={`Flytt ${plant.name} opp`} onClick={() => movePlant(index, index - 1)} disabled={index === 0} className="px-2.5 py-1.5 text-xs text-[#536359] disabled:opacity-25">↑</button><button type="button" aria-label={`Flytt ${plant.name} ned`} onClick={() => movePlant(index, index + 1)} disabled={index === activeSeasonPlants.length - 1} className="border-l border-[#d6dbd7] px-2.5 py-1.5 text-xs text-[#536359] disabled:opacity-25">↓</button></div>}
                            </div>
                          );
                        })}
                        {activeSeasonPlants.length === 0 && <div className="px-4 py-12 text-center text-sm text-[#78817b]">Ingen planter i denne sesongen.</div>}
                      </div>
                    </div>

                    <aside ref={seasonDetailRef} className={`${selectedSeasonPlantId ? "fixed inset-0 z-50 block w-screen max-w-[100vw] overflow-x-hidden overflow-y-auto sm:static sm:order-first sm:z-auto sm:w-auto sm:max-w-none sm:overflow-visible xl:order-none" : "hidden sm:order-last sm:block xl:order-none"} min-w-0 scroll-mt-20 rounded-none border border-[#d9ddda] bg-white shadow-sm sm:h-fit sm:rounded-md xl:sticky xl:top-24`}>
                      {selectedSeasonPlant && selectedSeasonLibraryPlant ? (
                        <>
                          <div className="flex items-center justify-between gap-3 border-b border-[#e1e4e2] px-4 py-3">
                            <button type="button" onClick={() => setSelectedSeasonPlantId("")} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#d6dbd7] text-lg text-[#536159] sm:hidden" aria-label="Lukk plantedetaljer">←</button>
                            <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#7a837d]">Sesongdetaljer</p><h3 className="truncate text-lg font-semibold text-[#273029]">{selectedSeasonLibraryPlant.name}</h3></div>
                            <label className="flex shrink-0 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selectedSeasonPlant.active} onChange={(event) => updatePlant(selectedSeasonPlant.id, { active: event.target.checked })} className="accent-[#5d7342]" /> Aktiv</label>
                          </div>
                          {selectedSeasonAnalysis && <section className="mx-4 mt-4 min-w-0 rounded-md border border-[#d9ddda] bg-[#f7f8f5] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${selectedSeasonAnalysis.status === "trives" ? "bg-emerald-100 text-emerald-800" : selectedSeasonAnalysis.status === "stress" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{selectedSeasonAnalysis.status === "trives" ? "Planten trives" : selectedSeasonAnalysis.status}</span><time className="text-xs text-[#78817b]">{new Date(selectedSeasonAnalysis.assessedAt || plantAnalysis!.generatedAt).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-3 text-sm leading-relaxed text-[#39443d]">{selectedSeasonAnalysis.assessment || selectedSeasonAnalysis.summary}</p><div className="mt-3 grid gap-2 text-sm text-[#59635c]"><p><span className="font-semibold">Vanning:</span> {selectedSeasonAnalysis.watering || selectedSeasonAnalysis.watch}</p>{(selectedSeasonAnalysis.development?.text || selectedSeasonAnalysis.forecast) && <p><span className="font-semibold">{selectedSeasonAnalysis.development?.type === "flowering" ? "Blomstring" : selectedSeasonAnalysis.development?.type === "harvest" ? "Høsting" : "Modning"}:</span> {selectedSeasonAnalysis.development?.text || selectedSeasonAnalysis.forecast}</p>}</div></section>}
                          <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 [&_input]:min-w-0 [&_input]:max-w-full [&_label]:min-w-0 [&_select]:min-w-0 [&_select]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full">
                            <label className="text-sm"><span className="mb-1 block font-medium">Anskaffelse</span><select value={selectedSeasonPlant.acquisition} onChange={(event) => updatePlant(selectedSeasonPlant.id, { acquisition: event.target.value as PlantSeasonEntry["acquisition"] })} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3">{acquisitionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                            {selectedSeasonPlant.acquisition === "seed" && <><label className="text-sm"><span className="mb-1 block font-medium">Sådato</span><input type="date" value={selectedSeasonPlant.seedDate} onChange={(event) => updatePlant(selectedSeasonPlant.id, { seedDate: event.target.value })} className="h-9 w-full rounded-md border border-[#cfd5d1] px-3" /></label><label className="text-sm"><span className="mb-1 block font-medium">Såsted</span><select value={selectedSeasonPlant.seedLocation} onChange={(event) => updatePlant(selectedSeasonPlant.id, { seedLocation: event.target.value as PlantSeasonEntry["seedLocation"] })} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3"><option value="">Ikke angitt</option>{seedLocationOptions.map((location) => <option key={location} value={location}>{location}</option>)}</select></label></>}
                            <label className="text-sm"><span className="mb-1 block font-medium">Dyrkested nå</span><select value={selectedSeasonPlant.growingLocation} onChange={(event) => { const growingLocation = event.target.value as PlantSeasonEntry["growingLocation"]; updatePlant(selectedSeasonPlant.id, { growingLocation, greenhouseDate: growingLocation === "greenhouse" && !selectedSeasonPlant.greenhouseDate ? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" }) : selectedSeasonPlant.greenhouseDate }); }} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3"><option value="">Ikke angitt</option>{plantGrowingLocationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                            {selectedSeasonPlant.growingLocation === "greenhouse" && <label className="text-sm"><span className="mb-1 block font-medium">Flyttet til drivhus</span><input type="date" value={selectedSeasonPlant.greenhouseDate} onChange={(event) => updatePlant(selectedSeasonPlant.id, { greenhouseDate: event.target.value })} className="h-9 w-full rounded-md border border-[#cfd5d1] px-3" /></label>}
                            <label className="flex min-h-9 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selectedSeasonPlant.finished} onChange={(event) => updatePlant(selectedSeasonPlant.id, { finished: event.target.checked, finishReason: event.target.checked ? (selectedSeasonPlant.finishReason || "season-over") : "", harvestDate: event.target.checked ? (selectedSeasonPlant.harvestDate || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" })) : "" })} className="h-4 w-4 accent-[#5d7342]" /> Avsluttet</label>
                            {selectedSeasonPlant.finished && <><label className="text-sm"><span className="mb-1 block font-medium">Årsak til avslutning</span><select value={selectedSeasonPlant.finishReason || "season-over"} onChange={(event) => updatePlant(selectedSeasonPlant.id, { finishReason: event.target.value as PlantSeasonEntry["finishReason"] })} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3"><option value="season-over">Høstet</option><option value="moved-out">Ferdig</option></select></label><label className="text-sm"><span className="mb-1 block font-medium">Dato avsluttet <span className="font-normal text-[#7a837d]">(valgfritt)</span></span><input type="date" value={selectedSeasonPlant.harvestDate} onChange={(event) => updatePlant(selectedSeasonPlant.id, { harvestDate: event.target.value })} className="h-9 w-full rounded-md border border-[#cfd5d1] px-3" /></label></>}
                            <label className="text-sm"><span className="mb-1 block font-medium">Kjøpt hos</span><input type="text" value={selectedSeasonPlant.purchaseSource} onChange={(event) => updatePlant(selectedSeasonPlant.id, { purchaseSource: event.target.value })} className="h-9 w-full rounded-md border border-[#cfd5d1] px-3" /></label>
                            <label className="text-sm"><span className="mb-1 block font-medium">Vekstmedium</span><input type="text" value={selectedSeasonPlant.plantingPlace} onChange={(event) => updatePlant(selectedSeasonPlant.id, { plantingPlace: event.target.value })} placeholder="F.eks. 80 l potte, plantekasse eller jordbed" className="h-9 w-full rounded-md border border-[#cfd5d1] px-3" /></label>
                            <fieldset className="grid gap-3 rounded-md border border-[#d9ddda] bg-[#f7f8f7] p-3 sm:col-span-2 xl:col-span-1 2xl:col-span-2"><legend className="px-1 text-sm font-semibold">Ny observasjon</legend><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm"><span className="mb-1 block font-medium">Utviklingsstadium</span><select value={newObservationStage} onChange={(event) => setNewObservationStage(event.target.value as PlantDevelopmentStage | "")} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3"><option value="">Velg stadium</option>{getPlantDevelopmentStageOptions(selectedSeasonLibraryPlant.plantType).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-sm"><span className="mb-1 block font-medium">Dato</span><input type="date" value={newObservationDate} onChange={(event) => setNewObservationDate(event.target.value)} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3" /></label></div><label className="text-sm"><span className="mb-1 block font-medium">Kort notat <span className="font-normal text-[#7a837d]">(valgfritt)</span></span><input value={newObservationNote} onChange={(event) => setNewObservationNote(event.target.value)} maxLength={120} placeholder="F.eks. mange grønne tomater, største ca. 5 cm" className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3" /></label><button type="button" onClick={addObservation} disabled={!newObservationStage || !newObservationDate} className="justify-self-start rounded-md bg-[#5d7342] px-4 py-2 text-sm font-semibold text-white disabled:opacity-45">Legg til i loggen</button></fieldset>
                            {selectedPlantTimeline.length > 0 && <section className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"><h4 className="text-sm font-semibold">Tidslinje</h4><ol className="mt-3 border-l-2 border-[#cfd8c8] pl-4">{selectedPlantTimeline.map((entry) => <li key={entry.id} className="relative pb-4 last:pb-0"><span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${entry.kind === "observation" ? "bg-[#5d7342]" : entry.kind === "finished" ? "bg-[#59635c]" : "bg-[#aab3ac]"}`} /><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#303a32]">{entry.title}</p><time className="text-xs text-[#78817b]">{new Date(`${entry.date}T12:00:00`).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}</time>{entry.detail && <p className="mt-1 text-sm text-[#59635c]">{entry.detail}</p>}</div>{entry.kind === "observation" && <button type="button" onClick={() => removeObservation(entry.id)} className="text-xs font-medium text-red-700">Slett</button>}</div></li>)}</ol><p className="mt-3 text-xs text-[#78817b]">Grå hendelser oppdateres fra sesongdataene. Grønne punkter er egne observasjoner.</p></section>}
                            <label className="text-sm sm:col-span-2 xl:col-span-1 2xl:col-span-2"><span className="mb-1 block font-medium">Notat til analysen</span><textarea value={selectedSeasonPlant.note} onChange={(event) => updatePlant(selectedSeasonPlant.id, { note: event.target.value })} rows={4} className="w-full resize-y rounded-md border border-[#cfd5d1] px-3 py-2" /></label>
                          </div>
                          <div className="flex justify-end border-t border-[#e1e4e2] px-4 py-3"><button type="button" onClick={() => removePlant(selectedSeasonPlant.id)} className="text-sm font-semibold text-red-700 hover:text-red-800">Fjern fra sesongen</button></div>
                        </>
                      ) : <div className="p-8 text-center text-sm text-[#78817b]">Velg en plante for å redigere sesongdata.</div>}
                    </aside>
                  </div>
                )}

                {plantWorkspace === "library" && (
                  <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
                    <section className="rounded-md border border-[#d9ddda] bg-white p-4 shadow-sm xl:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#748078]">Produktkatalog</p><h3 className="mt-1 font-semibold text-[#29312c]">Nelson Garden</h3><p className="mt-1 text-sm text-[#68716b]">Importer frøprodukter og kopier hovedbildet til egen R2 når produktet legges til.</p></div>
                        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadSupplierCatalog()} className="rounded-md border border-[#cfd5d1] px-3 py-2 text-sm font-semibold">Åpne katalog</button><button type="button" onClick={() => void importSupplierCatalog()} disabled={supplierImporting || supplierClassifying} className="rounded-md bg-[#5d7342] px-3 py-2 text-sm font-semibold text-white disabled:opacity-45">{supplierImporting ? `Importerer… ${supplierCatalog?.products.length || 0}` : "Oppdater katalog"}</button><button type="button" onClick={() => void classifySupplierCatalog()} disabled={supplierClassifying || supplierImporting || !supplierCatalog?.products.length} className="rounded-md border border-[#5d7342] px-3 py-2 text-sm font-semibold text-[#40552c] disabled:opacity-45">{supplierClassifying ? `Klassifiserer… ${supplierClassifyProgress}/${supplierCatalog?.products.length || 0}` : "Klassifiser katalog"}</button></div>
                      </div>
                      {supplierCatalog && <div className="mt-4"><input type="search" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder={`Søk blant ${supplierCatalog.products.length} produkter`} className="h-9 w-full rounded-md border border-[#cfd5d1] px-3 text-sm" /><div className="mt-3 grid max-h-[520px] gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{supplierCatalog.products.filter((product) => `${product.productName} ${product.varietyName} ${product.articleNumber}`.toLowerCase().includes(supplierSearch.trim().toLowerCase())).slice(0, 150).map((product) => { const existingPlant = config.plantLibrary.find((plant) => plant.id === `nelson-garden-${product.articleNumber}` || (plant.manufacturer === "Nelson Garden" && plant.articleNumber === product.articleNumber)); const hasImage = Boolean(existingPlant?.image); return <article key={product.articleNumber} className="flex gap-3 rounded-md border border-[#e1e4e2] p-3">{product.sourceImageUrl ? <img src={product.sourceImageUrl} alt="" className="h-20 w-16 shrink-0 rounded object-cover" /> : <div className="h-20 w-16 shrink-0 rounded bg-[#edf0ed]" />}<div className="min-w-0 flex-1"><p className="truncate text-xs text-[#78817b]">{product.productName} · {product.articleNumber}</p><h4 className="line-clamp-2 text-sm font-semibold">{product.varietyName}</h4><button type="button" disabled={hasImage || supplierAdding === product.articleNumber} onClick={() => void addSupplierProductToLibrary(product.articleNumber)} className="mt-2 inline-flex min-w-[5.75rem] items-center justify-center whitespace-nowrap rounded-md bg-[#5d7342] px-2.5 py-1.5 text-xs font-semibold text-white disabled:bg-[#aab3ac]">{supplierAdding === product.articleNumber ? "Legger til…" : hasImage ? "Lagt til" : existingPlant ? "Hent bilde" : "Legg til"}</button></div></article>; })}</div></div>}
                    </section>
                    <div className="overflow-hidden rounded-md border border-[#d9ddda] bg-white shadow-sm">
                      <div className="grid gap-2 border-b border-[#e1e4e2] bg-[#fafbfa] p-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_130px_140px_auto]">
                        <input type="search" value={plantSearch} onChange={(event) => setPlantSearch(event.target.value)} placeholder="Søk i plantebiblioteket" className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm md:col-span-2 lg:col-span-4" />
                        <input type="text" value={newPlantName} onChange={(event) => setNewPlantName(event.target.value)} placeholder="Ny plante" className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm" />
                        <select value={newPlantType} onChange={(event) => { setNewPlantType(event.target.value as PlantLibraryEntry["plantType"]); setNewPlantGroup(""); }} className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm">{plantTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select>
                        {plantGroupOptionsByType[newPlantType].length > 0 && <select value={newPlantGroup} onChange={(event) => setNewPlantGroup(event.target.value)} className="h-9 rounded-md border border-[#cfd5d1] bg-white px-3 text-sm"><option value="">Velg gruppe</option>{plantGroupOptionsByType[newPlantType].map((group) => <option key={group} value={group}>{group}</option>)}</select>}
                        <button type="button" onClick={addLibraryPlant} disabled={!newPlantName.trim()} className="h-9 rounded-md bg-[#5d7342] px-4 text-sm font-semibold text-white disabled:opacity-40">Opprett</button>
                      </div>
                      <div className="divide-y divide-[#e6e8e7]">
                        {filteredLibraryPlants.map((plant) => {
                          const seasons = Object.values(config.plantSeasons).filter((entries) => entries.some((entry) => entry.libraryId === plant.id)).length;
                          const selected = editingLibraryPlant?.id === plant.id;
                          return <button key={plant.id} type="button" onClick={() => selectLibraryPlant(plant.id)} className={`grid w-full grid-cols-[44px_minmax(0,1fr)_90px] items-center gap-3 px-4 py-3 text-left transition sm:grid-cols-[44px_minmax(0,1fr)_120px_100px] ${selected ? "bg-[#eef2ea]" : "hover:bg-[#f8f9f8]"}`}>
                            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-[#edf0ed]">{plant.image ? <img src={resolveGreenhouseAssetUrl(plant.image)} alt="" className="h-full w-full object-cover" /> : <Leaf className="h-4 w-4 text-[#82907f]" />}</span>
                            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#29312c]">{plant.name}</span><span className="block truncate text-xs text-[#7a837d]">{plant.description || "Ingen beskrivelse"}</span></span>
                            <span className="text-sm text-[#626c65]">{[plant.plantType, plant.plantGroup].filter(Boolean).join(" · ")}</span>
                            <span className="hidden text-right text-xs text-[#7a837d] sm:block">{seasons} sesong{seasons === 1 ? "" : "er"}</span>
                          </button>;
                        })}
                      </div>
                    </div>
                    <aside ref={libraryDetailRef} className={`${editingLibraryPlantId ? "fixed inset-0 z-50 block overflow-y-auto sm:static sm:order-first sm:z-auto sm:overflow-visible xl:order-none" : "hidden sm:order-last sm:block xl:order-none"} scroll-mt-20 rounded-none border border-[#d9ddda] bg-white shadow-sm sm:h-fit sm:rounded-md xl:sticky xl:top-24`}>
                      {editingLibraryPlant ? (
                        <>
                          <div className="flex items-center gap-3 border-b border-[#e1e4e2] px-4 py-3"><button type="button" onClick={() => setEditingLibraryPlantId("")} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#d6dbd7] text-lg text-[#536159] sm:hidden" aria-label="Lukk bibliotekdetaljer">←</button><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#7a837d]">Bibliotekdata</p><h3 className="truncate text-lg font-semibold text-[#273029]">{editingLibraryPlant.name}</h3></div></div>
                          <div className="grid gap-4 p-4">
                            <div className="flex flex-wrap items-center gap-3"><div className="grid h-16 w-16 place-items-center overflow-hidden rounded-md bg-[#edf0ed]">{editingLibraryPlant.image ? <img src={resolveGreenhouseAssetUrl(editingLibraryPlant.image)} alt="" className="h-full w-full object-cover" /> : <Leaf className="h-5 w-5 text-[#82907f]" />}</div><label className="cursor-pointer rounded-md border border-[#cfd5d1] bg-white px-3 py-2 text-sm font-medium">Last opp bilde<input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(event) => { void handlePlantImageUpload(editingLibraryPlant, event.target.files?.[0]); event.target.value = ""; }} /></label><button type="button" disabled={generatingPlantImageId === editingLibraryPlant.id} onClick={() => void handleGeneratePlantImages(editingLibraryPlant)} className="rounded-md bg-[#5d7342] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{generatingPlantImageId === editingLibraryPlant.id ? "Genererer to bilder…" : "Generer med OpenAI"}</button></div>
                            {generatedPlantImages[editingLibraryPlant.id]?.length ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-[#737d76]">Velg ett av forslagene</p><div className="grid max-w-md grid-cols-2 gap-3">{generatedPlantImages[editingLibraryPlant.id].map((asset) => <button key={asset.key} type="button" onClick={() => { updateLibraryPlant(editingLibraryPlant.id, { image: asset.url }); setMessage(`Bildet er valgt for ${editingLibraryPlant.name}. Husk å lagre.`); }} className={`overflow-hidden rounded-md border-2 text-left ${editingLibraryPlant.image === asset.url ? "border-[#5d7342]" : "border-transparent"}`}><img src={resolveGreenhouseAssetUrl(asset.url)} alt={`Generert forslag for ${editingLibraryPlant.name}`} className="aspect-square w-full object-cover" /><span className="block px-2 py-1 text-xs font-medium">{editingLibraryPlant.image === asset.url ? "Valgt" : "Velg bilde"}</span></button>)}</div></div> : null}
                            <details className="rounded-md border border-[#e1e4e2] bg-white" open={Boolean(getPlantImageAssets(editingLibraryPlant).length)}><summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">Tidligere bilder ({getPlantImageAssets(editingLibraryPlant).length})</summary><div className="grid grid-cols-2 gap-3 border-t border-[#e1e4e2] p-3 sm:grid-cols-3 lg:grid-cols-4">{getPlantImageAssets(editingLibraryPlant).length ? getPlantImageAssets(editingLibraryPlant).map((asset) => <button key={asset.key} type="button" onClick={() => { updateLibraryPlant(editingLibraryPlant.id, { image: asset.url }); setMessage(`${asset.filename} er valgt for ${editingLibraryPlant.name}. Husk å lagre.`); }} className={`overflow-hidden rounded-md border-2 bg-white text-left ${editingLibraryPlant.image === asset.url ? "border-[#5d7342] ring-2 ring-[#5d7342]/20" : "border-[#d8ded1]"}`}><img src={resolveGreenhouseAssetUrl(asset.url)} alt={asset.filename} loading="lazy" className="aspect-square w-full object-cover" /><span className="block truncate px-2 py-1.5 text-xs font-medium">{editingLibraryPlant.image === asset.url ? "Valgt" : asset.filename}</span></button>) : <p className="col-span-full py-3 text-sm text-[#737d76]">Ingen tidligere bilder for denne planten.</p>}</div></details>
                            <div className="grid gap-3 rounded-md border border-[#e1e4e2] bg-[#f8f9f8] p-3 sm:grid-cols-[220px_minmax(0,1fr)]"><fieldset className="text-sm"><legend className="mb-2 font-semibold">Bakgrunnsfarge</legend><div className="flex flex-wrap gap-2">{imageBackgroundPalette.map((option) => { const selected = editingLibraryPlant.imageBackgroundColor.toLowerCase() === option.color.toLowerCase(); return <button key={option.label} type="button" title={`${option.label} · ${option.color}`} aria-label={`${option.label}, ${option.color}`} aria-pressed={selected} onClick={() => updateLibraryPlant(editingLibraryPlant.id, { imageBackgroundColor: option.color })} className={`h-9 w-9 rounded-full border-2 shadow-sm transition ${selected ? "scale-110 border-[#29312c] ring-2 ring-[#29312c]/25 ring-offset-2" : "border-white hover:scale-105"}`} style={{ backgroundColor: option.color }} />; })}</div><span className="mt-3 block font-mono text-xs text-[#737d76]">{editingLibraryPlant.imageBackgroundColor}</span></fieldset><label className="text-sm"><span className="mb-1 block font-semibold">Beskrivelse til bildegenerering</span><textarea value={editingLibraryPlant.imagePromptDescription} onChange={(event) => updateLibraryPlant(editingLibraryPlant.id, { imagePromptDescription: event.target.value })} rows={4} maxLength={600} placeholder="Beskriv utseende, form, farger, blader, fruktkjøtt eller andre detaljer som må gjengis presist." className="w-full resize-y rounded-md border border-[#cfd5d1] bg-white px-3 py-2" /></label></div>
                            <label className="block rounded-md border border-[#e1e4e2] bg-[#f8f9f8] p-3"><span className="text-sm font-semibold">Global OpenAI-prompt</span><span className="mt-1 block text-xs text-[#737d76]">Tilgjengelige variabler: <code>{"{{plantenavn}}"}</code>, <code>{"{{bakgrunnsfarge}}"}</code> og <code>{"{{plantebeskrivelse}}"}</code>. Endringen gjelder alle planter etter lagring.</span><textarea value={config.plantImagePrompt} onChange={(event) => updateConfig((current) => ({ ...current, plantImagePrompt: event.target.value }))} rows={12} maxLength={2400} className="mt-2 w-full resize-y rounded-md border border-[#cfd5d1] bg-white px-3 py-2 text-sm" /></label>
                            <label className="text-sm"><span className="mb-1 block font-medium">Plantenavn</span><input type="text" value={editingLibraryPlant.name} onChange={(event) => updateLibraryPlant(editingLibraryPlant.id, { name: event.target.value })} className="h-9 w-full rounded-md border border-[#cfd5d1] px-3" /></label>
                            <label className="text-sm"><span className="mb-1 block font-medium">Plantetype</span><select value={editingLibraryPlant.plantType} onChange={(event) => updateLibraryPlant(editingLibraryPlant.id, { plantType: event.target.value as PlantLibraryEntry["plantType"], plantGroup: "" })} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3">{plantTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                            {plantGroupOptionsByType[editingLibraryPlant.plantType].length > 0 && <label className="text-sm"><span className="mb-1 block font-medium">Plantegruppe</span><select value={editingLibraryPlant.plantGroup} onChange={(event) => updateLibraryPlant(editingLibraryPlant.id, { plantGroup: event.target.value })} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3"><option value="">Velg gruppe</option>{plantGroupOptionsByType[editingLibraryPlant.plantType].map((group) => <option key={group} value={group}>{group}</option>)}</select></label>}
                            <label className="text-sm"><span className="mb-1 block font-medium">Generell beskrivelse</span><textarea value={editingLibraryPlant.description} onChange={(event) => updateLibraryPlant(editingLibraryPlant.id, { description: event.target.value })} rows={5} className="w-full resize-y rounded-md border border-[#cfd5d1] px-3 py-2" /></label>
                            {!activeSeasonPlants.some((plant) => plant.libraryId === editingLibraryPlant.id) && <button type="button" onClick={() => addPlantFromLibraryById(editingLibraryPlant.id)} className="rounded-md bg-[#5d7342] px-4 py-2 text-sm font-semibold text-white">Legg til i {config.activePlantSeasonYear}</button>}
                          </div>
                          <div className="border-t border-[#e1e4e2] px-4 py-3"><button type="button" onClick={() => deleteLibraryPlant(editingLibraryPlant)} className="text-sm font-semibold text-red-700 hover:text-red-800">Slett fra bibliotek</button></div>
                        </>
                      ) : <div className="p-8 text-center text-sm text-[#78817b]">Ingen planter matcher søket.</div>}
                    </aside>
                  </div>
                )}

                {plantWorkspace === "analysis" && (
                  <>
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="rounded-md border border-[#d9ddda] bg-white p-5 shadow-sm"><label className="block"><span className="text-sm font-semibold text-[#29312c]">Generelt om drivhuset og drift</span><span className="mt-1 block text-sm text-[#737d76]">Sendes til OpenAI sammen med sensorverdier, sesongdata og historikk.</span><textarea value={config.plantAnalysisNotes} onChange={(event) => updateConfig((current) => ({ ...current, plantAnalysisNotes: event.target.value }))} rows={8} className="mt-4 w-full resize-y rounded-md border border-[#cfd5d1] px-3 py-2 text-sm" /></label><label className="mt-4 block border-t border-[#e1e4e2] pt-4"><span className="text-sm font-semibold text-[#29312c]">OpenAI-modell</span><span className="mt-1 block text-xs text-[#737d76]">Listen kontrolleres mot modellene som er tilgjengelige på API-nøkkelen.</span><select value={config.plantAnalysisModel} onChange={(event) => updateConfig((current) => ({ ...current, plantAnalysisModel: event.target.value }))} className="mt-2 h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3 text-sm">{openAiModels.map((model) => <option key={model} value={model}>{model}</option>)}</select></label><div className="mt-4 border-t border-[#e1e4e2] pt-4"><label className="flex items-center justify-between gap-3 text-sm font-semibold"><span>Automatisk analyse</span><input type="checkbox" checked={config.plantAnalysisSchedule.enabled} onChange={(event) => updateConfig((current) => ({ ...current, plantAnalysisSchedule: { ...current.plantAnalysisSchedule, enabled: event.target.checked } }))} className="h-5 w-5 accent-[#5d7342]" /></label>{config.plantAnalysisSchedule.enabled && <label className="mt-3 block text-sm"><span className="mb-1 block font-medium">Tidspunkt hver dag</span><select value={config.plantAnalysisSchedule.time} onChange={(event) => updateConfig((current) => ({ ...current, plantAnalysisSchedule: { ...current.plantAnalysisSchedule, time: event.target.value } }))} className="h-9 w-full rounded-md border border-[#cfd5d1] bg-white px-3">{Array.from({ length: 96 }, (_, index) => { const hour = String(Math.floor(index / 4)).padStart(2, "0"); const minute = String((index % 4) * 15).padStart(2, "0"); const value = `${hour}:${minute}`; return <option key={value} value={value}>{value}</option>; })}</select><span className="mt-1 block text-xs text-[#78817b]">Oslo-tid. Kontrolleres hvert 15. minutt.</span></label>}</div></div>
                    <aside className="h-fit rounded-md border border-[#d9ddda] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#7a837d]">Analysejobb</p><h3 className="mt-1 text-lg font-semibold">{activeSeasonPlants.filter((plant) => plant.active).length} aktive planter</h3><p className="mt-2 text-sm text-[#737d76]">{plantAnalysis ? `Sist kjørt ${new Date(plantAnalysis.generatedAt).toLocaleString("nb-NO")}.` : "Ingen lagret analyse."}</p>{plantAnalysis?.refresh && <><p className="mt-1 text-xs text-[#7a837d]">{plantAnalysis.refresh.analyzedPlants} analysert · {plantAnalysis.refresh.reusedPlants} gjenbrukt</p>{plantAnalysis.refresh.detail && <p className="mt-1 text-xs text-[#7a837d]">{plantAnalysis.refresh.detail}</p>}</>}{plantAnalysis?.model && <p className="mt-1 text-xs text-[#7a837d]">Modell: {plantAnalysis.model}</p>}{plantAnalysis?.usage?.totalTokens ? <p className="mt-1 text-xs text-[#7a837d]">{plantAnalysis.usage.totalTokens.toLocaleString("nb-NO")} tokens sist brukt</p> : null}<button type="button" onClick={() => void handleGeneratePlantAnalysis()} disabled={plantAnalysisLoading} className="mt-5 w-full rounded-md bg-[#5d7342] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{plantAnalysisLoading ? "Analyserer" : "Kjør ny analyse"}</button></aside>
                  </div>
                  <section className="mt-5 overflow-hidden rounded-md border border-[#d9ddda] bg-white shadow-sm"><div className="border-b border-[#e1e4e2] px-4 py-3"><h3 className="font-semibold">Kjøringslogg</h3><p className="text-xs text-[#737d76]">Kostnad er estimert fra tokenbruk og listepris. NOK bruker estimert kurs 10,50.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f5f6f5] text-[11px] uppercase tracking-[0.05em] text-[#78817b]"><tr><th className="px-4 py-2">Tid</th><th className="px-4 py-2">Modell</th><th className="px-4 py-2">Resultat</th><th className="px-4 py-2">Tokens</th><th className="px-4 py-2">Estimert pris</th></tr></thead><tbody className="divide-y divide-[#e6e8e7]">{plantAnalysisHistory.length ? plantAnalysisHistory.map((run) => <tr key={run.id}><td className="px-4 py-3">{new Date(run.at).toLocaleString("nb-NO")}</td><td className="px-4 py-3 font-medium">{run.model}</td><td className="px-4 py-3"><span className="block">{run.analyzedPlants} analysert · {run.reusedPlants} gjenbrukt</span><span className="text-xs text-[#78817b]">{run.detail}</span></td><td className="px-4 py-3">{run.totalTokens.toLocaleString("nb-NO")}</td><td className="px-4 py-3">{run.estimatedCostNok == null ? "–" : `${run.estimatedCostNok.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`}<span className="block text-xs text-[#78817b]">{run.estimatedCostUsd == null ? "" : `$${run.estimatedCostUsd.toFixed(4)}`}</span></td></tr>) : <tr><td colSpan={5} className="px-4 py-6 text-center text-[#78817b]">Loggen fylles ved neste analysekjøring.</td></tr>}</tbody></table></div></section>
                  </>
                )}
              </section>
            )}

            {false && activeSection === "plants" && (
              <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Planter og sesonger</h2>
                    <p className="text-sm text-stone-600">
                      Bibliotekdata beskriver planten. Sesongdata gjelder valgt dyrkingsår og sendes til OpenAI sammen med historikk.
                    </p>
                    {plantAnalysis && (
                      <p className="mt-2 text-xs font-medium text-stone-500">
                        Siste analyse kjørt:{" "}
                        {new Date(plantAnalysis.generatedAt).toLocaleString("nb-NO", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {plantAnalysis.usage?.totalTokens ? (
                          <>
                            {" · "}
                            {plantAnalysis.usage.totalTokens.toLocaleString("nb-NO")} tokens
                            {plantAnalysis.usage.inputTokens || plantAnalysis.usage.outputTokens ? (
                              <>
                                {" "}
                                ({[
                                  plantAnalysis.usage.inputTokens ? `${plantAnalysis.usage.inputTokens.toLocaleString("nb-NO")} inn` : "",
                                  plantAnalysis.usage.outputTokens ? `${plantAnalysis.usage.outputTokens.toLocaleString("nb-NO")} ut` : "",
                                ].filter(Boolean).join(", ")})
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => void handleGeneratePlantAnalysis()} disabled={plantAnalysisLoading} className="rounded-full bg-[#5d7342] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4d6236] disabled:cursor-not-allowed disabled:opacity-55">
                    {plantAnalysisLoading ? "Analyserer" : "Kjør ny analyse"}
                  </button>
                </div>

                <div className="mb-5 grid gap-3 rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-3 md:grid-cols-[1fr_auto]">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      <span className="mb-1 block font-semibold">Sesong</span>
                      <select value={config.activePlantSeasonYear} onChange={(event) => setActivePlantYear(Number(event.target.value))} className="rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm">
                        {Array.from(new Set([...Object.keys(config.plantSeasons).map(Number), config.activePlantSeasonYear])).sort((a, b) => b - a).map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => setActivePlantYear(config.activePlantSeasonYear + 1)} className={adminSecondaryButtonClass}>
                      Opprett {config.activePlantSeasonYear + 1}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-52 flex-1 text-sm">
                      <span className="mb-1 block font-semibold">Legg til fra bibliotek</span>
                      <select value={selectedLibraryPlantId} onChange={(event) => setSelectedLibraryPlantId(event.target.value)} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm">
                        <option value="">Velg plante</option>
                        {availableLibraryPlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={addPlantFromLibrary} disabled={!selectedLibraryPlantId} className={adminPrimaryButtonClass}>Legg til</button>
                  </div>
                </div>

                <div className="mb-5 grid gap-2 rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-3 md:grid-cols-[1fr_180px_auto]">
                  <input type="text" value={newPlantName} onChange={(event) => setNewPlantName(event.target.value)} placeholder="Opprett ny plante" className="min-w-0 rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={80} />
                  <select value={newPlantType} onChange={(event) => setNewPlantType(event.target.value as PlantLibraryEntry["plantType"])} className="rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm">
                    {plantTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <button type="button" onClick={addPlant} disabled={!newPlantName.trim()} className={adminPrimaryButtonClass}>Opprett og legg til</button>
                </div>

                <label className="mb-5 block rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4 text-sm">
                  <span className="mb-1 block font-semibold text-[#2d3a21]">Generelt om drivhuset og drift</span>
                  <span className="mb-2 block text-xs text-stone-500">Sendes til OpenAI sammen med sensorverdier, sesongdata og historikk.</span>
                  <textarea value={config.plantAnalysisNotes} onChange={(event) => updateConfig((current) => ({ ...current, plantAnalysisNotes: event.target.value }))} placeholder="F.eks. automatisk lufting, vanning morgen/kveld, planter står tett..." className="min-h-28 w-full resize-y rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={1200} />
                </label>

                <div className="grid gap-3">
                  {activeSeasonPlants.map((seasonPlant, index) => {
                    const libraryPlant = plantLibraryById.get(seasonPlant.libraryId);
                    if (!libraryPlant) return null;
                    return (
                      <article key={seasonPlant.id} className="min-w-0 rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-[#cbd3c2] bg-white">
                              {libraryPlant.image ? <img src={resolveGreenhouseAssetUrl(libraryPlant.image)} alt={libraryPlant.name} className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[10px] text-stone-500">Ingen bilde</span>}
                            </div>
                            <div>
                              <h3 className="text-base font-semibold">{libraryPlant.name}</h3>
                              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">{libraryPlant.plantType}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex overflow-hidden rounded-full border border-[#cbd3c2] bg-white">
                              <button type="button" onClick={() => movePlant(index, index - 1)} disabled={index === 0} className="px-3 py-2 text-sm font-semibold text-[#5d7342] transition hover:bg-[#eef2ea] disabled:cursor-not-allowed disabled:opacity-35">↑</button>
                              <button type="button" onClick={() => movePlant(index, index + 1)} disabled={index === activeSeasonPlants.length - 1} className="border-l border-[#cbd3c2] px-3 py-2 text-sm font-semibold text-[#5d7342] transition hover:bg-[#eef2ea] disabled:cursor-not-allowed disabled:opacity-35">↓</button>
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-full border border-[#cbd3c2] bg-white px-3 py-2 text-sm font-semibold">
                              <input type="checkbox" checked={seasonPlant.active} onChange={(event) => updatePlant(seasonPlant.id, { active: event.target.checked })} className="h-4 w-4 accent-[#5d7342]" />
                              Aktiv
                            </label>
                            <button type="button" onClick={() => removePlant(seasonPlant.id)} className="rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">Fjern fra år</button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-4">
                          <label className="text-sm">
                            <span className="mb-1 block font-medium">Anskaffelse</span>
                            <select value={seasonPlant.acquisition} onChange={(event) => updatePlant(seasonPlant.id, { acquisition: event.target.value as PlantSeasonEntry["acquisition"] })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm">
                              {acquisitionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </label>
                          {seasonPlant.acquisition === "seed" && (
                            <>
                              <label className="text-sm">
                                <span className="mb-1 block font-medium">Sådato</span>
                                <input type="date" value={seasonPlant.seedDate} onChange={(event) => updatePlant(seasonPlant.id, { seedDate: event.target.value })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" />
                              </label>
                              <label className="text-sm">
                                <span className="mb-1 block font-medium">Hvor sådd</span>
                                <select value={seasonPlant.seedLocation} onChange={(event) => updatePlant(seasonPlant.id, { seedLocation: event.target.value as PlantSeasonEntry["seedLocation"] })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm">
                                  <option value="">Velg</option>
                                  {seedLocationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
                                </select>
                              </label>
                            </>
                          )}
                          <label className="text-sm">
                            <span className="mb-1 block font-medium">Dato plassert i drivhus</span>
                            <input type="date" value={seasonPlant.greenhouseDate} onChange={(event) => updatePlant(seasonPlant.id, { greenhouseDate: event.target.value })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block font-medium">Utplanting / høsting</span>
                            <input type="date" value={seasonPlant.harvestDate} onChange={(event) => updatePlant(seasonPlant.id, { harvestDate: event.target.value })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block font-medium">Hvor kjøpt</span>
                            <input type="text" value={seasonPlant.purchaseSource} onChange={(event) => updatePlant(seasonPlant.id, { purchaseSource: event.target.value })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={160} />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block font-medium">Plantet i</span>
                            <input type="text" value={seasonPlant.plantingPlace} onChange={(event) => updatePlant(seasonPlant.id, { plantingPlace: event.target.value })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={120} />
                          </label>
                          <label className="text-sm md:col-span-2">
                            <span className="mb-1 block font-medium">Notat til analysen</span>
                            <textarea value={seasonPlant.note} onChange={(event) => updatePlant(seasonPlant.id, { note: event.target.value })} className="min-h-[84px] w-full resize-y rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={360} rows={3} />
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <details className="mt-5 rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-[#2d3a21]">Plantebibliotek ({config.plantLibrary.length})</summary>
                  <div className="mt-4 grid gap-3">
                    {config.plantLibrary.map((plant) => {
                      const assets = getPlantImageAssets(plant);
                      return (
                        <article key={plant.id} className="rounded-lg border border-[#d8ded1] bg-white p-4">
                          <div className="grid gap-4 lg:grid-cols-[120px_minmax(0,1fr)]">
                            <div>
                              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-[#cbd3c2] bg-white">
                                {plant.image ? <img src={resolveGreenhouseAssetUrl(plant.image)} alt={plant.name} className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[11px] text-stone-500">Ingen bilde</span>}
                              </div>
                              <label className="mt-2 inline-flex cursor-pointer rounded-full bg-[#5d7342] px-3 py-1.5 text-xs font-semibold text-white">
                                Last opp
                                <input type="file" accept="image/jpeg,image/png" disabled={uploading} onChange={(event) => { void handlePlantImageUpload(plant, event.target.files?.[0]); event.target.value = ""; }} className="sr-only" />
                              </label>
                            </div>
                            <div className="grid gap-3 md:grid-cols-4">
                              <label className="text-sm md:col-span-2">
                                <span className="mb-1 block font-medium">Plantenavn</span>
                                <input type="text" value={plant.name} onChange={(event) => updateLibraryPlant(plant.id, { name: event.target.value })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={80} />
                              </label>
                              <label className="text-sm">
                                <span className="mb-1 block font-medium">Plantetype</span>
                                <select value={plant.plantType} onChange={(event) => updateLibraryPlant(plant.id, { plantType: event.target.value as PlantLibraryEntry["plantType"] })} className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm">
                                  {plantTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                                </select>
                              </label>
                              <label className="text-sm md:col-span-4">
                                <span className="mb-1 block font-medium">Generell plantesetning</span>
                                <textarea value={plant.description} onChange={(event) => updateLibraryPlant(plant.id, { description: event.target.value })} placeholder="Kort tekst om planten som følger planten på tvers av sesonger." className="min-h-[76px] w-full resize-y rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm" maxLength={500} />
                              </label>
                            </div>
                          </div>
                          {assets.length > 0 && (
                            <details className="mt-4 border-t border-[#d8ded1] pt-3">
                              <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.04em] text-stone-500">R2-bilder ({assets.length})</summary>
                              <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {assets.map((asset) => (
                                  <div key={`${plant.id}-${asset.key}`} className={`rounded-lg border bg-white p-1 ${plant.image === asset.url ? "border-[#5d7342] ring-2 ring-[#5d7342]/20" : "border-[#d8ded1]"}`}>
                                    <button type="button" onClick={() => { updateLibraryPlant(plant.id, { image: asset.url }); setMessage(`${asset.filename} er valgt for ${plant.name}. Husk å lagre.`); }} className="block w-full text-left">
                                      <span className="grid max-h-56 min-h-24 w-full place-items-center overflow-hidden rounded-md bg-[#eef2ea]">
                                        <img src={resolveGreenhouseAssetUrl(asset.url)} alt={asset.filename} className="max-h-56 max-w-full object-contain" />
                                      </span>
                                      <span className="mt-1 block truncate px-1 text-[10px] text-stone-500">{asset.filename}</span>
                                    </button>
                                    <div className="mt-1 flex items-center justify-between gap-1 px-1 pb-1">
                                      <span className="truncate text-[10px] font-semibold text-[#5d7342]">{plant.image === asset.url ? "Valgt" : "R2"}</span>
                                      <button type="button" onClick={() => void handleDeleteImage(asset)} className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700 transition hover:bg-red-50">Slett</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </details>
              </section>
            )}

            {activeSection === "header" && (
              <>
                <section className="min-w-0">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#d9ddda] pb-5">
                    <div>
                      <h2 className="text-base font-semibold">Modus og skjerm</h2>
                      <p className="text-sm text-stone-600">Styr bilder og skjerm per modus. Felles light/dark-design redigeres under Normalt.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleReloadAdminData}
                      className="rounded-md border border-[#cbd3c2] bg-white px-4 py-2 text-sm font-semibold text-[#4d5d3e] transition hover:border-[#9daa8f] hover:bg-[#f7f8f5]"
                    >
                      Oppdater
                    </button>
                  </div>

                  <div className="grid gap-5">
                    <div className="flex max-w-full gap-1 overflow-x-auto border-b border-[#d9ddda]">
                      {imageSlots.map((slot) => {
                        const slotConfig = config.headerImages[slot];
                        const isSelected = selectedHeaderSlot === slot;
                        const isActive = activeSlot === slot;

                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedHeaderSlot(slot)}
                            className={`min-w-32 shrink-0 border-b-2 px-3 py-3 text-left transition ${
                              isSelected
                                ? "border-[#5d7342] text-[#344326]"
                                : "border-transparent text-[#68716b] hover:text-[#344326]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold">{slotConfig.label}</h3>
                                <p className="whitespace-nowrap text-xs text-stone-500">{slotConfig.description}</p>
                              </div>
                              {isActive && <span className={adminTagClass}>Aktiv nå</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <article className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedHeaderConfig.label}</h3>
                          <p className="text-sm text-stone-500">{selectedHeaderConfig.description}</p>
                        </div>
                        {selectedHeaderSlot === activeSlot && <span className={adminSelectedTagClass}>Brukes akkurat nå</span>}
                      </div>

                      <div className="mb-4 rounded-lg border border-[#d8ded1] bg-white/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">Darkmode/theme-farge</p>
                            <p className="text-xs text-stone-500">
                              Brukes som mørk bakgrunn og mobil theme-color når denne staten er aktiv.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-semibold text-[#2d3a21]">
                            <span
                              className="h-9 w-9 rounded-lg border border-[#cbd3c2]"
                              style={{ backgroundColor: selectedDarkModeColor }}
                              aria-hidden="true"
                            />
                            <input
                              type="color"
                              value={selectedDarkModeColor}
                              onChange={(event) => setHeaderDarkModeColor(selectedHeaderSlot, event.target.value)}
                              className="h-9 w-12 cursor-pointer rounded border border-[#cbd3c2] bg-white p-1"
                              aria-label="Velg darkmode/theme-farge"
                            />
                            <input
                              type="text"
                              value={selectedHeaderConfig.darkModeColor}
                              onChange={(event) => setHeaderDarkModeColor(selectedHeaderSlot, event.target.value)}
                              className="w-24 rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                              pattern="#[0-9a-fA-F]{6}"
                            />
                          </label>
                        </div>
                      </div>

                      <Tabs defaultValue="assets" className="gap-4">
                        <TabsList className="border border-[#cbd3c2] bg-white">
                          <TabsTrigger value="assets" className="data-[state=active]:bg-[#5d7342] data-[state=active]:text-white">Bilder</TabsTrigger>
                          <TabsTrigger value="display" className="data-[state=active]:bg-[#5d7342] data-[state=active]:text-white">Rund skjerm</TabsTrigger>
                          <TabsTrigger value="colors" className="data-[state=active]:bg-[#5d7342] data-[state=active]:text-white">Farger</TabsTrigger>
                        </TabsList>

                        <TabsContent value="assets">
                          <div className="grid gap-3 xl:grid-cols-3">
                            {headerAssetKinds
                              .filter((assetKind) => assetKind.key !== "display-image")
                              .map((assetKind) => renderSelectedHeaderCard(selectedHeaderSlot, assetKind.key))}
                          </div>
                        </TabsContent>

                        <TabsContent value="display">
                          {renderDisplayImageEditor(selectedHeaderSlot)}
                        </TabsContent>

                        <TabsContent value="colors">
                          {renderDisplayThemeControls()}
                        </TabsContent>
                      </Tabs>
                    </article>

                    <section ref={headerLibraryRef} className="rounded-lg border border-[#d8ded1] bg-white/70 p-4 scroll-mt-24">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">R2-bibliotek</h3>
                          <p className="text-sm text-stone-600">
                            Velg format og trykk <span className="font-semibold text-[#2d3a21]">Bruk</span> på filen du vil koble til {config.headerImages[selectedHeaderSlot].label.toLowerCase()}.
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-stone-500">
                            Desktop: {getUploadSizeGuidance("desktop")} Mobil: {getUploadSizeGuidance("mobile")} Skjerm: 164 x 466 PNG-stripe. Video: {headerVideoGuidance}
                          </p>
                        </div>
                        <div className="flex rounded-full border border-[#cbd3c2] bg-[#f7f8f5] p-1">
                          {headerAssetKinds.map((assetKind) => (
                            <button
                              key={assetKind.key}
                              type="button"
                              onClick={() => setSelectedHeaderAssetKind(assetKind.key)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                selectedHeaderAssetKind === assetKind.key
                                  ? "bg-[#5d7342] text-white"
                                  : "text-[#4d5d3e] hover:bg-white"
                              }`}
                            >
                              {assetKind.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {renderHeaderAssetLibrary(selectedHeaderSlot, selectedHeaderAssetKind)}
                    </section>
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </main>
      {hasUnsavedChanges && (
        <div className="fixed inset-x-3 bottom-3 z-[80] flex items-center justify-between gap-3 rounded-lg border border-[#76905f] bg-[#263029] px-4 py-3 text-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:min-w-[310px]">
          <div><p className="text-sm font-semibold">Ulagrede endringer</p><p className="text-xs text-white/65">Husk å lagre før du går videre.</p></div>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="shrink-0 rounded-md bg-[#759354] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Lagrer …" : "Lagre"}</button>
        </div>
      )}
    </div>
  );
}
