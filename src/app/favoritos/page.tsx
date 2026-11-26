import { FavoritesCatalog } from "@/features/catalog/components/favorites-catalog";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";

// Se arma en cada visita, como el inicio: el catálogo y los precios cambian todos los días y, si
// Fortnite-API o Supabase fallan durante el build, una página estática tumbaba el deploy completo.
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const catalog = await getCatalogService();
  const items = await catalog.list();

  return (
    <section className="favorites-page">
      <GamePageHero
        slim
        word="FAVORITOS"
        accent="#ff2d6b"
        eyebrow="Tu selección"
        title={<>Tus <span>favoritos</span></>}
        lead="Guarda opciones mientras exploras y compáralas cuando estés listo para elegir."
      />
      <div className="loot-page-body">
        <FavoritesCatalog items={items} />
      </div>
    </section>
  );
}
