import { cn } from "@/lib/utils";

export type AvatarPerson = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
};

/** Overlapping member avatars with a ring so they read on any glass. */
export function AvatarStack({
  people,
  size = "sm",
  max = 4,
  className,
}: {
  people: AvatarPerson[];
  size?: "sm" | "md";
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const box = size === "md" ? "h-8 w-8 text-xs" : "h-7 w-7 text-[0.62rem]";

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      {shown.map((p, i) => (
        <span
          key={p.id}
          title={p.name}
          className={cn(
            "relative inline-flex items-center justify-center overflow-hidden rounded-full font-bold text-white",
            "ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]",
            box,
            i > 0 && "-ml-2"
          )}
          style={{ background: p.color }}
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            p.name.slice(0, 1).toUpperCase()
          )}
        </span>
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "relative -ml-2 inline-flex items-center justify-center rounded-full bg-[var(--teal-900)] font-bold text-white",
            "ring-2 ring-[rgba(255,255,255,0.65)] dark:ring-[rgba(255,255,255,0.14)]",
            box
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
