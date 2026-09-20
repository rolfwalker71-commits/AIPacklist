"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Luggage, PlusCircle, Sparkles, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import {
  DockLink,
  FloatingDock,
  SideLink,
  SideNav,
  SideSection,
} from "@/components/app/floating-dock";

const items = [
  { href: "/", label: "Reisen", icon: Luggage, match: (p: string) => p === "/" },
  {
    href: "/create",
    label: "Neu",
    icon: PlusCircle,
    match: (p: string) => p.startsWith("/create"),
  },
  {
    href: "/tipps",
    label: "Tipps",
    icon: Sparkles,
    match: (p: string) => p.startsWith("/tipps"),
  },
  {
    href: "/profil",
    label: "Profil",
    icon: UserRound,
    match: (p: string) =>
      p.startsWith("/profil") ||
      p.startsWith("/settings") ||
      p.startsWith("/admin"),
  },
] as const;

/**
 * App-level navigation. Phone gets a floating glass dock at the bottom,
 * iPad and desktop get a glass sidebar. Trip pages bring their own —
 * see TripWorkspace — so this renders nothing there.
 */
export function AppBottomNav() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/trip/") || pathname.startsWith("/login")) {
    return null;
  }

  return (
    <>
      <SideNav label="Hauptnavigation">
        <Link
          href="/"
          className="mb-3 flex items-center gap-3 rounded-[var(--r-md)] px-3.5 py-2"
        >
          <span className="glass glass-thick flex h-10 w-10 items-center justify-center rounded-full">
            <BrandLogo className="h-7 w-7" />
          </span>
          <span className="font-display text-card-title text-foreground">
            FlexiPack
          </span>
        </Link>

        <SideSection>Navigation</SideSection>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <SideLink
              key={item.href}
              href={item.href}
              active={item.match(pathname)}
              icon={<Icon className="size-5 shrink-0" />}
            >
              {item.label}
            </SideLink>
          );
        })}
      </SideNav>

      <FloatingDock label="Hauptnavigation">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DockLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={item.match(pathname)}
            >
              <Icon className="h-5 w-5" />
            </DockLink>
          );
        })}
      </FloatingDock>
    </>
  );
}
