import type { AgentProvider } from "../domain/delivery-agent";
import { DemoAgentProvider } from "../infrastructure/demo-agent-provider";
import { FnShopAgentProvider } from "../infrastructure/fnshop-agent-provider";

export function getAgentProvider(): AgentProvider {
  const fulfillmentMode = process.env.FULFILLMENT_MODE ?? "manual";
  const apiKey = process.env.FNSHOP_API_KEY?.trim();
  if (fulfillmentMode !== "fnshop") {
    throw new Error("La validación automática de IDs está reservada para una fase posterior.");
  }
  if (!apiKey) {
    const demoAllowed =
      process.env.ALLOW_DEMO_PROVIDERS === "true" &&
      process.env.NODE_ENV !== "production";
    if (!demoAllowed)
      throw new Error(
        "FN Shop no está configurado; la validación de IDs está deshabilitada.",
      );
    return new DemoAgentProvider();
  }
  return new FnShopAgentProvider(
    process.env.FNSHOP_API_BASE_URL ?? "https://fnitem.shop/api/v3/service",
    apiKey,
  );
}
