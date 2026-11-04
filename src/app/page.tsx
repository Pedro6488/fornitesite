import { StorefrontTransition } from "@/features/storefront/components/storefront-transition";
import Image from "next/image";
import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Gamepad2, MessageCircle, MousePointer2, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { HomeHero } from "@/features/storefront/components/home-hero";
import { FREE_FIRE_STARTING_PRICE, ROBLOX_STARTING_PRICE, formatStoreMxn } from "@/features/storefront/games";
import styles from "./home.module.css";

const questions = [
  { question: "¿Cómo recibo mi compra?", answer: "Depende de tu juego. En Fortnite eliges objetos y validamos tu ID y la disponibilidad antes del pago. En Free Fire la recarga se solicita con tu nick y UID. En Roblox recibes un código canjeable; el pago y la entrega se coordinan por WhatsApp." },
  { question: "¿Necesito compartir mi contraseña?", answer: "No. Para estos productos no necesitas compartir tu contraseña. Fortnite utiliza tu ID de jugador; Free Fire, tu nick y UID. Para los códigos de Roblox solo solicitamos un contacto para coordinar la compra." },
  { question: "¿Puedo comprar productos de distintos juegos juntos?", answer: "El carrito corresponde a los objetos de Fortnite. Los paquetes de Free Fire y Roblox se solicitan por separado a través de WhatsApp. Antes de continuar verás el producto, el precio y los datos necesarios." },
];

export default function HomePage() {
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749";
  const contactUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, tengo una duda sobre una compra en SigfriedLootBox.")}`;
  return <StorefrontTransition><div className={styles.home} data-storefront-home>
    <nav className={styles.quickGames} aria-label="Acceso rápido a juegos"><Link href="/fortnite#catalogo">Fortnite</Link><Link href="/free-fire">Free Fire</Link><Link href="/roblox">Roblox</Link></nav>
    <HomeHero />

    <section className={styles.arena} id="juegos" aria-labelledby="games-title">

      <div className={styles.launcher}>
        <div className={styles.launcherBar}>
          <div><p className={styles.eyebrow}>ELIGE TU UNIVERSO</p><h2 id="games-title">¿DÓNDE JUGAMOS?</h2></div>
          <span className={styles.available}><i aria-hidden="true" /> 3 juegos disponibles</span>
        </div>
        <div className={styles.games}>
          <Link href="/fortnite#catalogo" className={`${styles.game} ${styles.fortnite}`} aria-label="Fortnite: explorar objetos de la tienda">
            <Image src="/games/fortnite.jpg" alt="" fill sizes="(max-width: 650px) 100vw, 45vw" className={styles.gameArt} />
            <div className={styles.gameTop}><span className={styles.gameTag}>OBJETOS DE LA TIENDA</span><span className={styles.gameNumber}>01</span></div>
            <div className={styles.gameContent}><span className={styles.gameKicker}>TU ESTILO SALTA DEL BUS.</span><h3>FORTNITE</h3><p>Ese objeto que tenías en mente. <br />Encuéntralo. Hazlo tuyo.</p><span className={styles.gameAction}>Explorar objetos <ArrowUpRight size={22} aria-hidden="true" /></span></div>
          </Link>
          <Link href="/free-fire" className={`${styles.game} ${styles.freefire}`} aria-label="Free Fire: ver paquetes de diamantes">
            <Image src="/games/free-fire.jpg" alt="" fill sizes="(max-width: 650px) 50vw, 30vw" className={styles.gameArt} />
            <div className={styles.gameTop}><span className={styles.gameTag}>DIAMANTES</span><span className={styles.gameNumber}>02</span></div>
            <div className={styles.gameContent}><span className={styles.gameKicker}>LISTO PARA EL BOOYAH.</span><h3>FREE FIRE</h3><p>Desde <strong>{formatStoreMxn(FREE_FIRE_STARTING_PRICE)} MXN</strong></p><span className={styles.gameAction}>Ver diamantes <ArrowUpRight size={22} aria-hidden="true" /></span></div>
          </Link>
          <Link href="/roblox" className={`${styles.game} ${styles.roblox}`} aria-label="Roblox: ver códigos canjeables de Robux">
            <div className={styles.robloxGrid} aria-hidden="true" />
            <div className={styles.robloxSymbol} aria-hidden="true"><span /></div>
            <div className={styles.gameTop}><span className={styles.gameTag}>CÓDIGOS DE ROBUX</span><span className={styles.gameNumber}>03</span></div>
            <div className={styles.gameContent}><span className={styles.gameKicker}>IMAGINA LO QUE SIGUE.</span><h3>ROBLOX</h3><p>Desde <strong>{formatStoreMxn(ROBLOX_STARTING_PRICE)} MXN</strong></p><span className={styles.gameAction}>Ver Robux <ArrowUpRight size={22} aria-hidden="true" /></span></div>
          </Link>
        </div>
        <div className={styles.launcherFoot}><span><ShieldCheck size={15} aria-hidden="true" /> Fortnite: compra en la web</span><span><MessageCircle size={15} aria-hidden="true" /> Free Fire y Roblox: solicitud por WhatsApp</span><span className={styles.soon}>Call of Duty <small>PRÓXIMAMENTE</small></span></div>
      </div>
      <div className={styles.arenaCaption}><span>TU JUEGO</span><span aria-hidden="true">✳</span><strong>TUS REGLAS</strong><span aria-hidden="true">✳</span><span>TU LOOT</span></div>
    </section>

    <section className={styles.how} id="como-comprar" aria-labelledby="how-title">
      <div className={styles.sectionIntro}><p className={styles.eyebrow}>MENOS VUELTAS. MÁS PARTIDAS.</p><h2 id="how-title">EL LOOT ES TUYO.<br /><span>EL PROCESO, CLARO.</span></h2><p>Cada juego tiene su forma de entrega.<br />Te decimos lo que necesitas antes de comprar.</p></div>
      <div className={styles.steps}>
        <article><div className={styles.stepIcon}><MousePointer2 size={23} aria-hidden="true" /><span>01</span></div><h3>Encuentra lo tuyo</h3><p>Elige tu juego y explora objetos, diamantes o códigos. El precio, siempre a la vista.</p></article>
        <article><div className={styles.stepIcon}><ShieldCheck size={23} aria-hidden="true" /><span>02</span></div><h3>Confirma los detalles</h3><p>En Fortnite validamos tu ID. Para recargas y códigos, coordinas la solicitud por WhatsApp.</p></article>
        <article><div className={styles.stepIcon}><Ticket size={23} aria-hidden="true" /><span>03</span></div><h3>Completa tu compra</h3><p>Confirma el pago y la entrega según tu juego. Si tienes una duda, estamos a un mensaje.</p></article>
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
