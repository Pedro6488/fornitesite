import { CartPage } from "@/features/cart/components/cart-page";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
export default async function CartRoute() { return <CartPage items={await (await getCatalogService()).list()} />; }
