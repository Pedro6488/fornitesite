import { expect, it } from "vitest";
import { calculateCollectionPrice, priceCollection } from "./collection-rate";

it("calcula la tarifa por 100 paVos con redondeo al peso superior", () => {
  expect(calculateCollectionPrice(1000, 7.5)).toBe(75);
  expect(calculateCollectionPrice(1500, 7.5)).toBe(113);
  expect(calculateCollectionPrice(2200, 7.5)).toBe(165);
  expect(calculateCollectionPrice(1500, 8)).toBe(120);
});
it.each([0, -10, NaN, Infinity])("rechaza tarifa inválida %s", (rate) => {
  expect(() => calculateCollectionPrice(120, rate)).toThrow();
});
it("usa exactamente los nombres de los apartados públicos", () => {
  expect(priceCollection({ collaboration: "  ES HORA DE ANOTAR  " })).toBe("ES HORA DE ANOTAR");
  expect(priceCollection({})).toBe("Otros objetos");
});
