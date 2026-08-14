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
      <div className="animate-rise relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 px-5 py-7 text-teal-50 shadow-lg">
        <TravelMotif className="absolute -right-4 top-2 h-28 w-48 opacity-40" />
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
            <BrandLogo className="h-9 w-9" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-100/80">
            Profil
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl">{user.name}</h1>
        <p className="mt-1 text-sm text-teal-100/90">@{user.username}</p>
      </div>

      <div className="mt-5 space-y-4 animate-rise" style={{ animationDelay: "0.06s" }}>
        <ProfileEditor
          initial={{
            name: user.name,
            gender: user.gender as "FEMALE" | "MALE" | "UNSPECIFIED",
            color: user.color,
            avatarUrl: user.avatarUrl,
          }}
        />

        <div className="grid gap-2">
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
