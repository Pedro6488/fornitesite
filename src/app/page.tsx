import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import { getCatalogService } from "@/features/catalog/server/get-catalog";
import { getPublicDeliveryReferences } from "@/features/community/server/get-community";
import { HomeReferences } from "@/features/storefront/components/home-references";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Gamepad2, MousePointer2, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { HomeHero } from "@/features/storefront/components/home-hero";
import styles from "./home.module.css";

const questions = [
{ question: "¿Cómo recibo mi compra?", answer: "Elige tus objetos de Fortnite. Validamos tu ID y la disponibilidad antes del pago y coordinamos la entrega de tu pedido." },
{ question: "¿Necesito compartir mi contraseña?", answer: "No. Solo necesitamos tu ID de jugador de Fortnite. Tu contraseña se queda contigo." },
{ question: "¿Puedo comprar varios objetos juntos?", answer: "Sí. Agrega tus objetos de Fortnite al carrito y revisa los productos, el precio y los datos necesarios antes de continuar." },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [catalogResult, referencesResult] = await Promise.allSettled([
    getCatalogService().then((catalog) => catalog.list()),
    getPublicDeliveryReferences(),
  ]);
  const items = catalogResult.status === "fulfilled" ? catalogResult.value : [];
  const references = referencesResult.status === "fulfilled" ? referencesResult.value : [];
  if (catalogResult.status === "rejected") console.error("Home catalog unavailable", catalogResult.reason);
  if (referencesResult.status === "rejected") console.error("Home references unavailable", referencesResult.reason);
  const candidates = items.filter((item) => item.imageUrl);
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  const showcase = candidates.slice(0, 8).map((item) => ({ id: item.mainId, name: item.name, image: item.imageUrl! }));
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749";
  const contactUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, tengo una duda sobre una compra en SigfriedLootBox.")}`;
  return <StorefrontTransition><div className={styles.home} data-storefront-home>
    <nav className={styles.quickGames} aria-label="Acceso rápido a juegos"><Link href="/fortnite#catalogo">Fortnite</Link></nav>
    <HomeHero items={showcase} />

    <HomeReferences references={references} unavailable={referencesResult.status === "rejected"} />

    <section className={styles.how} id="como-comprar" aria-labelledby="how-title">
      <div className={styles.sectionIntro}><p className={styles.eyebrow}>MENOS VUELTAS. MÁS PARTIDAS.</p><h2 id="how-title">EL LOOT ES TUYO.<br /><span>EL PROCESO, CLARO.</span></h2><p>Tus objetos de Fortnite, en un solo lugar.<br />Te decimos lo que necesitas antes de comprar.</p></div>
      <div className={styles.steps}>
        <article><div className={styles.stepIcon}><MousePointer2 size={23} aria-hidden="true" /><span>01</span></div><h3>Encuentra lo tuyo</h3><p>Explora los objetos de Fortnite y elige tus favoritos. El precio, siempre a la vista.</p></article>
        <article><div className={styles.stepIcon}><ShieldCheck size={23} aria-hidden="true" /><span>02</span></div><h3>Confirma los detalles</h3><p>Validamos tu ID de Fortnite y la disponibilidad antes del pago.</p></article>
        <article><div className={styles.stepIcon}><Ticket size={23} aria-hidden="true" /><span>03</span></div><h3>Completa tu compra</h3><p>Confirma el pago y la entrega de tus objetos de Fortnite. Si tienes una duda, estamos a un mensaje.</p></article>
      </div>
    </section>

    <section className={styles.support} aria-labelledby="support-title">
      <div className={styles.supportVisual} aria-hidden="true"><div className={styles.chatBubble}><Gamepad2 size={24} /><span>¿Listo para la siguiente?</span><Check size={16} /></div><div className={styles.chatReply}><span>Vamos por ese loot.</span><Sparkles size={18} /></div><span className={styles.supportStamp}>SOPORTE<br />PARA JUGADORES ↗</span></div>
      <div><p className={styles.eyebrow}>DEL OTRO LADO, HAY PERSONAS.</p><h2 id="support-title">NO JUEGAS<br />SOLO.</h2><p>Pregunta por un producto o por cómo comprar.<br />Te ayudamos a encontrar el siguiente paso.</p><a className={styles.primary} href={contactUrl} target="_blank" rel="noopener noreferrer">Hablemos por WhatsApp <ArrowUpRight size={18} aria-hidden="true" /></a></div>
    </section>

    <section className={styles.faq} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>ANTES DE DARLE PLAY</p><h2 id="faq-title">SIN DUDAS.<br /><span>DALE PLAY.</span></h2><Link href="/referencias">Conoce las referencias <ArrowRight size={17} aria-hidden="true" /></Link></div><div className={styles.questions}>{questions.map(({question, answer}) => <details key={question}><summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
    <div className={styles.signoff} aria-hidden="true">NOS VEMOS EN LA PARTIDA<span>↗</span></div>
  </div></StorefrontTransition>;
}
