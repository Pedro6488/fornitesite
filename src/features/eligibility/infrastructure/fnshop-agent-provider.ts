import type { AgentProvider, DeliveryAgent, FriendshipState } from "../domain/delivery-agent";

type JsonRecord = Record<string, unknown>;

export class FnShopAgentProvider implements AgentProvider {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async resolveAccount(displayName: string, platform?: string) {
    const username = platform && platform !== "epic" ? `${platform}:${displayName}` : displayName;
    const payload = await this.call("resolve_account", { username, mode: "display_name" });
    const epicAccountId = String(payload.receiver_id ?? payload.account_id ?? payload.receiver ?? "");
    if (!epicAccountId) throw new Error("FN Shop no devolvió un Epic Account ID.");
    return { epicAccountId, displayName: String(payload.displayName ?? displayName) };
  }

  async listForReceiver(epicAccountId: string): Promise<readonly DeliveryAgent[]> {
    const [friendships, groups] = await Promise.all([
      this.call("friend_status", { receiver: epicAccountId, receiver_id: epicAccountId }),
      this.call("groups_status", { live: "1" })
    ]);
    const friendshipList = Array.isArray(friendships.accounts) ? friendships.accounts as JsonRecord[] : [];
    const groupList = flattenAccounts(groups);
    const friendshipById = new Map(friendshipList.map((value) => [String(value.account_id), value]));

    return groupList.map((value, index) => {
      const id = String(value.account_id ?? value.id ?? `agent-${index + 1}`);
      const friendship = friendshipById.get(id) ?? {};
      return {
        id,
        publicAlias: `Agente ${index + 1}`,
        vbucksBalance: numeric(value.vbucks ?? value.balance),
        giftsUsed: numeric(value.gifts_used ?? value.gifts),
        giftsLimit: numeric(value.gifts_limit) || 5,
        friendship: normalizeFriendship(friendship),
        giftableAt: typeof friendship.giftable_at === "string" ? friendship.giftable_at : null,
        healthy: value.error == null
      } satisfies DeliveryAgent;
    });
  }

  async addFriend(epicAccountId: string) {
    const response = await this.call("friend_add", { receiver: epicAccountId, receiver_id: epicAccountId });
    return { requested: numeric(response.sent), alreadyFriends: numeric(response.already_friends) };
  }

  private async call(action: string, input: Record<string, string>): Promise<JsonRecord> {
    const response = await fetch(`${this.baseUrl}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": this.apiKey },
      body: JSON.stringify(input),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`FN Shop ${action} respondió ${response.status}.`);
    const payload = await response.json() as JsonRecord;
    if (payload.result === false) throw new Error(String(payload.description ?? `FN Shop rechazó ${action}.`));
    return payload;
  }
}

function numeric(value: unknown): number { return typeof value === "number" ? value : Number(value) || 0; }
function flattenAccounts(payload: JsonRecord): JsonRecord[] {
  if (Array.isArray(payload.accounts)) return payload.accounts as JsonRecord[];
  if (!Array.isArray(payload.categories)) return [];
  return (payload.categories as JsonRecord[]).flatMap((category) => Array.isArray(category.accounts) ? category.accounts as JsonRecord[] : []);
}
function normalizeFriendship(value: JsonRecord): FriendshipState {
  if (value.giftable === true || value.can_gift_now === true) return "ready";
  if (value.state === "friends") return "waiting";
  if (value.state === "pending") return "pending";
  if (value.state === "blocked") return "blocked";
  return "not_added";
}
