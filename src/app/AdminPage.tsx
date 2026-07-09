import { useEffect, useMemo, useRef, useState } from "react";
import SunCalc from "suncalc";
import {
  defaultSiteConfig,
  acquisitionOptions,
  deleteAdminImage,
  fetchAdminImages,
  fetchAdminSiteConfig,
  fetchLatestGreenhouseData,
  fetchStoredPlantAnalysis,
  fetchWeatherData,
  generatePlantAnalysis,
  logoFontOptions,
  plantTypeOptions,
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
  type PlantConfig,
  type PlantLibraryEntry,
  type PlantSeasonEntry,
  type SiteConfig,
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
  { key: "plantAnalysis", label: "Planteanalyse" },
  { key: "charts", label: "Grafer" },
];

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

const adminSections: Array<{ key: AdminSection; label: string }> = [
  { key: "visibility", label: "Visning" },
  { key: "plants", label: "Planter" },
  { key: "header", label: "Modus og skjerm" },
  { key: "logo", label: "Logo" },
  { key: "data", label: "Data" },
  { key: "metadata", label: "Metadata" },
];

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
  const [activeSection, setActiveSection] = useState<AdminSection>("visibility");
  const [newPlantName, setNewPlantName] = useState("");
  const [newPlantType, setNewPlantType] = useState<PlantLibraryEntry["plantType"]>("Grønnsak");
  const [selectedLibraryPlantId, setSelectedLibraryPlantId] = useState("");
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
      const [siteConfig, r2Images, latestData, weatherResult, storedPlantAnalysis] = await Promise.all([
        fetchAdminSiteConfig(),
        fetchAdminImages(),
        fetchLatestGreenhouseData().catch(() => null),
        fetchWeatherData()
          .then((data) => ({ data, fetchedAt: new Date() }))
          .catch(() => null),
        fetchStoredPlantAnalysis().catch(() => null),
      ]);

      setConfig(siteConfig);
      setSavedConfigSnapshot(JSON.stringify(siteConfig));
      setImages(r2Images);
      setLatest(latestData);
      setWeatherData(weatherResult?.data ?? null);
      setWeatherFetchedAt(weatherResult?.fetchedAt ?? null);
      setPlantAnalysis(storedPlantAnalysis);
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
        plantLibrary: [...current.plantLibrary, { id, name, plantType: newPlantType, description: "", image: "" }],
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
              harvestDate: "",
              plantingPlace: "",
              active: true,
              note: "",
            },
          ],
        },
      };
    });
    setNewPlantName("");
    setNewPlantType("Grønnsak");
    setMessage(`${name} er lagt til. Husk å lagre.`);
  };

  const addPlantFromLibrary = () => {
    const libraryId = selectedLibraryPlantId;
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
        harvestDate: "",
        plantingPlace: "",
        active: true,
        note: "",
      },
    ]);
    setSelectedLibraryPlantId("");
    setMessage(`${plant.name} er lagt til i ${config.activePlantSeasonYear}. Husk å lagre.`);
  };

  const updatePlant = (id: string, updates: Partial<PlantSeasonEntry>) => {
    updateActiveSeasonPlants((plants) => plants.map((plant) => plant.id === id ? { ...plant, ...updates } : plant));
  };

  const updateLibraryPlant = (id: string, updates: Partial<PlantLibraryEntry>) => {
    updatePlantLibrary((plants) => plants.map((plant) => plant.id === id ? { ...plant, ...updates } : plant));
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
      headerImages: {
        ...current.headerImages,
        [selectedHeaderSlot]: {
          ...current.headerImages[selectedHeaderSlot],
          plantAnalysisTheme: {
            ...current.headerImages[selectedHeaderSlot].plantAnalysisTheme,
            [mode]: {
              ...current.headerImages[selectedHeaderSlot].plantAnalysisTheme[mode],
              [key]: value,
            },
          },
        },
      },
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

  const handleGeneratePlantAnalysis = async () => {
    setPlantAnalysisLoading(true);
    setError(null);
    setMessage(null);

    try {
      const analysis = await generatePlantAnalysis();
      setPlantAnalysis(analysis);
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
    slot: HeaderImageSlot,
    mode: keyof DisplayThemeConfig,
    key: keyof DisplayThemeModeConfig,
    value: string | number
  ) => {
    updateConfig((current) => ({
      ...current,
      headerImages: {
        ...current.headerImages,
        [slot]: {
          ...current.headerImages[slot],
          displayTheme: {
            ...current.headerImages[slot].displayTheme,
            [mode]: {
              ...current.headerImages[slot].displayTheme[mode],
              [key]: value,
            },
          },
        },
      },
    }));
  };

  const resetDisplayThemeForSlot = (slot: HeaderImageSlot) => {
    updateConfig((current) => ({
      ...current,
      headerImages: {
        ...current.headerImages,
        [slot]: {
          ...current.headerImages[slot],
          displayTheme: defaultSiteConfig.headerImages[slot].displayTheme,
          plantAnalysisTheme: defaultSiteConfig.headerImages[slot].plantAnalysisTheme,
        },
      },
    }));
    setMessage(`${config.headerImages[slot].label} er tilbakestilt til standardfarger. Husk å lagre.`);
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
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await saveAdminSiteConfig(config);
      setConfig(saved);
      setSavedConfigSnapshot(JSON.stringify(saved));
      setMessage("Lagret");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre");
    } finally {
      setSaving(false);
    }
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
    const slotTheme = selectedHeaderConfig.displayTheme;
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
          <h3 className="font-semibold">Farger for {selectedHeaderConfig.label.toLowerCase()}</h3>
          <p className="text-sm text-stone-600">
            Hver state har egne farger. Dark mode sendes også til ESP32-skjermen.
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
            {renderMode("dark", "Dark mode + skjerm", "Disse verdiene sendes til rund skjerm via display-config.")}
            <div className="mt-4 rounded-lg border border-[#d8ded1] bg-white/75 p-3">
              <h4 className="font-semibold text-[#2d3a21]">Planteanalyse dark mode</h4>
              <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="grid gap-2 sm:grid-cols-2">{plantThemeFields.map((field) => renderPlantThemeField("dark", field))}</div>
                {renderPlantThemePreview("dark")}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="light">
            {renderMode("light", "Light mode web", "Brukes bare når web kjører i lys modus.")}
            <div className="mt-4 rounded-lg border border-[#d8ded1] bg-white/75 p-3">
              <h4 className="font-semibold text-[#2d3a21]">Planteanalyse light mode</h4>
              <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="grid gap-2 sm:grid-cols-2">{plantThemeFields.map((field) => renderPlantThemeField("light", field))}</div>
                {renderPlantThemePreview("light")}
              </div>
            </div>
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
    <div className="min-h-screen bg-[#e8ede3] text-[#2d3a21]">
      <header className="sticky top-0 z-30 bg-[#5d7342] px-5 py-4 text-white shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium">Admin</h1>
            <p className="text-sm text-white/70">Kristins drivhus</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !hasUnsavedChanges}
            className={`inline-flex min-w-[11rem] justify-center overflow-hidden rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed ${
              hasUnsavedChanges
                ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                : "bg-white/55 text-white/75 disabled:opacity-100"
            }`}
          >
            {saving ? "Lagrer" : hasUnsavedChanges ? "Lagre endringer" : "Lagret"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
        {(message || error) && (
          <div className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-red-100 text-red-800" : "bg-white text-[#4d5d3e]"}`}>
            {error || message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <nav className="rounded-lg border border-[#d8ded1] bg-white/70 p-2 shadow-sm">
              {adminSections.map((section) => {
                const active = activeSection === section.key;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${
                      active
                        ? "bg-[#5d7342] text-white"
                        : "text-[#2d3a21] hover:bg-[#f7f8f5]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {section.label}
                    {active && <span className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-6">
            {activeSection === "visibility" && (
              <>
                <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                  <h2 className="mb-4 text-base font-semibold">Visning</h2>
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
                  <div className="mt-4 border-t border-[#d8ded1] pt-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.04em] text-stone-500">Statuser</p>
                    {statusLabels.map((status) => (
                      <label key={status.key} className="flex items-center justify-between gap-4 py-2 text-sm">
                        <span>{status.label}</span>
                        <input
                          type="checkbox"
                          checked={config.visibleStatuses[status.key]}
                          onChange={(event) =>
                            updateConfig((current) => ({
                              ...current,
                              visibleStatuses: {
                                ...current.visibleStatuses,
                                [status.key]: event.target.checked,
                              },
                            }))
                          }
                          className="h-5 w-5 accent-[#5d7342]"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                  <h2 className="mb-2 text-base font-semibold">Aktivt nå</h2>
                  <p className="text-sm text-stone-600">
                    {latest?.temperature == null
                      ? "Ingen temperaturdata. Normalbildet brukes."
                      : `${latest.temperature.toFixed(1)}°C bruker ${config.headerImages[activeSlot].label.toLowerCase()}.`}
                  </p>
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
                <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Modus og skjerm</h2>
                      <p className="text-sm text-stone-600">Velg temperaturmodus, styr bilder for web/skjerm og juster farger per modus.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleReloadAdminData}
                      className="rounded-full border border-[#cbd3c2] bg-white px-4 py-2 text-sm font-semibold text-[#4d5d3e] transition hover:border-[#9daa8f] hover:bg-[#f7f8f5]"
                    >
                      Oppdater
                    </button>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {imageSlots.map((slot) => {
                        const slotConfig = config.headerImages[slot];
                        const isSelected = selectedHeaderSlot === slot;
                        const isActive = activeSlot === slot;

                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedHeaderSlot(slot)}
                            className={`rounded-lg border p-3 text-left transition ${
                              isSelected
                                ? "border-[#5d7342] bg-white shadow-sm"
                                : "border-[#d8ded1] bg-[#f7f8f5] hover:border-[#9daa8f] hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold">{slotConfig.label}</h3>
                                <p className="text-sm text-stone-500">{slotConfig.description}</p>
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
    </div>
  );
}
