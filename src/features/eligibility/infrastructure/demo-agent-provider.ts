import type { AgentProvider, DeliveryAgent } from "../domain/delivery-agent";

const demoAgents: readonly DeliveryAgent[] = [
  { id: "agent-1", publicAlias: "Agente 1", vbucksBalance: 2_300, giftsUsed: 2, giftsLimit: 5, friendship: "not_added", giftableAt: null, healthy: true },
  { id: "agent-2", publicAlias: "Agente 2", vbucksBalance: 14_000, giftsUsed: 0, giftsLimit: 5, friendship: "ready", giftableAt: null, healthy: true },
  { id: "agent-3", publicAlias: "Agente 3", vbucksBalance: 500, giftsUsed: 4, giftsLimit: 5, friendship: "ready", giftableAt: null, healthy: true },
  { id: "agent-4", publicAlias: "Agente 4", vbucksBalance: 3_300, giftsUsed: 1, giftsLimit: 5, friendship: "waiting", giftableAt: new Date(Date.now() + 13 * 3_600_000).toISOString(), healthy: true }
];

export class DemoAgentProvider implements AgentProvider {
  async resolveAccount(displayName: string) {
    return { epicAccountId: `demo-${displayName.toLowerCase().replaceAll(" ", "-")}`, displayName };
  }
  async listForReceiver(): Promise<readonly DeliveryAgent[]> { return demoAgents; }
  async addFriend(): Promise<{ requested: number; alreadyFriends: number }> { return { requested: 3, alreadyFriends: 1 }; }
}
