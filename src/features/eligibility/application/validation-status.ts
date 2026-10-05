import type { DeliveryAgent, FriendshipState } from "../domain/delivery-agent";

export type RecipientValidationStatus = "pending_friendship" | "waiting" | "ready" | "blocked";

export function validationStatus(agents: readonly DeliveryAgent[]): {
  status: RecipientValidationStatus;
  giftableAt: string | null;
} {
  if (agents.some((agent) => agent.healthy && agent.friendship === "ready")) return { status: "ready", giftableAt: null };
  const waits = agents.filter((agent) => agent.friendship === "waiting").map((agent) => agent.giftableAt).filter((value): value is string => Boolean(value));
  if (agents.some((agent) => agent.friendship === "waiting")) {
    return { status: "waiting", giftableAt: waits.toSorted()[0] ?? null };
  }
  if (agents.some((agent) => agent.friendship === "not_added" || agent.friendship === "pending")) {
    return { status: "pending_friendship", giftableAt: null };
  }
  return { status: "blocked", giftableAt: null };
}

export function normalizeFriendship(value: unknown): FriendshipState {
  return value === "pending" || value === "waiting" || value === "ready" || value === "blocked" ? value : "not_added";
}
