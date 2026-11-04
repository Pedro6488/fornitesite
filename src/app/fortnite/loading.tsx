import { StorefrontLoadingScreen } from "@/features/storefront/components/storefront-loading-screen";
import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";

export default function FortniteLoading() {
  return <StorefrontTransition><StorefrontLoadingScreen title="Cargando la tienda de Fortnite" detail="Estamos revisando los objetos y precios de hoy." /></StorefrontTransition>;
}
