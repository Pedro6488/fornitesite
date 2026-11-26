import { CartCheckoutForm } from "@/features/cart/components/cart-checkout-form";
import { getCatalogService } from "@/features/catalog/server/get-catalog";

// Se arma en cada visita, como el inicio: el catálogo y los precios cambian todos los días y, si
// Fortnite-API o Supabase fallan durante el build, una página estática tumbaba el deploy completo.
export const dynamic = "force-dynamic";
export default async function CheckoutPage() { return <CartCheckoutForm items={await (await getCatalogService()).list()} />; }
