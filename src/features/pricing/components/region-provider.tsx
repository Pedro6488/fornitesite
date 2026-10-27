"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type StoreRegion = "mx" | "us";

type RegionContextValue = Readonly<{
  region: StoreRegion;
  setRegion: (region: StoreRegion) => void;
}>;

const RegionContext = createContext<RegionContextValue | null>(null);
const REGION_STORAGE_KEY = "sigfried-loot-box-region";

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<StoreRegion>("mx");

  useEffect(() => {
    const storedRegion = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (storedRegion === "mx" || storedRegion === "us") setRegion(storedRegion);
  }, []);

  function updateRegion(nextRegion: StoreRegion) {
    setRegion(nextRegion);
    window.localStorage.setItem(REGION_STORAGE_KEY, nextRegion);
  }

  return <RegionContext.Provider value={{ region, setRegion: updateRegion }}>{children}</RegionContext.Provider>;
}

export function useStoreRegion(): RegionContextValue {
  return useContext(RegionContext) ?? { region: "mx", setRegion: () => undefined };
}
