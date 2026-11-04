import { ArrowRight } from "lucide-react";
import { GamePageHero } from "@/features/storefront/components/game-page-hero";
import stage from "@/features/storefront/components/game-stage.module.css";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";

export default function NotFound() {
  return (
    <GamePageHero
      word="404"
      accent="#a855f7"
      eyebrow="Error 404"
      title={<>Esto salió<br /><span>del mapa.</span></>}
      lead="La página que buscas no existe o el objeto ya salió de la tienda."
    >
      <Link href="/" className={stage.cta}>Volver al inicio <ArrowRight aria-hidden="true" size={18} /></Link>
    </GamePageHero>
  );
}
