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
            Wizard, Vibe Input oder Template — alles landet in derselben
            Calculator Engine.
          </p>
        </div>
        <Link href="/join">
          <Button variant="outline">Beitreten</Button>
        </Link>
      </div>
      <Suspense>
        <CreateTripClient />
      </Suspense>
    </main>
  );
}
