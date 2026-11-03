export const ROBLOX_PACKAGES = [
  { robux: 200, price: 60 },
  { robux: 400, price: 100 },
  { robux: 800, price: 200 },
  { robux: 1700, price: 399 },
  { robux: 4500, price: 979 },
  { robux: 7500, price: 1650 },
] as const;

export type RobloxPackage = typeof ROBLOX_PACKAGES[number];
