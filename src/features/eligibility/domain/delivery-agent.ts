export type FriendshipState = "not_added" | "pending" | "waiting" | "ready" | "blocked";

export type DeliveryAgent = Readonly<{
  id: string;
  publicAlias: string;
  vbucksBalance: number;
  giftsUsed: number;
  giftsLimit: number;
  friendship: FriendshipState;
  giftableAt: string | null;
  healthy: boolean;
}>;

export type AgentEvaluation = Readonly<{
  agent: DeliveryAgent;
  available: boolean;
  reason: string;
}>;

export interface AgentProvider {
  resolveAccount(displayName: string, platform?: string): Promise<{ epicAccountId: string; displayName: string }>;
  listForReceiver(epicAccountId: string): Promise<readonly DeliveryAgent[]>;
  addFriend(epicAccountId: string): Promise<{ requested: number; alreadyFriends: number }>;
}

export function evaluateAgent(agent: DeliveryAgent, requiredVbucks: number): AgentEvaluation {
  if (!agent.healthy) return { agent, available: false, reason: "Agente temporalmente fuera de servicio" };
  if (agent.friendship === "pending") return { agent, available: false, reason: "Acepta la solicitud dentro de Fortnite" };
  if (agent.friendship === "waiting") {
    return { agent, available: false, reason: agent.giftableAt ? `Disponible ${formatReadyTime(agent.giftableAt)}` : "Esperando 48 horas" };
  }
  if (agent.friendship !== "ready") return { agent, available: false, reason: "ID todavía no agregado" };
  if (agent.giftsUsed >= agent.giftsLimit) return { agent, available: false, reason: "Sin envíos disponibles hoy" };
  if (agent.vbucksBalance < requiredVbucks) return { agent, available: false, reason: "Saldo insuficiente" };
  return { agent, available: true, reason: "Listo para enviar" };
}

export function selectBestAgent(agents: readonly DeliveryAgent[], requiredVbucks: number): DeliveryAgent | null {
  return agents
    .filter((agent) => evaluateAgent(agent, requiredVbucks).available)
    .toSorted((left, right) => {
      const leftRemainder = left.vbucksBalance - requiredVbucks;
      const rightRemainder = right.vbucksBalance - requiredVbucks;
      return leftRemainder - rightRemainder || left.giftsUsed - right.giftsUsed || left.id.localeCompare(right.id);
    })[0] ?? null;
}

function formatReadyTime(value: string): string {
  const milliseconds = new Date(value).getTime() - Date.now();
  if (milliseconds <= 0) return "en unos minutos";
  const hours = Math.ceil(milliseconds / 3_600_000);
  return `en ${hours} h`;
}
