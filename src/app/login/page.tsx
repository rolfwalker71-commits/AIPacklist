import { BrandLogo } from "@/components/app/brand-logo";
import { needsSetup } from "@/lib/auth";
import { loginAction, setupAction } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Benutzername und Passwort nötig.",
  auth: "Anmeldung fehlgeschlagen.",
  server: "Serverfehler beim Login.",
};

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1.5 flex h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900";
const labelClass =
  "block text-xs font-semibold uppercase tracking-wide text-stone-500";
const btnClass =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-teal-800 text-sm font-semibold text-white";

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
      <div className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <BrandLogo className="h-11 w-11 shrink-0" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
            FlexiPack
          </p>
        </div>

        {setup ? (
          <form action={setupAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <h1 className="font-display text-3xl text-stone-950">
                Admin einrichten
              </h1>
              <p className="mt-2 text-sm text-stone-600">
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
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <button type="submit" className={btnClass}>
              Admin erstellen & starten
            </button>
          </form>
        ) : (
          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <h1 className="font-display text-3xl text-stone-950">Anmelden</h1>
              <p className="mt-2 text-sm text-stone-600">
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
                placeholder="z.B. rolf"
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
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <button type="submit" className={btnClass}>
              Anmelden
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
