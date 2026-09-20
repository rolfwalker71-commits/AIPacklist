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
    statusBarStyle: "black-translucent",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1413" },
  ],
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

  // Trip pages carry their own sidebar and dock, so they own their insets.
  const shellPad = isLogin || isTrip ? "" : "pb-28 pad:pb-8 pad:pl-[17rem]";

  return (
    <html lang="de-CH" className={`${outfit.variable} ${outfit.className}`}>
      <body className="font-sans antialiased">
        {/* The backdrop every glass surface refracts. */}
        <div className="ambient-canvas" aria-hidden />

        <div className={`app-shell min-h-[100dvh] ${shellPad}`}>
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
