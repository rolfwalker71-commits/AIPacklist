"use client";

import { packItemImageSrc } from "@/lib/item-illustrations";
import { cn } from "@/lib/utils";

type ItemIllustrationProps = {
  name: string;
  category?: string | null;
  photoUrl?: string | null;
  className?: string;
  label?: string;
};

export function ItemIllustration({
  name,
  category,
  photoUrl,
  className,
  label,
}: ItemIllustrationProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={packItemImageSrc(name, category, photoUrl)}
      alt={label ?? ""}
      width={88}
      height={88}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
