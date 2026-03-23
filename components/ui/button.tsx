import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "uiButton",
        variant === "outline" && "uiButtonOutline",
        variant === "ghost" && "uiButtonGhost",
        size === "sm" && "uiButtonSm",
        className
      )}
      {...props}
    />
  );
}
