import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultSiteConfig,
  deleteAdminImage,
  fetchAdminImages,
  fetchAdminSiteConfig,
  fetchLatestGreenhouseData,
  resolveGreenhouseAssetUrl,
  saveAdminSiteConfig,
  uploadAdminAsset,
  uploadAdminImage,
  type AdminImage,
  type HeaderImageFormat,
  type HeaderImageSlot,
  type LatestData,
  type SiteConfig,
} from "./utils/api";

const imageSlots: HeaderImageSlot[] = ["cold", "normal", "warm", "hot"];
const imageFormats: Array<{ key: HeaderImageFormat; label: string; ratio: string }> = [
  { key: "desktop", label: "Desktop 3:1", ratio: "3:1" },
  { key: "mobile", label: "Mobil ca. 2:1", ratio: "390:200" },
];

const statusLabels: Array<{ key: keyof SiteConfig["visibleStatuses"]; label: string }> = [
  { key: "door", label: "Dør" },
  { key: "fan", label: "Vifte" },
  { key: "window", label: "Vindu" },
];

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

function getUploadSizeGuidance(format: HeaderImageFormat) {
  if (format === "desktop") {
    return "Anbefalt 2400 x 800 px for retina. Minimum 1200 x 400 px. Format 3:1.";
  }

  return "Anbefalt 900 x 460 px for retina. Minimum 780 x 400 px. Format ca. 390:200.";
}

