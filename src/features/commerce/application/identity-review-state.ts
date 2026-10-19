export type IdentityValidationStatus = "pending_friendship" | "manual_review" | "waiting" | "ready" | "blocked";

export function isIdentityReviewPending(status: IdentityValidationStatus): boolean {
  return status === "manual_review" || status === "pending_friendship" || status === "waiting";
}

export function nextManualValidationStatus(existingStatus: IdentityValidationStatus | undefined): IdentityValidationStatus {
  if (existingStatus === "ready" || existingStatus === "waiting" || existingStatus === "blocked") return existingStatus;
  return "manual_review";
}

type KnownRecipientValidation = Readonly<{ status: IdentityValidationStatus; giftable_at: string | null }>;

// Friendship with our gift accounts belongs to the recipient, not to the
// browser session. A gamertag already reviewed in another session keeps that
// decision instead of returning to the manual review queue.
export function inheritManualValidation(
  knownValidations: readonly KnownRecipientValidation[],
): { status: IdentityValidationStatus; giftable_at: string | null } {
  if (knownValidations.some((validation) => validation.status === "blocked")) return { status: "blocked", giftable_at: null };
  if (knownValidations.some((validation) => validation.status === "ready")) return { status: "ready", giftable_at: null };
  const waits = knownValidations
    .filter((validation) => validation.status === "waiting" && validation.giftable_at)
    .map((validation) => validation.giftable_at!)
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  if (waits[0]) return { status: "waiting", giftable_at: waits[0] };
  return { status: "manual_review", giftable_at: null };
}

const recipientStatusRank: Record<IdentityValidationStatus, number> = {
  pending_friendship: 1, manual_review: 2, waiting: 3, ready: 4, blocked: 5,
};

type RecipientReview = Readonly<{
  epic_account_id: string; status: IdentityValidationStatus; last_checked_at: string; orders: readonly unknown[];
}>;

// The admin queue shows one card per gamertag. The representative row is the
// strongest decision; database triggers keep the remaining sessions in sync.
export function groupReviewsByRecipient<T extends RecipientReview>(reviews: readonly T[]): (T & { session_count: number })[] {
  const groups = new Map<string, T[]>();
  for (const review of reviews) groups.set(review.epic_account_id, [...(groups.get(review.epic_account_id) ?? []), review]);
  return [...groups.values()].map((group) => {
    const [representative] = [...group].sort((left, right) =>
      recipientStatusRank[right.status] - recipientStatusRank[left.status]
        || Date.parse(right.last_checked_at) - Date.parse(left.last_checked_at));
    return { ...representative, orders: group.flatMap((review) => review.orders), session_count: group.length };
  });
}
