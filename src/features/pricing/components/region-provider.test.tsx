import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { RegionProvider, useStoreRegion } from "./region-provider";

function RegionControl() {
  const { region, setRegion } = useStoreRegion();
  return <><output aria-label="Región">{region}</output><button onClick={() => setRegion("us")}>USA</button></>;
}

describe("RegionProvider", () => {
  beforeEach(() => localStorage.clear());

  it("recupera la región guardada y sincroniza cambios de otra pestaña", () => {
    localStorage.setItem("sigfried-loot-box-region", "us");
    render(<RegionProvider><RegionControl /></RegionProvider>);
    expect(screen.getByLabelText("Región")).toHaveTextContent("us");
    act(() => {
      localStorage.setItem("sigfried-loot-box-region", "mx");
      window.dispatchEvent(new StorageEvent("storage", { key: "sigfried-loot-box-region" }));
    });
    expect(screen.getByLabelText("Región")).toHaveTextContent("mx");
  });

  it("actualiza y conserva la selección hecha en esta pestaña", () => {
    render(<RegionProvider><RegionControl /></RegionProvider>);
    fireEvent.click(screen.getByRole("button", { name: "USA" }));
    expect(screen.getByLabelText("Región")).toHaveTextContent("us");
    expect(localStorage.getItem("sigfried-loot-box-region")).toBe("us");
  });
});