function getImagePreviewAspectClass(image: AdminImage) {
  return image.format === "mobile" ? "aspect-[390/200]" : "aspect-[3/1]";
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
  const [images, setImages] = useState<AdminImage[]>([]);
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<HeaderImageSlot>("normal");
  const [selectedFormat, setSelectedFormat] = useState<HeaderImageFormat>("desktop");
  const selectedSlotRef = useRef<HeaderImageSlot>("normal");
  const selectedFormatRef = useRef<HeaderImageFormat>("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSlot = useMemo(() => getActiveSlot(latest?.temperature), [latest?.temperature]);

  const loadAdminData = async () => {
    setError(null);
    setLoading(true);

    try {
      const [siteConfig, r2Images, latestData] = await Promise.all([
        fetchAdminSiteConfig(),
        fetchAdminImages(),
        fetchLatestGreenhouseData().catch(() => null),
      ]);

      setConfig(siteConfig);
      setImages(r2Images);
      setLatest(latestData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste admin-data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const updateConfig = (updater: (current: SiteConfig) => SiteConfig) => {
    setConfig((current) => updater(current));
    setMessage(null);
  };

  const setSelectedUploadSlot = (slot: HeaderImageSlot) => {
    selectedSlotRef.current = slot;
    setSelectedSlot(slot);
  };

  const setSelectedUploadFormat = (format: HeaderImageFormat) => {
    selectedFormatRef.current = format;
    setSelectedFormat(format);
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await saveAdminSiteConfig(config);
      setConfig(saved);
      setMessage("Lagret");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const targetSlot = selectedSlotRef.current;
      const targetFormat = selectedFormatRef.current;
      const image = await uploadAdminImage(file, targetSlot, targetFormat);
      setImages((current) => [image, ...current.filter((item) => item.key !== image.key)]);
      setImage(targetSlot, targetFormat, image.url);
      setMessage(`Bildet er lastet opp og valgt for ${config.headerImages[targetSlot].label.toLowerCase()} / ${targetFormat === "desktop" ? "desktop" : "mobil"}. Husk å lagre.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp bildet");
    } finally {
      setUploading(false);
    }
  };

  const setLogo = (url: string) => {
    updateConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        logo: {
          url,
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
      };
    }

    next.branding = {
      ...current.branding,
      logo: {
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

  const headerAssets = images.filter((image) => (image.assetType ?? "header") === "header");
  const selectedImages = headerAssets.filter(
    (image) => (image.slot === selectedSlot || image.slot === "general") && image.format === selectedFormat
  );
  const logoAssets = images.filter((image) => image.assetType === "logo");
  const faviconAssets = images.filter((image) => image.assetType === "favicon");

  return (
    <div className="min-h-screen bg-[#e8ede3] text-[#2d3a21]">
      <header className="sticky top-0 z-20 bg-[#5d7342] px-5 py-4 text-white shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium">Admin</h1>
            <p className="text-sm text-white/70">Kristins drivhus</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#2d3a21] shadow-sm transition hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? "Lagrer" : "Lagre"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6">
        {(message || error) && (
          <div className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-red-100 text-red-800" : "bg-white text-[#4d5d3e]"}`}>
            {error || message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
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
            </div>

            <div className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">Aktivt nå</h2>
              <p className="text-sm text-stone-600">
                {latest?.temperature == null
                  ? "Ingen temperaturdata. Normalbildet brukes."
                  : `${latest.temperature.toFixed(1)}°C bruker ${config.headerImages[activeSlot].label.toLowerCase()}.`}
              </p>
            </div>

            <div className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
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
            </div>
          </div>

          <div className="space-y-6">
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
                        className="block h-16 w-16 bg-[#2d3a21]"
                        style={{
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
                </div>

                <div className="space-y-4">
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

            <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Headerbilder</h2>
                  <p className="text-sm text-stone-600">Desktop bruker 3:1. Mobil bruker dagens headerflate, ca. 390:200.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAdminData()}
                  className="rounded-full border border-[#cbd3c2] px-4 py-2 text-sm text-[#4d5d3e] transition hover:bg-white"
                >
                  Oppdater
                </button>
              </div>

              <div className="grid gap-4">
                {imageSlots.map((slot) => {
                  const slotConfig = config.headerImages[slot];
                  const isActive = activeSlot === slot;

                  return (
                    <div key={slot} className="rounded-lg border border-[#d8ded1] bg-[#f7f8f5] p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{slotConfig.label}</h3>
                          <p className="text-sm text-stone-500">{slotConfig.description}</p>
                        </div>
                        {isActive && (
                          <span className="rounded-full bg-[#5d7342] px-3 py-1 text-xs font-semibold text-white">
                            Aktiv nå
                          </span>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {imageFormats.map((format) => {
                          const value = slotConfig[format.key];
                          return (
                            <div key={format.key} className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold">{format.label}</p>
                                <span className="text-xs text-stone-500">{format.ratio}</span>
                              </div>
                              <div className={`overflow-hidden rounded-lg bg-stone-200 ${format.key === "desktop" ? "aspect-[3/1]" : "aspect-[390/200]"}`}>
                                <img
                                  src={resolveGreenhouseAssetUrl(value)}
                                  alt={`${slotConfig.label} ${format.label}`}
                                  className="h-full w-full object-cover object-center"
                                />
                              </div>
                              <select
                                value={value}
                                onChange={(event) => setImage(slot, format.key, event.target.value)}
                                className="w-full rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                              >
                                <option value={defaultSiteConfig.headerImages[slot][format.key]}>
                                  Standardbilde
                                </option>
                                {headerAssets.map((image) => (
                                  <option key={`${slot}-${format.key}-${image.key}`} value={image.url}>
                                    {image.filename}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUploadSlot(slot);
                                  setSelectedUploadFormat(format.key);
                                }}
                                className="rounded-full border border-[#cbd3c2] px-3 py-1.5 text-xs text-[#4d5d3e] transition hover:bg-white"
                              >
                                Velg som opplastingsmål
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-[#d8ded1] bg-white/70 p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">R2-bilder</h2>
                  <p className="text-sm text-stone-600">Last opp JPG/PNG eller velg et bilde som allerede ligger i R2.</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Desktop: 2400 x 800 px anbefalt. Mobil: 900 x 460 px anbefalt.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedSlot}
                    onChange={(event) => setSelectedUploadSlot(event.target.value as HeaderImageSlot)}
                    className="rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                  >
                    {imageSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {config.headerImages[slot].label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedFormat}
                    onChange={(event) => setSelectedUploadFormat(event.target.value as HeaderImageFormat)}
                    className="rounded-lg border border-[#cbd3c2] bg-white px-3 py-2 text-sm"
                  >
                    {imageFormats.map((format) => (
                      <option key={format.key} value={format.key}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="mb-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#9daa8f] bg-[#f7f8f5] px-4 py-8 text-center transition hover:bg-white">
                <span className="text-sm font-semibold">{uploading ? "Laster opp" : "Last opp bilde"}</span>
                <span className="mt-1 text-xs text-stone-500">JPG eller PNG for {config.headerImages[selectedSlot].label.toLowerCase()} / {selectedFormat}</span>
                <span className="mt-2 max-w-md text-xs leading-relaxed text-stone-500">
                  {getUploadSizeGuidance(selectedFormat)}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={uploading}
                  onChange={(event) => {
                    void handleUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>

              {loading ? (
                <div className="rounded-lg bg-[#f7f8f5] p-5 text-sm text-stone-500">Laster bilder</div>
              ) : selectedImages.length === 0 ? (
                <div className="rounded-lg bg-[#f7f8f5] p-5 text-sm text-stone-500">
                  Ingen {selectedFormat === "desktop" ? "desktopbilder" : "mobilbilder"} funnet for {config.headerImages[selectedSlot].label.toLowerCase()} ennå.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedImages.map((image) => (
                    <article key={image.key} className="overflow-hidden rounded-lg border border-[#d8ded1] bg-[#f7f8f5]">
                      <div className={`${getImagePreviewAspectClass(image)} bg-stone-200`}>
                        <img
                          src={resolveGreenhouseAssetUrl(image.url)}
                          alt={image.filename}
                          className="h-full w-full object-cover object-center"
                        />
                      </div>
                      <div className="space-y-3 p-3">
                        <div>
                          <p className="truncate text-sm font-semibold">{image.filename}</p>
                          <p className="text-xs text-stone-500">
                            {[image.slot, image.format, formatBytes(image.size)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex min-h-6 flex-wrap gap-1.5 text-[11px] font-semibold">
                          {config.headerImages[selectedSlot].desktop === image.url && (
                            <span className="rounded-full border border-[#2d3a21] px-2 py-1 text-[#2d3a21]">Valgt desktop</span>
                          )}
                          {config.headerImages[selectedSlot].mobile === image.url && (
                            <span className="rounded-full border border-[#2d3a21] px-2 py-1 text-[#2d3a21]">Valgt mobil</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applyImage(selectedSlot, "desktop", image)}
                            className="rounded-full bg-[#5d7342] px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Bruk desktop
                          </button>
                          <button
                            type="button"
                            onClick={() => applyImage(selectedSlot, "mobile", image)}
                            className="rounded-full border border-[#cbd3c2] px-3 py-1.5 text-xs font-semibold text-[#4d5d3e]"
                          >
                            Bruk mobil
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteImage(image)}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            Slett
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
