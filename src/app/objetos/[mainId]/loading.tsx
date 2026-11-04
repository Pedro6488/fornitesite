import { StorefrontLoadingScreen } from "@/features/storefront/components/storefront-loading-screen";
import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";

export default function ItemLoading() {
  return <StorefrontTransition><StorefrontLoadingScreen title="Cargando el objeto" detail="Estamos confirmando su precio y disponibilidad." /></StorefrontTransition>;
}
