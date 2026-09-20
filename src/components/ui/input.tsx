import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const inputClass = cn(
  "flex h-12 w-full rounded-[var(--r-md)] px-3.5 text-base text-foreground",
  "glass glass-thin backdrop-blur-xl",
  "placeholder:text-subtle",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClass, className)} {...props} />
));
Input.displayName = "Input";
