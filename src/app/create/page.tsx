import Link from "next/link";
import { Suspense } from "react";
import { CreateTripClient } from "@/components/wizard/create-trip-client";
import { Button } from "@/components/ui/button";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-8 pt-6 md:max-w-3xl">
      <div className="mb-6">
        <Link href="/" className="text-sm font-semibold text-teal-800">
          ← Reisen
        </Link>
        <h1 className="mt-2 font-display text-3xl text-stone-950">
          Neue Reise
        </h1>
        <p className="mt-1 text-sm text-stone-600">
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
      <Suspense>
        <CreateTripClient />
      </Suspense>
    </main>
  );
}
