"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  categoryOptions,
  suggestCategory,
} from "@/lib/categorize";

type Member = {
  user: { id: string; name: string };
};

type CreatedItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isShared: boolean;
  notes: string | null;
  priority?: string;
  suitcaseId: string | null;
  packedAt: string | null;
  packedBy?: unknown;
  suitcase?: unknown;
  source?: string;
};

const CUSTOM = "__custom__";
const AUTO = "__auto__";

export function AddPackItemForm({
  tripId,
  members,
  existingCategories,
  defaultAssigneeUserId,
  onCreated,
}: {
  tripId: string;
  members: Member[];
  existingCategories: string[];
  defaultAssigneeUserId?: string;
  onCreated: (item: CreatedItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [assignee, setAssignee] = useState<string>(
    defaultAssigneeUserId ||
      (members.length === 1 ? members[0].user.id : "shared")
  );
  const [categoryChoice, setCategoryChoice] = useState(AUTO);
  const [customCategory, setCustomCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggested = useMemo(() => suggestCategory(name), [name]);
  const categories = useMemo(
    () => categoryOptions(existingCategories),
    [existingCategories]
  );

  const reset = () => {
    setName("");
    setQuantity("1");
    setCategoryChoice(AUTO);
    setCustomCategory("");
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Bitte Text / Bezeichnung eingeben.");
      return;
    }

    let category: string;
    let categoryMode: string | undefined;
    if (categoryChoice === AUTO) {
      category = suggested;
      categoryMode = "auto";
    } else if (categoryChoice === CUSTOM) {
      category = customCategory.trim().slice(0, 40);
      if (!category) {
        setError("Eigene Kategorie eingeben oder eine bestehende wählen.");
        return;
      }
    } else {
      category = categoryChoice;
    }

    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: trimmed,
        quantity: Number(quantity) || 1,
        category,
        categoryMode,
      };
      if (assignee === "shared") {
        body.assignee = "shared";
        body.isShared = true;
      } else {
        body.assigneeUserId = assignee;
        body.isShared = false;
      }

      const res = await fetch(`/api/trips/${tripId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen");
      onCreated(data);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Position hinzufügen
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-teal-200/80 bg-white/90 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800">
            Neue Position
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Koffer später zuweisen. Kategorie wird aus dem Text vorgeschlagen.
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Schliessen
        </button>
      </div>

      <div>
        <Label htmlFor="pack-item-name">Text</Label>
        <Input
          id="pack-item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Reisestecker UK"
          autoFocus
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pack-item-assignee">Zugewiesen an</Label>
          <select
            id="pack-item-assignee"
            className="mt-1.5 flex h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="shared">Gemeinsam</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="pack-item-qty">Menge</Label>
          <Input
            id="pack-item-qty"
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="pack-item-category">Kategorie</Label>
        <select
          id="pack-item-category"
          className="mt-1.5 flex h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
          value={categoryChoice}
          onChange={(e) => setCategoryChoice(e.target.value)}
        >
          <option value={AUTO}>
            Automatisch — {suggested}
            {name.trim() ? "" : " (nach Eingabe)"}
          </option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={CUSTOM}>Eigene Kategorie…</option>
        </select>
        {categoryChoice === CUSTOM && (
          <Input
            className="mt-2"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="z.B. Baby / Camping"
            maxLength={40}
          />
        )}
        {categoryChoice === AUTO && name.trim() && (
          <p className="mt-1.5 text-xs text-stone-500">
            Vorschlag aus Regeln: <strong>{suggested}</strong>
          </p>
        )}
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Speichern…" : "Hinzufügen"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
