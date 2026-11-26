import { CartPage } from "@/features/cart/components/cart-page";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

// Se arma en cada visita, como el inicio: el catálogo cambia todos los días y, si Fortnite-API o
// Supabase fallan durante el build, una página estática tumbaba el deploy completo.
export const dynamic = "force-dynamic";

export default async function CartRoute() { return <CartPage items={await (await getCatalogService()).list()} />; }
