import { describe, expect, it } from "vitest";
import type { AgentProvider, DeliveryAgent } from "../domain/delivery-agent";
import { CheckEligibility } from "./check-eligibility";

const agent = (overrides: Partial<DeliveryAgent> = {}): DeliveryAgent => ({ id: "agent", publicAlias: "Agente 1", vbucksBalance: 2_000, giftsUsed: 0, giftsLimit: 5, friendship: "ready", giftableAt: null, healthy: true, ...overrides });
const provider = (agents: readonly DeliveryAgent[]): AgentProvider => ({
  resolveAccount: async (displayName) => ({ epicAccountId: "epic-id", displayName }),
  listForReceiver: async () => agents,
  addFriend: async () => ({ requested: 1, alreadyFriends: 0 })
});

describe("CheckEligibility", () => {
  it("selecciona un agente listo", async () => {
    const result = await new CheckEligibility(provider([agent()])).execute({ displayName: "Player", requiredVbucks: 1_500 });
    expect(result).toEqual(expect.objectContaining({ canContinue: true, selectedAgentId: "agent", canAddFriend: false }));
  });
  it("habilita agregar cuando ningún agente conoce al jugador", async () => {
    const result = await new CheckEligibility(provider([agent({ friendship: "not_added" })])).execute({ displayName: "Player", requiredVbucks: 1_500 });
    expect(result).toEqual(expect.objectContaining({ canContinue: false, canAddFriend: true }));
  });
});
