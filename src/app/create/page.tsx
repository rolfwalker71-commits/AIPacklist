import Link from "next/link";
import { Suspense } from "react";
import { CreateTripClient } from "@/components/wizard/create-trip-client";
import { ChecklistMotif } from "@/components/app/travel-motif";
import { Button } from "@/components/ui/button";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-8 pt-6 md:max-w-3xl">
      <div className="mb-6">
        <Link href="/" className="text-base font-semibold text-teal-800">
          ← Reisen
        </Link>
        <div className="card-surface mt-3 flex items-start gap-4 p-4">
          <ChecklistMotif className="mt-1 h-20 w-28 shrink-0" />
          <div>
            <h1 className="font-display text-page-title text-stone-950">
              Neue Reise
            </h1>
            <p className="mt-1 text-base text-stone-600">
              Assistent, KI-Freitext oder Vorlage — gleiche Mengenlogik.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/join">
                <Button variant="outline" size="sm">
                  Beitreten
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm">
                  KI
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Suspense>
        <CreateTripClient />
      </Suspense>
    </main>
  );
}
