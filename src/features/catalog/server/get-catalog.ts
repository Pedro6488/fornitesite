import { CatalogService } from "../application/catalog-service";
import { FortniteApiCatalogProvider } from "../infrastructure/fortnite-api-catalog-provider";
import { SupabasePricingProvider, type CatalogPricingProvider } from "@/features/pricing/infrastructure/supabase-pricing-provider";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const DEFAULT_FORTNITE_API_URL = "https://fortnite-api.com/v2";

type CatalogConfiguration = Readonly<{
  fortniteBaseUrl?: string;
}>;

export async function getCatalogService(): Promise<CatalogService> {
  const database = getSupabaseAdmin();
  const pricing = database
    ? new SupabasePricingProvider(database)
    : process.env.NODE_ENV === "production"
      ? { price: async (items: Parameters<CatalogPricingProvider["price"]>[0]) => new Map(items.map((item) => [item.mainId, null])) }
      : undefined;
  return createCatalogService({ fortniteBaseUrl: process.env.FORTNITE_API_BASE_URL }, pricing);
}

/**
 * El catálogo sale solo de Fortnite-API, que ya trae `offerId` y `giftable` y es gratis.
 * FN Shop no se consulta para mostrar la tienda: cada visita costaría un request.
 * Al entregar, `gift_check` confirma que el `offerId` sigue vigente.
 */
export function createCatalogService(
  configuration: CatalogConfiguration,
  pricing?: CatalogPricingProvider
): CatalogService {
  const visualCatalog = new FortniteApiCatalogProvider(configuration.fortniteBaseUrl || DEFAULT_FORTNITE_API_URL);
  return new CatalogService(visualCatalog, undefined, pricing);
}
