import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AppBottomNav } from "@/components/app/app-bottom-nav";
import { AppShellScripts } from "@/components/app/app-shell-scripts";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlexiPack — Flexible Reise-Packlisten",
  description:
    "App für Mehr-Etappen-Reisen, Paare und Gruppen. Dynamische Mengen, gemeinsame Einträge, Koffer-Aufteilung.",
  applicationName: "FlexiPack",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlexiPack",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F766E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") || "";
  const isLogin = pathname === "/login" || pathname.startsWith("/login?");
  const isTrip = pathname.startsWith("/trip/");
  const shellPad = isLogin
    ? ""
    : isTrip
      ? ""
      : "pb-28 lg:pb-8 lg:pt-20";

  return (
    <html
      lang="de-CH"
      className={`${outfit.variable} ${outfit.className}`}
    >
      <body className="font-sans antialiased">
        <div className={`app-shell min-h-screen ${shellPad}`}>
          {!isLogin && (
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-teal-400/25 blur-3xl" />
              <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />
              <div className="absolute bottom-10 left-1/4 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(28,25,23,0.05)_1px,transparent_0)] bg-[size:20px_20px]" />
            </div>
          )}
          {children}
          {!isLogin && (
            <Suspense fallback={null}>
              <AppBottomNav />
            </Suspense>
          )}
        </div>
        {!isLogin && <AppShellScripts />}
      </body>
    </html>
  );
}
