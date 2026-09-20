import { BrandLogo } from "@/components/app/brand-logo";
import { TravelMotif } from "@/components/app/travel-motif";
import { needsSetup } from "@/lib/auth";
import { loginAction, setupAction } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Benutzername und Passwort nötig.",
  auth: "Anmeldung fehlgeschlagen.",
  server: "Serverfehler beim Login.",
};

export const dynamic = "force-dynamic";

const fieldClass =
  "glass glass-thin mt-1.5 flex h-12 w-full rounded-[var(--r-md)] px-3.5 text-base text-foreground backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass =
  "block text-sm font-semibold tracking-wide text-muted-foreground";
const btnClass =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(160deg,var(--teal-600),var(--teal-800))] text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_4px_14px_rgba(15,118,110,0.32)] transition active:scale-[0.97]";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next =
    sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const error = sp.error ? ERRORS[sp.error] || "Fehler" : null;
  const setup = await needsSetup();

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md items-center px-4 py-12">
      <div className="glass rounded-[var(--r-lg)] w-full p-6">
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-eyebrow text-primary">FlexiPack</p>
            <p className="text-sm text-muted-foreground">Flexible Reise-Packlisten</p>
          </div>
        </div>
        <TravelMotif className="mb-4 h-20 w-full max-w-[220px] opacity-70" />

        {setup ? (
          <form action={setupAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <h1 className="font-display text-page-title text-foreground">
                Admin einrichten
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Erstelle den ersten Admin-Account.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="name">
                Anzeigename
              </label>
              <input
                className={fieldClass}
                id="name"
                name="name"
                defaultValue="Admin"
                autoComplete="name"
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="username">
                Benutzername
              </label>
              <input
                className={fieldClass}
                id="username"
                name="username"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="password">
                Passwort
              </label>
              <input
                className={fieldClass}
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-base text-destructive">{error}</p>}
            <button type="submit" className={btnClass}>
              Admin erstellen & starten
            </button>
          </form>
        ) : (
          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <h1 className="font-display text-page-title text-foreground">
                Anmelden
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Nur angelegte Benutzerkonten haben Zugang.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="username">
                Benutzername
              </label>
              <input
                className={fieldClass}
                id="username"
                name="username"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="password">
                Passwort
              </label>
              <input
                className={fieldClass}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-base text-destructive">{error}</p>}
            <button type="submit" className={btnClass}>
              Anmelden
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
