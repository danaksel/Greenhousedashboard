import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultSiteConfig,
  deleteAdminImage,
  fetchAdminImages,
  fetchAdminSiteConfig,
  fetchLatestGreenhouseData,
  fetchWeatherData,
  logoFontOptions,
  renameAdminImage,
  resolveGreenhouseAssetUrl,
  saveAdminSiteConfig,
  uploadAdminAsset,
  uploadAdminHeaderVideo,
  uploadAdminImage,
  type AdminImage,
  type HeaderImageFormat,
  type HeaderImageSlot,
  type LatestData,
  type SiteConfig,
  type WeatherData,
} from "./utils/api";

const imageSlots: HeaderImageSlot[] = ["cold", "normal", "warm", "hot"];
const headerVideoGuidance = "MP4/MPEG-4 (H.264), ikke MOV. Uten lyd, sømløs loop. Anbefalt 1920 x 1080 px, 16:9, 3-6 sekunder, maks 10 MB.";
const headerVideoMaxBytes = 10 * 1024 * 1024;

const statusLabels: Array<{ key: keyof SiteConfig["visibleStatuses"]; label: string }> = [
  { key: "door", label: "Dør" },
  { key: "fan", label: "Vifte" },
  { key: "window", label: "Vindu" },
];

type AdminSection = "logo" | "visibility" | "data" | "metadata" | "header";

const adminSections: Array<{ key: AdminSection; label: string }> = [
  { key: "visibility", label: "Visning" },
  { key: "header", label: "Headerbilde" },
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

type HeaderAssetKind = HeaderImageFormat | "mobile-video";

const headerAssetKinds: Array<{ key: HeaderAssetKind; label: string; ratio: string; fallbackFormat: string }> = [
  { key: "desktop", label: "Desktop", ratio: "3:1", fallbackFormat: "JPG/PNG" },
  { key: "mobile", label: "Mobil", ratio: "390:200", fallbackFormat: "JPG/PNG" },
  { key: "mobile-video", label: "Video", ratio: "16:9", fallbackFormat: "MP4" },
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

function getActiveSlot(temperature: number | null | undefined): HeaderImageSlot {
  if (temperature == null) return "normal";
  if (temperature < 12) return "cold";
  if (temperature < 23) return "normal";
  if (temperature <= 28) return "warm";
  return "hot";
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

export function AdminPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState(() => JSON.stringify(defaultSiteConfig));
  const [images, setImages] = useState<AdminImage[]>([]);
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherFetchedAt, setWeatherFetchedAt] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("visibility");
  const [selectedHeaderSlot, setSelectedHeaderSlot] = useState<HeaderImageSlot>("normal");
  const [selectedHeaderAssetKind, setSelectedHeaderAssetKind] = useState<HeaderAssetKind>("desktop");
  const [editingImageKey, setEditingImageKey] = useState<string | null>(null);
  const [editingFilenameBase, setEditingFilenameBase] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headerLibraryRef = useRef<HTMLElement | null>(null);

  const activeSlot = useMemo(() => getActiveSlot(latest?.temperature), [latest?.temperature]);
  const configSnapshot = useMemo(() => JSON.stringify(config), [config]);
  const hasUnsavedChanges = !loading && configSnapshot !== savedConfigSnapshot;

  const loadAdminData = async () => {
    setError(null);
    setLoading(true);

    try {
      const [siteConfig, r2Images, latestData, weatherResult] = await Promise.all([
        fetchAdminSiteConfig(),
        fetchAdminImages(),
        fetchLatestGreenhouseData().catch(() => null),
        fetchWeatherData()
          .then((data) => ({ data, fetchedAt: new Date() }))
          .catch(() => null),
      ]);

      setConfig(siteConfig);
      setSavedConfigSnapshot(JSON.stringify(siteConfig));
      setImages(r2Images);
      setLatest(latestData);
      setWeatherData(weatherResult?.data ?? null);
      setWeatherFetchedAt(weatherResult?.fetchedAt ?? null);
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

  const headerAssets = images.filter((image) => (image.assetType ?? "header") === "header");
  const headerVideoAssets = images.filter((image) => image.assetType === "header-video");
  const logoAssets = images.filter((image) => image.assetType === "logo");
  const faviconAssets = images.filter((image) => image.assetType === "favicon");
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
    return slotConfig[kind];
  };

  const getSelectedHeaderAsset = (value: string) => images.find((image) => image.url === value);

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

  const renderHeaderAssetLibrary = (slot: HeaderImageSlot, kind: HeaderAssetKind) => {
    const selectedUrl = getHeaderAssetValue(slot, kind);
    const isVideo = kind === "mobile-video";
    const assets = isVideo
      ? headerVideoAssets.filter((video) => (video.slot === slot || video.slot === "general") && video.format === "mobile-video")
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
              <div className={`relative overflow-hidden rounded-lg bg-stone-200 ${kind === "desktop" ? "aspect-[3/1]" : isVideo ? "aspect-video" : "aspect-[390/200]"}`}>
                {isVideo ? (
                  renderAdminVideoPreview(asset.url, asset.filename)
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
              <div className="mt-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
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
                    <button
                      type="button"
                      onClick={() => startRenameImage(asset)}
                      className="block max-w-full truncate text-left text-sm font-semibold text-[#2d3a21] underline-offset-2 hover:underline"
                      title="Klikk for å endre filnavn"
                    >
                      {asset.filename}
                    </button>
                  )}
                  <p className="text-xs text-stone-500">{formatBytes(asset.size)}</p>
                </div>
                {!isEditing && !isSelected && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isVideo) applyVideo(slot, asset);
                      else applyImage(slot, kind, asset);
                    }}
                    className={adminPrimaryButtonClass}
                  >
                    Bruk
                  </button>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteImage(asset)}
                    className={adminDangerButtonClass}
                  >
                    Slett
                  </button>
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
            className={`rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed ${
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

            {activeSection === "header" && (
              <>
                <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Header</h2>
                      <p className="text-sm text-stone-600">Velg temperaturstate, se hva som er aktivt, og bruk R2-biblioteket under.</p>
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
                          <h3 className="text-lg font-semibold">{config.headerImages[selectedHeaderSlot].label}</h3>
                          <p className="text-sm text-stone-500">{config.headerImages[selectedHeaderSlot].description}</p>
                        </div>
                        {selectedHeaderSlot === activeSlot && <span className={adminSelectedTagClass}>Brukes akkurat nå</span>}
                      </div>

                      <div className="grid gap-3 xl:grid-cols-3">
                        {headerAssetKinds.map((assetKind) => renderSelectedHeaderCard(selectedHeaderSlot, assetKind.key))}
                      </div>
                    </article>

                    <section ref={headerLibraryRef} className="rounded-lg border border-[#d8ded1] bg-white/70 p-4 scroll-mt-24">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">R2-bibliotek</h3>
                          <p className="text-sm text-stone-600">
                            Velg format og trykk <span className="font-semibold text-[#2d3a21]">Bruk</span> på filen du vil koble til {config.headerImages[selectedHeaderSlot].label.toLowerCase()}.
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-stone-500">
                            Desktop: {getUploadSizeGuidance("desktop")} Mobil: {getUploadSizeGuidance("mobile")} Video: {headerVideoGuidance}
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
