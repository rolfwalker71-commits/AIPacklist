"use client";

import { useSearchParams } from "next/navigation";
import { StartFromRouteForm } from "@/components/app/start-from-route-form";

export function StartFromRouteFromQuery() {
  const params = useSearchParams();
  return <StartFromRouteForm initialCode={params.get("route") || ""} />;
}
