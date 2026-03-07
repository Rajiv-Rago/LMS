"use client";

import React, { forwardRef } from "react";

const variantStyles = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-400",
  secondary:
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost:
    "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  default: "px-4 py-2 text-sm",
} as const;

type ButtonVariant = keyof typeof variantStyles;
type ButtonSize = keyof typeof sizeStyles;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "default", className = "", ...props }, ref) => {
    const classes = [
      "rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
      variantStyles[variant],
      sizeStyles[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <button ref={ref} className={classes} {...props} />;
  }
);

Button.displayName = "Button";

export default Button;
