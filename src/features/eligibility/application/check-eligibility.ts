import type { AgentProvider } from "../domain/delivery-agent";
import { evaluateAgent, selectBestAgent } from "../domain/delivery-agent";

export class CheckEligibility {
  constructor(private readonly agents: AgentProvider) {}

  async execute(input: { displayName: string; platform?: string; requiredVbucks: number }) {
    const account = await this.agents.resolveAccount(input.displayName, input.platform);
    const agents = await this.agents.listForReceiver(account.epicAccountId);
    const evaluations = agents.map((agent) => evaluateAgent(agent, input.requiredVbucks));

    return {
      receiver: account,
      agents: evaluations,
      selectedAgentId: selectBestAgent(agents, input.requiredVbucks)?.id ?? null,
      canContinue: evaluations.some(({ available }) => available),
      canAddFriend: evaluations.every(({ agent }) => agent.friendship === "not_added")
    };
  }
}
