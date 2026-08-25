import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Mobile floating dock — inset, rounded-2xl, not a flush tab bar. */
export function FloatingDock({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
      aria-label={label}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around rounded-2xl border border-stone-200 bg-[#FBF7F0] px-1 py-1 shadow-[0_8px_24px_rgba(28,25,23,0.12)]">
        {children}
      </div>
    </nav>
  );
}

export function DockItem({
  active,
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs font-semibold transition",
        active ? "bg-muted text-teal-900" : "bg-transparent text-stone-500",
        props.className
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <span className="leading-none">{label}</span>
    </button>
  );
}

export function DockLink({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs font-semibold transition",
        active ? "bg-muted text-teal-900" : "bg-transparent text-stone-500"
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export function DesktopPills({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-10 min-h-10 items-stretch rounded-full bg-muted p-0.5">
      {children}
    </div>
  );
}

export function DesktopPill({
  active,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-full min-h-0 items-center gap-1.5 rounded-full px-3.5 py-0 text-sm font-semibold leading-none transition",
        active
          ? "bg-white text-teal-900 shadow-sm"
          : "bg-transparent text-stone-600 hover:text-stone-900",
        props.className
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
}
