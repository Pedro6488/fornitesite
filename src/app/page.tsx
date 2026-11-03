import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Gamepad2, ShieldCheck } from "lucide-react";
import styles from "./home.module.css";

const games = [
  { name: "Call of Duty", subtitle: "MOBILE", image: "/games/call-of-duty.jpg", href: null },
  { name: "Free Fire", subtitle: "BATTLE ROYALE", image: "/games/free-fire.jpg", href: "/free-fire" },
  { name: "Roblox", subtitle: "UN MUNDO DE POSIBILIDADES", image: null, href: "/roblox" },
];

export default function HomePage() {
  const whatsapp = process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") || "5215619857749";
  const contactUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, tengo una duda sobre SigfriedLootBox. ¿Me puede ayudar un administrador?")}`;
  return (
    <section className={styles.home} aria-labelledby="games-title">
      <div className={styles.content}>
        <div className={styles.intro}>
          <div>
            <p className={styles.eyebrow}><Gamepad2 size={18} aria-hidden="true" /> TU SIGUIENTE PARTIDA EMPIEZA AQUÍ</p>
            <h1 id="games-title" className={styles.title}>Tu juego.<br /><span>Tu próximo loot.</span></h1>
            <p className={styles.purchaseTrust}>
              <ShieldCheck size={22} aria-hidden="true" />
              <span>Tu compra <strong>100% protegida</strong>, segura y rápida.</span>
            </p>
          </div>
          <div className={styles.introContact}>
            <p className={styles.description}>Elige tu universo y encuentra algo para hacerlo tuyo.</p>
            <a className={styles.contactButton} href={contactUrl} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.whatsappIcon}>
                <path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.16 1.6 5.97L.02 24l6.25-1.64a11.9 11.9 0 0 0 5.77 1.47h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.18-3.46-8.42ZM12.05 21.82a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.9 9.9 0 0 1-1.52-5.28c0-5.46 4.44-9.9 9.9-9.9a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.92 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.8-1.49-1.78-1.66-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.21 5.09 4.5.71.3 1.26.48 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
              </svg>
              <span><strong>¿Tienes dudas?</strong><span>Contacta con un administrador</span></span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className={styles.sectionHeading}><h2>Explora los juegos</h2><span>ELIGE TU UNIVERSO</span></div>
        <ul className={styles.games}>
          {games.map((game) => {
            const Card = game.href ? Link : "div";
            return (
            <li key={game.name}>
              <Card href={game.href ?? "#"} className={[styles.card, game.href ? styles.available : ""].join(" ")}>
                {game.image ? (
                  <Image src={game.image} alt="" fill sizes="(max-width: 800px) 50vw, 25vw" className={styles.art} />
                ) : (
                  <div className={styles.robloxArt} aria-hidden="true"><span /><b>ROBLOX</b></div>
                )}
                <span className={[styles.badge, game.href ? styles.live : ""].join(" ")}>{game.href ? <><i /> {game.name === "Roblox" ? "Robux disponibles" : "Diamantes disponibles"}</> : "Próximamente"}</span>
                <div className={styles.cardContent}>
                  <p className={styles.subtitle}>{game.subtitle}</p>
                  <h3>{game.name}</h3>
                  {game.href ? <span className={styles.action}>{game.name === "Roblox" ? "Ver Robux" : "Ver diamantes"} <ArrowUpRight size={19} aria-hidden="true" /></span> : <span className={styles.comingSoon}>Un nuevo mundo está por llegar</span>}
                </div>
              </Card>
            </li>
          );})}
          <li>
            <Link href="/fortnite" className={[styles.card, styles.available].join(" ")} aria-label="Fortnite: abrir catálogo">
              <Image src="/games/fortnite.jpg" alt="" fill sizes="(max-width: 800px) 50vw, 25vw" className={styles.art} priority />
              <span className={[styles.badge, styles.live].join(" ")}><i /> Catálogo disponible</span>
              <div className={styles.cardContent}>
                <p className={styles.subtitle}>HAZ TUYA LA PARTIDA</p>
                <h3>Fortnite</h3>
                <span className={styles.action}>Explorar catálogo <ArrowUpRight size={19} aria-hidden="true" /></span>
              </div>
            </Link>
          </li>
        </ul>
        <p className={styles.note}><span aria-hidden="true" /> Más juegos, más posibilidades. Esto apenas comienza.</p>
      </div>
    </section>
  );
}
