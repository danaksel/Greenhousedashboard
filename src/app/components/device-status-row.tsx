interface DeviceStatusItem {
  iconSrc: string;
  label: string;
  spinning?: boolean;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
}

interface DeviceStatusRowProps {
  items: DeviceStatusItem[];
  darkMode?: boolean;
}

export function DeviceStatusRow({ items, darkMode = false }: DeviceStatusRowProps) {
  const labelColor = darkMode ? "text-white/45" : "text-stone-500";
  const interactiveBorder = darkMode ? "border-white/15 hover:border-white/30" : "border-stone-300 hover:border-stone-400";
  const interactiveBg = darkMode ? "bg-white/[0.04] hover:bg-white/[0.08]" : "bg-white/40 hover:bg-white/70";
  const disabledClass = "cursor-not-allowed opacity-60";

  return (
    <div className="mb-8 flex items-start justify-center gap-7 pt-2">
      {items.map((item) => (
        item.onClick ? (
          <div key={item.label} className="flex w-[110px] flex-col items-center text-center">
            <button
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              className={`-mt-3 flex w-full flex-col items-center rounded-2xl border px-2 py-3 text-center transition-colors ${interactiveBorder} ${interactiveBg} ${item.disabled ? disabledClass : "cursor-pointer"}`}
              aria-label={item.label}
            >
              <div className="flex h-[72px] w-[72px] items-center justify-center">
                <img
                  src={item.iconSrc}
                  alt=""
                  className={`max-h-full max-w-full object-contain ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
                />
              </div>
              <p className={`mt-3 text-[10px] uppercase tracking-[0.02em] ${labelColor}`}>{item.label}</p>
            </button>
          </div>
        ) : (
          <div key={item.label} className="flex w-[110px] flex-col items-center gap-2 text-center">
            <div className="flex h-[72px] w-[72px] items-center justify-center">
              <img
                src={item.iconSrc}
                alt={item.label}
                className={`max-h-full max-w-full object-contain ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
              />
            </div>
            <p className={`text-[10px] uppercase tracking-[0.02em] ${labelColor}`}>{item.label}</p>
          </div>
        )
      ))}
    </div>
  );
}
