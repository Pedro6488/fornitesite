import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./games-menu-link.module.css";

export function GamesMenuLink() {
  return <nav className={styles.navigation} aria-label="Volver al menú principal">
    <Link href="/" className={styles.link}><ArrowLeft size={17} aria-hidden="true" /> Volver al catálogo de juegos</Link>
  </nav>;
}
