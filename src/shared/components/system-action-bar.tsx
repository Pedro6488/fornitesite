import type { HTMLAttributes, ReactNode } from "react";

export function SystemActionBar({
  children,
  className = "",
  variant = "viewport",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "viewport" | "contained";
}) {
  return (
    <div
      className={`system-action-bar system-action-bar-${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
