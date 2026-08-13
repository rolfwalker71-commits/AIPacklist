import Link from "next/link";
import { Suspense } from "react";
import { CreateTripClient } from "@/components/wizard/create-trip-client";
import { Button } from "@/components/ui/button";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm font-semibold text-teal-800">
            ← FlexiPack
          </Link>
          <h1 className="mt-2 font-display text-3xl text-stone-950 md:text-4xl">
            Neue Packliste
          </h1>
          <p className="mt-1 text-stone-600">
            Assistent, KI-Freitext oder Vorlage — alles landet in derselben
            Mengenberechnung.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings">
            <Button variant="outline">KI-Einstellungen</Button>
          </Link>
          <Link href="/join">
            <Button variant="outline">Beitreten</Button>
          </Link>
        </div>
      </div>
      <Suspense>
        <CreateTripClient />
      </Suspense>
    </main>
  );
}
