import type { ReactNode } from "react";

export type IllustrationKind =
  | "pack"
  | "route"
  | "bags"
  | "tips"
  | "team"
  | "dupes"
  | "wizard"
  | "join"
  | "bell"
  | "weather";

const GRADIENT: Record<IllustrationKind, [string, string]> = {
  pack: ["#2dd4bf", "#0f766e"],
  wizard: ["#2dd4bf", "#0f766e"],
  route: ["#38bdf8", "#0369a1"],
  join: ["#38bdf8", "#0369a1"],
  weather: ["#38bdf8", "#0369a1"],
  bags: ["#fbbf24", "#ea580c"],
  bell: ["#fbbf24", "#ea580c"],
  tips: ["#a78bfa", "#6d28d9"],
  team: ["#f472b6", "#be185d"],
  dupes: ["#818cf8", "#4338cc"],
};

export function illustrationTint(kind: IllustrationKind): string {
  return GRADIENT[kind][1];
}

const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

const SPARKLE = "M0 -10 L2.6 -2.6 L10 0 L2.6 2.6 L0 10 L-2.6 2.6 L-10 0 L-2.6 -2.6 Z";

function content(kind: IllustrationKind, tint: string): ReactNode {
  switch (kind) {
    case "pack":
      return (
        <g>
          {[0, 1, 2].map((i) => {
            const done = i < 2;
            const widths = [54, 38, 48];
            const y = 36 + i * 24;
            return (
              <g key={i}>
                <circle cx={36} cy={y} r={12} fill={done ? "#fff" : "rgba(255,255,255,.3)"} />
                {done && (
                  <path
                    d={`M${30} ${y} l4.5 4.5 l9 -9`}
                    transform="translate(-1 0)"
                    fill="none"
                    stroke={tint}
                    strokeWidth={3.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <rect x={54} y={y - 5} width={widths[i]} height={10} rx={5} fill={done ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.5)"} />
              </g>
            );
          })}
        </g>
      );
    case "route":
      return (
        <g>
          <path d="M26 88 C28 40 78 86 94 32" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={4} strokeLinecap="round" strokeDasharray="2 9" />
          <circle cx={26} cy={88} r={8} fill="#fff" />
          <circle cx={94} cy={30} r={12} fill="#fde047" stroke="#fff" strokeWidth={3} />
          <circle cx={94} cy={30} r={4} fill="#0369a1" />
          <g transform="translate(46 44) rotate(-35 12 12) scale(1.1)">
            <path d={PLANE} fill="#fff" />
          </g>
        </g>
      );
    case "bags":
      return (
        <g>
          <g transform="translate(24 34)">
            <rect x={4} y={0} width={14} height={8} rx={4} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth={3} />
            <rect x={0} y={6} width={22} height={30} rx={6} fill="rgba(255,255,255,.75)" />
          </g>
          <g transform="translate(52 22)">
            <rect x={8} y={0} width={18} height={10} rx={5} fill="none" stroke="#fff" strokeWidth={3.5} />
            <rect x={0} y={8} width={34} height={46} rx={9} fill="#fff" />
            <rect x={0} y={28} width={34} height={8} fill="#fbbf24" />
          </g>
          <rect x={23} y={88} width={74} height={10} rx={5} fill="rgba(255,255,255,.3)" />
          <rect x={23} y={88} width={52} height={10} rx={5} fill="#fde047" />
        </g>
      );
    case "tips":
      return (
        <g>
          <circle cx={60} cy={52} r={22} fill="#fde047" />
          <rect x={51} y={72} width={18} height={8} rx={3} fill="#fff" />
          <rect x={53} y={82} width={14} height={5} rx={2.5} fill="#fff" />
          <path d="M52 56 L60 46 L68 56" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
          <path d={SPARKLE} transform="translate(94 30) scale(.9)" fill="#fff" />
          <path d={SPARKLE} transform="translate(26 36) scale(.6)" fill="rgba(255,255,255,.85)" />
          <path d={SPARKLE} transform="translate(92 78) scale(.5)" fill="rgba(255,255,255,.75)" />
        </g>
      );
    case "team":
      return (
        <g>
          {[
            { x: 34, y: 66, c: "#0f766e", t: "R" },
            { x: 86, y: 66, c: "#1d4ed8", t: "V" },
            { x: 60, y: 40, c: "#b45309", t: "M" },
          ].map((p) => (
            <g key={p.t}>
              <circle cx={p.x} cy={p.y} r={26} fill={p.c} stroke="#fff" strokeWidth={3} />
              <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize={26} fontWeight={800} fill="#fff" fontFamily="system-ui, sans-serif">
                {p.t}
              </text>
            </g>
          ))}
          <circle cx={98} cy={98} r={12} fill="#fde047" stroke="#fff" strokeWidth={2} />
          <path d="M98 92 v12 M92 98 h12" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case "dupes":
      return (
        <g>
          <rect x={26} y={26} width={56} height={68} rx={14} fill="rgba(255,255,255,.45)" transform="rotate(-8 54 60)" />
          <rect x={44} y={34} width={56} height={68} rx={14} fill="#fff" transform="rotate(6 72 68)" />
          <circle cx={92} cy={94} r={15} fill="#16a34a" stroke="#fff" strokeWidth={3} />
          <path d="M85 94 l5 5 l9 -10" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "wizard":
      return (
        <g>
          <line x1={34} y1={90} x2={78} y2={46} stroke="#fff" strokeWidth={9} strokeLinecap="round" />
          <line x1={74} y1={50} x2={82} y2={42} stroke="#fde047" strokeWidth={9} strokeLinecap="round" />
          <path d={SPARKLE} transform="translate(86 30) scale(1.3)" fill="#fde047" />
          <path d={SPARKLE} transform="translate(98 62) scale(.6)" fill="#fff" />
          <path d={SPARKLE} transform="translate(52 34) scale(.5)" fill="rgba(255,255,255,.85)" />
        </g>
      );
    case "join":
      return (
        <g>
          <rect x={26} y={26} width={68} height={68} rx={14} fill="#fff" />
          {[
            [36, 36], [48, 36], [60, 36], [36, 48], [60, 48], [72, 48], [36, 60], [48, 60], [72, 60], [48, 72], [60, 72], [72, 72],
          ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={8} height={8} rx={2} fill={tint} />
          ))}
          <circle cx={92} cy={92} r={14} fill={tint} stroke="#fff" strokeWidth={3} />
          <path d="M92 85 v14 M85 92 h14" stroke="#fde047" strokeWidth={3.4} strokeLinecap="round" />
        </g>
      );
    case "bell":
      return (
        <g>
          <path
            d="M60 28 c-16 0 -26 12 -26 28 c0 20 -8 24 -12 30 h76 c-4 -6 -12 -10 -12 -30 c0 -16 -10 -28 -26 -28z"
            fill="#fff"
          />
          <path d="M50 92 a10 10 0 0 0 20 0z" fill="#fff" />
          <circle cx={84} cy={34} r={12} fill="#ef4444" stroke="#fff" strokeWidth={3} />
        </g>
      );
    case "weather":
      return (
        <g>
          <circle cx={78} cy={42} r={20} fill="#fde047" />
          <path
            d="M36 90 a16 16 0 0 1 2 -32 a22 22 0 0 1 42 6 a14 14 0 0 1 0 26z"
            fill="#fff"
          />
        </g>
      );
  }
}

/**
 * Drawn help illustration. `plain` skips the gradient tile so it can sit on a
 * coloured background (onboarding); the check marks then use the page colour.
 */
export function Illustration({
  kind,
  size = 64,
  plain = false,
  tint,
  className,
}: {
  kind: IllustrationKind;
  size?: number;
  plain?: boolean;
  tint?: string;
  className?: string;
}) {
  const [from, to] = GRADIENT[kind];
  const id = `ill-${kind}-${size}-${plain ? "p" : "t"}`;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden
      className={className}
      style={{ filter: plain ? undefined : `drop-shadow(0 4px 8px ${to}55)` }}
    >
      {!plain && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={from} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          <rect x={2} y={2} width={116} height={116} rx={34} fill={`url(#${id})`} />
          <rect x={2} y={2} width={116} height={116} rx={34} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={2} />
        </>
      )}
      {content(kind, tint ?? to)}
    </svg>
  );
}
