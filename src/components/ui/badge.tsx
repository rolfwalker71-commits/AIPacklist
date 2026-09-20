import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide",
  {
    variants: {
      variant: {
        default:
          "text-white bg-[linear-gradient(160deg,var(--teal-600),var(--teal-800))] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_0_0_1px_var(--edge)]",
        outline: "text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge)]",
        muted:
          "bg-[var(--glass-thick)] text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge)]",
        warning:
          "bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_rgba(180,83,9,0.22)]",
        info: "bg-secondary text-secondary-foreground shadow-[inset_0_0_0_1px_var(--edge)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
