"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Luggage, PlusCircle, UserRound } from "lucide-react";
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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-teal-900/10 bg-[#FBF7F0]/95 backdrop-blur-md"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition",
                active
                  ? "text-teal-800"
                  : "text-stone-500 hover:text-stone-800"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition",
                  active ? "bg-teal-800 text-white shadow-md shadow-teal-900/20" : "bg-transparent"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
