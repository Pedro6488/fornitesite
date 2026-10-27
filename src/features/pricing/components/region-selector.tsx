"use client";

import { MapPin } from "lucide-react";
import { useStoreRegion } from "./region-provider";

export function RegionSelector() {
  const { region, setRegion } = useStoreRegion();
  return <div className="region-selector" aria-label="Región de precios"><MapPin aria-hidden="true" size={15} /><button type="button" className={region === "mx" ? "active" : undefined} aria-pressed={region === "mx"} onClick={() => setRegion("mx")}>México</button><button type="button" className={region === "us" ? "active" : undefined} aria-pressed={region === "us"} onClick={() => setRegion("us")}>USA</button></div>;
}
