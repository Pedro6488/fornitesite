import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinueGameLink, LAST_GAME_KEY, rememberGame } from "./continue-game-link";

describe("ContinueGameLink", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("opens Fortnite directly for a new visitor", () => {
    render(<ContinueGameLink />);
    expect(screen.getByRole("link", { name: "Explorar Fortnite" })).toHaveAttribute("href", "/fortnite#catalogo");
  });
  it("offers the last visited game without redirecting the visitor", () => {
    render(<ContinueGameLink />);
    act(() => rememberGame("roblox"));
    expect(screen.getByRole("link", { name: "Volver a Roblox" })).toHaveAttribute("href", "/roblox");
  });
  it("ignores unknown stored destinations", () => {
    window.localStorage.setItem(LAST_GAME_KEY, "https://example.com");
    render(<ContinueGameLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/fortnite#catalogo");
  });
  it("keeps navigation working when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    expect(() => rememberGame("free-fire")).not.toThrow();
    render(<ContinueGameLink />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/fortnite#catalogo");
  });
});
