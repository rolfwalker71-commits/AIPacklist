"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { de } from "date-fns/locale";
import {
  format,
  formatISO,
  isValid,
  parse,
  parseISO,
  startOfDay,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

const DISPLAY = "dd.MM.yyyy";

function toIsoDate(d: Date): string {
  return formatISO(startOfDay(d), { representation: "date" });
}

function fromIso(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? startOfDay(d) : undefined;
}

function parseDisplay(text: string): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const d = parse(trimmed, DISPLAY, new Date());
  return isValid(d) ? startOfDay(d) : undefined;
}

interface DatePickerProps {
  value?: string; // ISO yyyy-MM-dd
  onChange: (isoDate: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  allowEmpty?: boolean;
  min?: string;
  max?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "TT.MM.JJJJ",
  className,
  id,
  allowEmpty = false,
  min,
  max,
}: DatePickerProps) {
  const autoId = useId();
  const inputId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => fromIso(value), [value]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(
    selected ? format(selected, DISPLAY) : ""
  );

  useEffect(() => {
    setText(selected ? format(selected, DISPLAY) : "");
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commitText = () => {
    if (!text.trim()) {
      if (allowEmpty) onChange("");
      else if (selected) setText(format(selected, DISPLAY));
      return;
    }
    const parsed = parseDisplay(text);
    if (!parsed) {
      setText(selected ? format(selected, DISPLAY) : "");
      return;
    }
    onChange(toIsoDate(parsed));
    setText(format(parsed, DISPLAY));
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="flex h-11 items-center rounded-xl border border-stone-300 bg-white/80 focus-within:ring-2 focus-within:ring-teal-700/30">
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
              setOpen(false);
            }
          }}
          className="h-full w-full rounded-xl bg-transparent px-3 text-sm text-stone-900 outline-none placeholder:text-stone-400"
          aria-label="Datum (TT.MM.JJJJ)"
        />
        <button
          type="button"
          className="mr-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-teal-800 hover:bg-teal-50"
          onClick={() => setOpen((v) => !v)}
          aria-label="Kalender öffnen"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="single"
            locale={de}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected || fromIso(min) || new Date()}
            disabled={[
              ...(fromIso(min) ? [{ before: fromIso(min)! }] : []),
              ...(fromIso(max) ? [{ after: fromIso(max)! }] : []),
            ]}
            onSelect={(day) => {
              if (!day) {
                if (allowEmpty) onChange("");
                return;
              }
              onChange(toIsoDate(day));
              setText(format(day, DISPLAY));
              setOpen(false);
            }}
            className="rdp-flexipack"
          />
        </div>
      )}
    </div>
  );
}
