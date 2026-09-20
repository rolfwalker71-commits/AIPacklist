import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Width of the desktop/iPad sidebar — pages offset their content by it. */
export const SIDEBAR_WIDTH = "17rem";

/* ============================================================
   Mobile: a floating glass tab bar. Content scrolls beneath it.
   ============================================================ */

export function FloatingDock({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 pad:hidden"
      style={{
        paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
      aria-label={label}
    >
      <div className="glass glass-thick glass-float mx-auto flex max-w-lg items-stretch gap-1 rounded-[26px] p-1.5 backdrop-blur-2xl">
        {children}
      </div>
    </nav>
  );
}

const dockItemClass = (active?: boolean) =>
  cn(
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] px-1 py-1.5",
    "text-[0.68rem] font-semibold leading-none transition active:scale-[0.96]",
    active
      ? "bg-[rgba(255,255,255,0.85)] text-[var(--teal-800)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_8px_rgba(11,61,57,0.12)] dark:bg-[rgba(255,255,255,0.14)] dark:text-[#7fe8da]"
      : "bg-transparent text-subtle"
  );

export function DockItem({
  active,
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(dockItemClass(active), className)}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <span className="mt-0.5">{label}</span>
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
      className={dockItemClass(active)}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <span className="mt-0.5">{label}</span>
    </Link>
  );
}

/* ============================================================
   iPad / desktop: a glass sidebar replacing the bottom bar.
   ============================================================ */

export function SideNav({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-y-0 left-0 z-40 hidden pad:flex pad:flex-col"
      style={{
        width: SIDEBAR_WIDTH,
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "0.5rem",
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {children}
      </div>
    </nav>
  );
}

export function SideSection({ children }: { children: ReactNode }) {
  return (
    <div className="px-3.5 pb-1.5 pt-4 text-eyebrow text-subtle">{children}</div>
  );
}

const sideLinkClass = (active?: boolean) =>
  cn(
    "flex min-h-11 items-center gap-3 rounded-[var(--r-md)] px-3.5 text-left",
    "text-[0.95rem] font-semibold transition active:scale-[0.98]",
    active
      ? "glass glass-thick text-[var(--teal-800)] backdrop-blur-xl dark:text-[#7fe8da]"
      : "bg-transparent text-muted-foreground hover:text-foreground"
  );

export function SideLink({
  href,
  active,
  icon,
  count,
  children,
}: {
  href: string;
  active?: boolean;
  icon?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={sideLinkClass(active)}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count != null && (
        <span className="shrink-0 text-sm font-bold text-subtle">{count}</span>
      )}
    </Link>
  );
}

export function SideButton({
  active,
  icon,
  count,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  count?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(sideLinkClass(active), "w-full", className)}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count != null && (
        <span className="shrink-0 text-sm font-bold text-subtle">{count}</span>
      )}
    </button>
  );
}

/* ============================================================
   Segmented pills — still used inside toolbars on wide screens.
   ============================================================ */

export function DesktopPills({ children }: { children: ReactNode }) {
  return (
    <div className="glass glass-thin inline-flex items-stretch gap-0.5 rounded-full p-1 backdrop-blur-xl">
      {children}
    </div>
  );
}

export function DesktopPill({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold leading-none transition",
        active
          ? "bg-[rgba(255,255,255,0.92)] text-[var(--teal-800)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(11,61,57,0.14)] dark:bg-[rgba(255,255,255,0.16)] dark:text-[#eafffb]"
          : "bg-transparent text-muted-foreground hover:text-foreground",
        className
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
}
