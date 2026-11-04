import { ViewTransition, type ReactNode } from "react";

/** Each page owns its boundary; persistent layouts must not animate on navigation. */
export function StorefrontTransition({ children }: { children: ReactNode }) {
  return <ViewTransition default="none"
    enter={{ "loot-forward": "loot-forward", "loot-back": "loot-back", "loot-switch": "loot-fade", default: "loot-fade" }}
    exit={{ "loot-forward": "loot-forward", "loot-back": "loot-back", "loot-switch": "loot-fade", default: "loot-fade" }}>
    <div className="storefront-view">{children}</div>
  </ViewTransition>;
}
