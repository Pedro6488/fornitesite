/**
 * Control de cuota de FN Shop. Función pura: recibe el consumo y decide si una
 * llamada puede salir. El plan Basic trae 5,000 requests por periodo.
 *
 *  - 70 %: solo avisa.
 *  - 85 %: los IDs nuevos dejan de validarse con FN Shop y pasan a revisión manual.
 *  - 95 %: solo se permite entregar (gift_check, gift_send) y conciliar (order_history).
 *  - Tope diario: igual que el 95 % por el resto del día.
 */
export type FnShopAction =
  | "verify_license" | "friend_add" | "friend_status" | "gift_check" | "gift_send"
  | "order_history" | "shop" | "groups_status";

export const DELIVERY_ACTIONS: readonly FnShopAction[] = ["gift_check", "gift_send", "order_history"];
export const FREE_ACTIONS: readonly FnShopAction[] = ["verify_license"];

export type FnShopUsage = Readonly<{ used: number; today: number }>;
export type FnShopLimits = Readonly<{ monthlyLimit: number; dailyLimit: number }>;
export type BudgetLevel = "ok" | "warning" | "reserve" | "critical" | "exhausted";

export type BudgetDecision = Readonly<{ allowed: boolean; level: BudgetLevel; reason: string | null }>;

export function budgetLevel(usage: FnShopUsage, limits: FnShopLimits): BudgetLevel {
  const ratio = limits.monthlyLimit > 0 ? usage.used / limits.monthlyLimit : 1;
  if (ratio >= 1) return "exhausted";
  if (ratio >= 0.95) return "critical";
  if (ratio >= 0.85) return "reserve";
  if (ratio >= 0.7) return "warning";
  return "ok";
}

export function budgetDecision(action: FnShopAction, usage: FnShopUsage, limits: FnShopLimits): BudgetDecision {
  const level = budgetLevel(usage, limits);
  if (FREE_ACTIONS.includes(action)) return { allowed: true, level, reason: null };
  if (level === "exhausted") return { allowed: false, level, reason: "Se agotaron los requests del periodo." };
  const delivery = DELIVERY_ACTIONS.includes(action);
  if (level === "critical" && !delivery) return { allowed: false, level, reason: "Cuota al 95 %: solo se permite entregar y conciliar." };
  if (limits.dailyLimit > 0 && usage.today >= limits.dailyLimit && !delivery) {
    return { allowed: false, level, reason: `Se alcanzó el tope diario de ${limits.dailyLimit} requests: solo se permite entregar y conciliar.` };
  }
  if (level === "reserve" && action === "friend_add") return { allowed: false, level, reason: "Cuota al 85 %: los IDs nuevos pasan a revisión manual." };
  return { allowed: true, level, reason: null };
}

/** Umbrales que una llamada acaba de cruzar, para avisar una sola vez a Telegram. */
export function crossedThresholds(before: number, after: number, monthlyLimit: number): readonly number[] {
  if (monthlyLimit <= 0) return [];
  return [70, 85, 95, 100].filter((percent) => before < (monthlyLimit * percent) / 100 && after >= (monthlyLimit * percent) / 100);
}
