interface GreenhouseIconProps {
  className?: string;
}

export function GreenhouseIcon({ className = "w-8 h-8" }: GreenhouseIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main greenhouse structure */}
      <path
        d="M12 3L4 9V21H20V9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Roof panels */}
      <path
        d="M12 3L12 21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4 13H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Door */}
      <path
        d="M10 15H14V21H10V15Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Door handle */}
      <circle
        cx="13"
        cy="18"
        r="0.5"
        fill="currentColor"
      />
    </svg>
  );
}