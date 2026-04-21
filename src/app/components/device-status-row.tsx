interface DeviceStatusItem {
  iconSrc: string;
  label: string;
  spinning?: boolean;
}

interface DeviceStatusRowProps {
  items: DeviceStatusItem[];
  darkMode?: boolean;
}

export function DeviceStatusRow({ items, darkMode = false }: DeviceStatusRowProps) {
  const labelColor = darkMode ? "text-white/45" : "text-stone-500";

  return (
    <div className="mb-8 flex items-start justify-center gap-10 pt-2">
      {items.map((item) => (
        <div key={item.label} className="flex w-[92px] flex-col items-center gap-2 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center">
            <img
              src={item.iconSrc}
              alt={item.label}
              className={`max-h-full max-w-full object-contain ${item.spinning ? "animate-spin [animation-duration:2.4s]" : ""}`}
            />
          </div>
          <p className={`text-[10px] uppercase tracking-[0.02em] ${labelColor}`}>{item.label}</p>
        </div>
      ))}
    </div>
  );
}
