import type { AgentProvider } from "../domain/delivery-agent";
import { DemoAgentProvider } from "../infrastructure/demo-agent-provider";
import { FnShopAgentProvider } from "../infrastructure/fnshop-agent-provider";

export function getAgentProvider(): AgentProvider {
  const apiKey = process.env.FNSHOP_API_KEY;
  if (!apiKey) return new DemoAgentProvider();
  return new FnShopAgentProvider(
    process.env.FNSHOP_API_BASE_URL ?? "https://fnitem.shop/api/v3/service",
    apiKey
  );
}
