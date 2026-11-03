export const FREE_FIRE_PACKAGES = [
  { diamonds: 1166, price: 170 },
  { diamonds: 2398, price: 340 },
  { diamonds: 4796, price: 660 },
  { diamonds: 6160, price: 790 },
] as const;

export type FreeFirePackage = typeof FREE_FIRE_PACKAGES[number];
