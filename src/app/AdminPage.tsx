import { useEffect, useMemo, useState } from "react";
import {
  defaultSiteConfig,
  deleteAdminImage,
  fetchAdminImages,
  fetchAdminSiteConfig,
  fetchLatestGreenhouseData,
  resolveGreenhouseAssetUrl,
  saveAdminSiteConfig,
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

export function AdminPage() {
  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [images, setImages] = useState<AdminImage[]>([]);
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<HeaderImageSlot>("normal");
  const [selectedFormat, setSelectedFormat] = useState<HeaderImageFormat>("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      const image = await uploadAdminImage(file, selectedSlot, selectedFormat);
      setImages((current) => [image, ...current.filter((item) => item.key !== image.key)]);
      setImage(selectedSlot, selectedFormat, image.url);
      setMessage("Bildet er lastet opp og valgt. Husk å lagre.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp bildet");
    } finally {
      setUploading(false);
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

  const selectedImages = images.filter((image) => image.slot === selectedSlot || image.slot === "general");

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
          </div>

          <div className="space-y-6">
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
                                {images.map((image) => (
                                  <option key={`${slot}-${format.key}-${image.key}`} value={image.url}>
                                    {image.filename}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setSelectedFormat(format.key);
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
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedSlot}
                    onChange={(event) => setSelectedSlot(event.target.value as HeaderImageSlot)}
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
                    onChange={(event) => setSelectedFormat(event.target.value as HeaderImageFormat)}
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
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={uploading}
                  onChange={(event) => void handleUpload(event.target.files?.[0])}
                  className="sr-only"
                />
              </label>

              {loading ? (
                <div className="rounded-lg bg-[#f7f8f5] p-5 text-sm text-stone-500">Laster bilder</div>
              ) : selectedImages.length === 0 ? (
                <div className="rounded-lg bg-[#f7f8f5] p-5 text-sm text-stone-500">Ingen bilder funnet for valgt område ennå.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedImages.map((image) => (
                    <article key={image.key} className="overflow-hidden rounded-lg border border-[#d8ded1] bg-[#f7f8f5]">
                      <div className="aspect-[3/1] bg-stone-200">
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setImage(selectedSlot, "desktop", image.url)}
                            className="rounded-full bg-[#5d7342] px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Bruk desktop
                          </button>
                          <button
                            type="button"
                            onClick={() => setImage(selectedSlot, "mobile", image.url)}
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
