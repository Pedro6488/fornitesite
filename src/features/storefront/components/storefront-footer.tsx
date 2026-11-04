import Link from "next/link";
import { ArrowUpRight, Gamepad2 } from "lucide-react";
import styles from "./storefront-shell.module.css";

export function StorefrontFooter({ contactUrl }: { contactUrl: string }) {
  return <footer className={styles.footer}>
    <div className={styles.footerInner}>
      <div className={styles.footerBrand}><Gamepad2 size={24} aria-hidden="true" /><strong>Sigfried<span>LootBox</span></strong><p>Un lugar para todos tus juegos.<br />Un estilo que es solo tuyo.</p></div>
      <nav aria-label="Juegos en el pie de página"><span>ENCUENTRA TU LOOT</span><Link href="/fortnite#catalogo">Fortnite</Link><Link href="/free-fire">Free Fire</Link><Link href="/roblox">Roblox</Link></nav>
      <nav aria-label="Tu cuenta"><span>ESTAMOS CONTIGO</span><Link href="/cuenta">Mi cuenta</Link><Link href="/carrito">Carrito de Fortnite</Link><Link href="/favoritos">Favoritos de Fortnite</Link><Link href="/referencias">Referencias</Link><Link href="/clientes">Clientes</Link></nav>
      <div className={styles.footerContact}><span>¿HABLAMOS?</span><a href={contactUrl} target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp <ArrowUpRight size={17} aria-hidden="true" /></a><small>Te ayudamos con tu próxima compra.</small></div>
    </div>
    <div className={styles.footerBottom}><span>SigfriedLootBox · Hecho para tu partida.</span><span>Las marcas y los juegos pertenecen a sus respectivos propietarios.</span></div>
  </footer>;
}
