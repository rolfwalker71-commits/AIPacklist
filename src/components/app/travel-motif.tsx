/** Decorative travel motif — luggage + route arc for empty/hero states */
export function TravelMotif({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M20 140 C80 40, 160 40, 220 90 S 300 150, 310 110"
        stroke="#0F766E"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="6 8"
        opacity="0.35"
      />
      <circle cx="48" cy="118" r="7" fill="#B45309" />
      <circle cx="168" cy="72" r="6" fill="#0F766E" />
      <circle cx="278" cy="118" r="7" fill="#1D4ED8" />
      <rect
        x="118"
        y="88"
        width="72"
        height="52"
        rx="10"
        fill="#0F766E"
        opacity="0.92"
      />
      <rect x="140" y="78" width="28" height="12" rx="4" fill="#134E4A" />
      <rect x="130" y="102" width="48" height="8" rx="2" fill="#CCFBF1" opacity="0.5" />
      <circle cx="132" cy="144" r="8" fill="#1C1917" />
      <circle cx="176" cy="144" r="8" fill="#1C1917" />
      <path
        d="M210 55 c12-18 36-18 48 0"
        stroke="#B45309"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="234" cy="42" r="10" fill="#FBBF24" opacity="0.85" />
    </svg>
  );
}

export function SuitcaseMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <rect x="12" y="20" width="40" height="30" rx="6" fill="#0F766E" />
      <rect x="24" y="14" width="16" height="8" rx="2" fill="#134E4A" />
      <rect x="20" y="30" width="24" height="5" rx="1.5" fill="#99F6E4" opacity="0.55" />
      <circle cx="22" cy="52" r="4" fill="#1C1917" />
      <circle cx="42" cy="52" r="4" fill="#1C1917" />
    </svg>
  );
}

/** Compact suitcase for bag overview cards */
export function SuitcaseCardArt({
  className = "",
  accent = "#0F766E",
}: {
  className?: string;
  accent?: string;
}) {
  return (
    <svg viewBox="0 0 120 88" className={className} aria-hidden fill="none">
      <path
        d="M8 70 C28 40, 52 34, 78 48 S 108 72, 114 58"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 6"
        opacity="0.35"
      />
      <rect x="28" y="28" width="56" height="40" rx="8" fill={accent} />
      <rect x="46" y="20" width="20" height="10" rx="3" fill="#134E4A" />
      <rect
        x="38"
        y="40"
        width="36"
        height="6"
        rx="2"
        fill="#CCFBF1"
        opacity="0.55"
      />
      <circle cx="40" cy="72" r="5" fill="#1C1917" />
      <circle cx="72" cy="72" r="5" fill="#1C1917" />
      <circle cx="96" cy="24" r="8" fill="#FBBF24" opacity="0.85" />
    </svg>
  );
}

export function ChecklistMotif({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 88" className={className} aria-hidden fill="none">
      <rect x="22" y="14" width="76" height="60" rx="10" fill="#FFF" stroke="#D6D3D1" />
      <rect x="34" y="28" width="10" height="10" rx="3" fill="#0F766E" />
      <path d="M36 33 l3 3 5-6" stroke="#FFF" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="50" y="30" width="36" height="5" rx="2" fill="#D6D3D1" />
      <rect x="34" y="46" width="10" height="10" rx="3" fill="#CCFBF1" stroke="#0F766E" />
      <rect x="50" y="48" width="30" height="5" rx="2" fill="#E7E5E4" />
      <circle cx="98" cy="22" r="7" fill="#B45309" opacity="0.8" />
    </svg>
  );
}
