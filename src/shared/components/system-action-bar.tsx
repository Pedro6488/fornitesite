import type { HTMLAttributes, ReactNode } from "react";

export function SystemActionBar({
  children,
  className = "",
  variant = "viewport",
  primaryFull = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "viewport" | "contained";
  /** Mobile transactional bar: summary first, one full-width primary action below. */
  primaryFull?: boolean;
}) {
  return (
    <div
      className={`system-action-bar system-action-bar-${variant} ${primaryFull ? "system-action-bar-primary-full" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
