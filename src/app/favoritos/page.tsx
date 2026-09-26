import { FavoritesCatalog } from "@/features/catalog/components/favorites-catalog";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

export default async function FavoritesPage() {
  const catalog = await getCatalogService();
  const items = await catalog.list();

  return (
    <section className="favorites-page">
      <header className="favorites-heading">
        <p className="eyebrow">TU SELECCIÓN</p>
        <h1>Tus favoritos</h1>
        <p>Guarda opciones mientras exploras y compáralas cuando estés listo para elegir.</p>
      </header>
      <FavoritesCatalog items={items} />
    </section>
  );
}
