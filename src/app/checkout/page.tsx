import { CartCheckoutForm } from "@/features/cart/components/cart-checkout-form";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
export default async function CheckoutPage() { return <CartCheckoutForm items={await (await getCatalogService()).list()} />; }
