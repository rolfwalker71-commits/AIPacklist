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
  "mt-1.5 flex h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-base text-stone-900";
const labelClass = "block text-sm font-semibold tracking-wide text-stone-600";
const btnClass =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-800 text-base font-semibold text-white";

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
      <div className="card-surface w-full p-6">
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-eyebrow text-teal-800">FlexiPack</p>
            <p className="text-sm text-stone-500">Flexible Reise-Packlisten</p>
          </div>
        </div>
        <TravelMotif className="mb-4 h-20 w-full max-w-[220px] opacity-70" />

        {setup ? (
          <form action={setupAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <h1 className="font-display text-page-title text-stone-950">
                Admin einrichten
              </h1>
              <p className="mt-2 text-base text-stone-600">
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
            {error && <p className="text-base text-rose-700">{error}</p>}
            <button type="submit" className={btnClass}>
              Admin erstellen & starten
            </button>
          </form>
        ) : (
          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <h1 className="font-display text-page-title text-stone-950">
                Anmelden
              </h1>
              <p className="mt-2 text-base text-stone-600">
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
            {error && <p className="text-base text-rose-700">{error}</p>}
            <button type="submit" className={btnClass}>
              Anmelden
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
