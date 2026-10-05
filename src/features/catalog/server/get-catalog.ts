import { CatalogService } from "../application/catalog-service";
import { FnShopCatalogProvider } from "../infrastructure/fnshop-catalog-provider";
import { FortniteApiCatalogProvider } from "../infrastructure/fortnite-api-catalog-provider";
import { SupabasePricingProvider, type CatalogPricingProvider } from "@/features/pricing/infrastructure/supabase-pricing-provider";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const DEFAULT_FORTNITE_API_URL = "https://fortnite-api.com/v2";
const DEFAULT_FNSHOP_API_URL = "https://fnitem.shop/api/v3/service";

type CatalogConfiguration = Readonly<{
  fortniteBaseUrl?: string;
  fnShopBaseUrl?: string;
  fnShopApiKey?: string;
  fulfillmentMode?: string;
}>;

export async function getCatalogService(): Promise<CatalogService> {
  const database = getSupabaseAdmin();
  const pricing = database
    ? new SupabasePricingProvider(database)
    : process.env.NODE_ENV === "production"
      ? { price: async (items: Parameters<CatalogPricingProvider["price"]>[0]) => new Map(items.map((item) => [item.mainId, null])) }
      : undefined;
  return createCatalogService({
    fortniteBaseUrl: process.env.FORTNITE_API_BASE_URL,
    fnShopBaseUrl: process.env.FNSHOP_API_BASE_URL,
    fnShopApiKey: process.env.FNSHOP_API_KEY,
    fulfillmentMode: process.env.FULFILLMENT_MODE
  }, pricing);
}

export function createCatalogService(
  configuration: CatalogConfiguration,
  pricing?: CatalogPricingProvider
): CatalogService {
  const fnShopApiKey = configuration.fnShopApiKey?.trim();
  const fnShopEnabled = configuration.fulfillmentMode === "fnshop";
  const visualCatalog = new FortniteApiCatalogProvider(
    configuration.fortniteBaseUrl || DEFAULT_FORTNITE_API_URL
  );
  const transactionalCatalog = fnShopEnabled && fnShopApiKey
    ? new FnShopCatalogProvider(
        configuration.fnShopBaseUrl || DEFAULT_FNSHOP_API_URL,
        fnShopApiKey
      )
    : undefined;

  return new CatalogService(visualCatalog, transactionalCatalog, pricing);
}
