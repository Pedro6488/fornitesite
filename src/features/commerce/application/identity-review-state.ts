export type IdentityValidationStatus = "pending_friendship" | "manual_review" | "waiting" | "ready" | "blocked";

export function isIdentityReviewPending(status: IdentityValidationStatus): boolean {
  return status === "manual_review" || status === "pending_friendship" || status === "waiting";
}

export function nextManualValidationStatus(existingStatus: IdentityValidationStatus | undefined): IdentityValidationStatus {
  if (existingStatus === "ready" || existingStatus === "waiting" || existingStatus === "blocked") return existingStatus;
  return "manual_review";
}
