"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return <><span className="loot-link-feedback" data-pending={pending || undefined} aria-hidden="true" /><span className="loot-link-status" role="status">{pending ? "Abriendo…" : ""}</span></>;
}

/** Native Next links preserve prefetch, history, modifier clicks and accessibility. */
export function StorefrontLink({ children, className, transitionTypes = ["loot-forward"], ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} transitionTypes={transitionTypes} className={["loot-link", className].filter(Boolean).join(" ")}>{children}<NavigationFeedback /></Link>;
}
