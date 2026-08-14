"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        window.location.assign("/login");
      }}
    >
      <LogOut className="h-4 w-4" />
      Abmelden
    </Button>
  );
}
