"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Luggage, PlusCircle, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import {
  DesktopPills,
  DockLink,
  FloatingDock,
} from "@/components/app/floating-dock";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Reisen", icon: Luggage, match: (p: string) => p === "/" },
  {
    href: "/create",
    label: "Neu",
    icon: PlusCircle,
    match: (p: string) => p.startsWith("/create"),
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

export function AppBottomNav() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/trip/") || pathname.startsWith("/login")) {
    return null;
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 hidden border-b border-stone-200 bg-[#FBF7F0] lg:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo className="h-8 w-8" />
            <span className="font-display text-lg text-stone-950">
              FlexiPack
            </span>
          </Link>
          <DesktopPills>
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-full min-h-0 items-center gap-1.5 rounded-full px-3.5 py-0 text-sm font-semibold leading-none",
                    active
                      ? "bg-white text-teal-900 shadow-sm"
                      : "bg-transparent text-stone-600 hover:text-stone-900"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </DesktopPills>
        </div>
      </header>

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
