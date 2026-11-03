"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type StoreRegion = "mx" | "us";

type RegionContextValue = Readonly<{
  region: StoreRegion;
  setRegion: (region: StoreRegion) => void;
}>;

const RegionContext = createContext<RegionContextValue | null>(null);
const REGION_STORAGE_KEY = "sigfried-loot-box-region";
const REGION_CHANGE_EVENT = "sigfried-region-change";

function readRegion(): StoreRegion {
  try { return window.localStorage.getItem(REGION_STORAGE_KEY) === "us" ? "us" : "mx"; }
  catch { return "mx"; }
}

function subscribeRegion(notify: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === REGION_STORAGE_KEY || event.key === null) notify();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(REGION_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(REGION_CHANGE_EVENT, notify);
  };
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const region = useSyncExternalStore(subscribeRegion, readRegion, () => "mx" as StoreRegion);

  function updateRegion(nextRegion: StoreRegion) {
    window.localStorage.setItem(REGION_STORAGE_KEY, nextRegion);
    window.dispatchEvent(new Event(REGION_CHANGE_EVENT));
  }

  return <RegionContext.Provider value={{ region, setRegion: updateRegion }}>{children}</RegionContext.Provider>;
}

export function useStoreRegion(): RegionContextValue {
  return useContext(RegionContext) ?? { region: "mx", setRegion: () => undefined };
}
