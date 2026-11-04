"use client";

import { StorefrontLink as Link } from "@/features/storefront/components/storefront-link";
import { ArrowUpRight } from "lucide-react";
import { useSyncExternalStore } from "react";
import { STOREFRONT_GAMES } from "../games";

export const LAST_GAME_KEY = "sigfried-last-game-v1";
const CHANGE_EVENT = "sigfried-last-game-change";

export function rememberGame(id: string) {
  if (!STOREFRONT_GAMES.some((game) => game.id === id)) return;
  try {
    window.localStorage.setItem(LAST_GAME_KEY, id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* Navigation remains available when storage is blocked. */ }
}
function readLastGame() {
  try { return window.localStorage.getItem(LAST_GAME_KEY); }
  catch { return null; }
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

export function ContinueGameLink({ className }: { className?: string }) {
  const lastId = useSyncExternalStore(subscribe, readLastGame, () => null);
  const previousGame = STOREFRONT_GAMES.find((game) => game.id === lastId);
  const game = previousGame ?? STOREFRONT_GAMES[0];
  return <Link href={game.catalogHref} className={className}>
    {previousGame ? `Volver a ${game.name}` : "Explorar Fortnite"}
    <ArrowUpRight size={19} aria-hidden="true" />
  </Link>;
}
