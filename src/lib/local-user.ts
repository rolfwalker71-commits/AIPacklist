"use client";

import type { PackGender } from "./types";

const USER_KEY = "flexipack_user";

export interface LocalUser {
  id: string;
  name: string;
  color: string;
  gender: PackGender;
}

export function getLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalUser;
    return {
      ...parsed,
      gender: parsed.gender || "UNSPECIFIED",
    };
  } catch {
    return null;
  }
}

export function setLocalUser(user: LocalUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function ensureLocalUser(): LocalUser {
  const existing = getLocalUser();
  if (existing) return existing;
  const user: LocalUser = {
    id: crypto.randomUUID(),
    name: "Reisende:r",
    color: "#0F766E",
    gender: "UNSPECIFIED",
  };
  setLocalUser(user);
  return user;
}
