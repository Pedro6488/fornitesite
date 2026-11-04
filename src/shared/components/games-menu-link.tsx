"use client";

import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { STOREFRONT_GAMES, gameForPath } from "@/features/storefront/games";
import { rememberGame } from "@/features/storefront/components/continue-game-link";
import styles from "./games-menu-link.module.css";

export function GamesMenuLink() {
  const pathname = usePathname();
  const currentGame = gameForPath(pathname);
  useEffect(() => { if (currentGame) rememberGame(currentGame.id); }, [currentGame]);
  return <nav className={styles.navigation} aria-label="Cambiar de juego">
    <Link href="/#juegos" transitionTypes={["loot-back"]} className={styles.back}><ArrowLeft size={16} aria-hidden="true" /><span>Todos los juegos</span></Link>
    <div className={styles.games}>{STOREFRONT_GAMES.map((game) => <Link key={game.id} href={game.href} transitionTypes={["loot-switch"]} className={styles.game} aria-current={currentGame?.id === game.id ? "page" : undefined}>{game.name}<ArrowUpRight size={13} aria-hidden="true" /></Link>)}</div>
    <span className={styles.label}>ELIGE TU UNIVERSO</span>
  </nav>;
}
