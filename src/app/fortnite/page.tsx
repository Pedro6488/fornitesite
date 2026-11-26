import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import { CatalogGrid } from "@/features/catalog/components/catalog-grid";
import { CatalogHero } from "@/features/catalog/components/catalog-hero";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { ScrollToPendingAnchor } from "@/features/storefront/components/route-scroll";
import { GamesMenuLink } from "@/shared/components/games-menu-link";

// Se arma en cada visita, como el inicio: el catálogo y los precios cambian todos los días y, si
// Fortnite-API o Supabase fallan durante el build, una página estática tumbaba el deploy completo.
export const dynamic = "force-dynamic";

export default async function FortnitePage() {
  const catalog = await getCatalogService();
  const items = await catalog.list();

  return (
    <StorefrontTransition>
      <GamesMenuLink />
      <CatalogHero items={items} />
      <section className="shop-section" id="catalogo" aria-label="Catálogo de Fortnite">
        <CatalogGrid items={items} />
      </section>
      <ScrollToPendingAnchor />
    </StorefrontTransition>
  );
}
