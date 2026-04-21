import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function iconProps(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function RefreshCwIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

export function WifiOffIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 20h.01" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5 13a10 10 0 0 1 10.8-1.9" />
      <path d="M2 8.8a16 16 0 0 1 19.2 0" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ArrowDownToLineIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function ArrowUpToLineIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 20V9" />
      <path d="m7.5 13.5 4.5-4.5 4.5 4.5" />
      <path d="M5 4h14" />
    </svg>
  );
}

export function AlertCircleIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 9.6 3.5 3.5 0 0 0 7 18Z" />
    </svg>
  );
}

export function CloudRainIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 6.6 3.5 3.5 0 0 0 7 15Z" />
      <path d="M9 18v2M13 18v2M17 18v2" />
    </svg>
  );
}

export function CloudDrizzleIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 6.6 3.5 3.5 0 0 0 7 15Z" />
      <path d="M10 18v1.5M14 19v1.5M18 18v1.5" />
    </svg>
  );
}

export function CloudSnowIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 6.6 3.5 3.5 0 0 0 7 15Z" />
      <path d="M9.5 18.5h.01M12.5 20h.01M15.5 18.5h.01" />
      <path d="M9.5 17.8v1.4M12.5 19.3v1.4M15.5 17.8v1.4" />
      <path d="M8.9 18.5h1.2M11.9 20h1.2M14.9 18.5h1.2" />
    </svg>
  );
}

export function CloudFogIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 5.6 3.5 3.5 0 0 0 7 14Z" />
      <path d="M5 18h14M7 21h10" />
    </svg>
  );
}

export function CloudLightningIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6.2 6.6 3.5 3.5 0 0 0 7 15Z" />
      <path d="m13 16-2 3h2l-2 3" />
    </svg>
  );
}

export function CloudyIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M9 17h8a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6-1.4A4 4 0 0 0 9 17Z" />
      <path d="M6.5 17H7" />
    </svg>
  );
}

export function SunriseIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 18h16" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <path d="M12 6v6" />
      <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
    </svg>
  );
}

export function SunsetIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 18h16" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <path d="M12 6v6" />
      <path d="m8.5 8.5 3.5 3.5 3.5-3.5" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
