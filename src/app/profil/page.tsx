import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { TravelMotif } from "@/components/app/travel-motif";
import { BrandLogo } from "@/components/app/brand-logo";
import { ProfileEditor } from "@/components/app/profile-editor";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-lg px-4 pb-8 pt-8">
      <div className="hero-panel animate-rise px-5 py-7">
        <TravelMotif className="absolute -right-4 top-2 h-32 w-52 opacity-40" />
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <BrandLogo className="h-10 w-10" />
          </span>
          <p className="text-eyebrow text-teal-100/80">Profil</p>
        </div>
        <h1 className="mt-3 font-display text-page-title">{user.name}</h1>
        <p className="mt-1 text-base text-teal-100/90">@{user.username}</p>
      </div>

      <div
        className="mt-5 space-y-4 animate-rise"
        style={{ animationDelay: "0.06s" }}
      >
        <div className="card-surface p-4">
          <ProfileEditor
            initial={{
              name: user.name,
              gender: user.gender as "FEMALE" | "MALE" | "UNSPECIFIED",
              color: user.color,
              avatarUrl: user.avatarUrl,
            }}
          />
        </div>

        <div className="grid gap-2.5">
          {user.role === "ADMIN" && (
            <Link href="/admin/users">
              <Button className="w-full" variant="secondary">
                Benutzerverwaltung
              </Button>
            </Link>
          )}
          <Link href="/settings">
            <Button className="w-full" variant="outline">
              KI-Einstellungen
            </Button>
          </Link>
          <Link href="/join">
            <Button className="w-full" variant="outline">
              Reise beitreten
            </Button>
          </Link>
          <div className="pt-1">
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
