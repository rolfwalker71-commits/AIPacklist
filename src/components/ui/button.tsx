import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Liquid Glass controls: capsule shaped, glass by default, tinted only
 * when the action is the one the screen is asking for.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-full",
    "text-base font-semibold leading-none whitespace-nowrap",
    "transition-[transform,box-shadow,background-color] duration-150",
    "active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
    "disabled:pointer-events-none disabled:opacity-45",
  ].join(" "),
  {
    variants: {
      variant: {
        /** The single most important action on the screen. */
        default:
          "text-white bg-[linear-gradient(160deg,var(--teal-600),var(--teal-800))] shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(0,0,0,0.12),0_4px_14px_rgba(15,118,110,0.32)]",
        /** Warm counterpart, for "keep going" style actions. */
        accent:
          "text-[#2a1a03] bg-[linear-gradient(160deg,#fcd34d,var(--amber-500))] shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_0_-1px_0_rgba(120,53,15,0.16),0_4px_14px_rgba(217,119,6,0.32)]",
        /** Everything else: a glass capsule. */
        secondary:
          "text-foreground glass glass-thick rounded-full backdrop-blur-xl",
        outline:
          "text-foreground glass glass-thin rounded-full backdrop-blur-xl",
        ghost:
          "text-primary bg-transparent hover:bg-[var(--glass-thin)]",
        danger:
          "text-white bg-[linear-gradient(160deg,#f43f5e,#be123c)] shadow-[inset_0_1px_0_rgba(255,255,255,0.30),0_4px_14px_rgba(190,18,60,0.30)]",
        destructive:
          "text-white bg-[linear-gradient(160deg,#f43f5e,#be123c)] shadow-[inset_0_1px_0_rgba(255,255,255,0.30),0_4px_14px_rgba(190,18,60,0.30)]",
      },
      size: {
        default: "h-12 px-5",
        sm: "h-10 px-3.5 text-sm",
        lg: "h-14 px-7 text-lg",
        icon: "h-11 w-11 px-0",
        "icon-sm": "h-9 w-9 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { buttonVariants };
