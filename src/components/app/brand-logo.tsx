"use client";

export function BrandLogo({
  className = "h-9 w-9",
  title = "FlexiPack",
}: {
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt={title} className={className} />
  );
}
