import { unstable_cache } from "next/cache";
import { CatalogService } from "../application/catalog-service";
import type { CatalogProvider } from "../domain/catalog-item";
import { FortniteApiCatalogProvider } from "../infrastructure/fortnite-api-catalog-provider";
import { SupabasePricingProvider, type CatalogPricingProvider } from "@/features/pricing/infrastructure/supabase-pricing-provider";
import { getSupabaseAdmin } from "@/shared/infrastructure/supabase/admin";

const DEFAULT_FORTNITE_API_URL = "https://fortnite-api.com/v2";
const CATALOG_REVALIDATE_SECONDS = 300;

/**
 * Cachea la lista ya procesada, no la respuesta de Fortnite-API: esa pasa de 2 MB (límite por
 * entrada de la caché de datos de Next) y no se guardaba. La página mostraba la tienda nueva y
 * /api/cart validaba contra la anterior, descartando en silencio los objetos nuevos.
 * Si Fortnite-API falla, la caché sigue sirviendo la última lista buena.
 */
function cachedCatalog(provider: CatalogProvider, baseUrl: string): CatalogProvider {
  const getCurrentCatalog = unstable_cache(
    () => provider.getCurrentCatalog(),
    ["fortnite-catalog", baseUrl],
    { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["fortnite-catalog"] }
  );
  return { getCurrentCatalog };
}

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
  const baseUrl = configuration.fortniteBaseUrl || DEFAULT_FORTNITE_API_URL;
  const visualCatalog = cachedCatalog(new FortniteApiCatalogProvider(baseUrl), baseUrl);
  return new CatalogService(visualCatalog, undefined, pricing);
}
