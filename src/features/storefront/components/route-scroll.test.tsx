import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteScrollTracker, ScrollToPendingAnchor, ScrollToTopOnLoading } from "./route-scroll";

describe("route-scroll", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockClear();
    vi.stubGlobal("scrollTo", scrollTo);
    render(<RouteScrollTracker />);
    fireEvent.click(document.body);
  });

  afterEach(() => {
    window.location.hash = "";
    vi.unstubAllGlobals();
  });

  it("sube al inicio al entrar a una ruta con un clic", () => {
    render(<ScrollToTopOnLoading />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("no toca el scroll al volver atrás", () => {
    fireEvent.popState(window);

    render(<ScrollToTopOnLoading />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("vuelve a subir en la siguiente navegación después de volver atrás", () => {
    fireEvent.popState(window);
    fireEvent.click(document.body);

    render(<ScrollToTopOnLoading />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("lleva al ancla cuando existe, una sola vez", () => {
    window.location.hash = "#catalogo";
    const target = document.createElement("div");
    target.id = "catalogo";
    target.scrollIntoView = vi.fn();
    document.body.append(target);

    render(<ScrollToTopOnLoading />);
    expect(scrollTo).not.toHaveBeenCalled();

    render(<ScrollToPendingAnchor />);
    render(<ScrollToPendingAnchor />);
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);

    target.remove();
  });

  it("no mueve la página a un ancla al volver atrás", () => {
    window.location.hash = "#catalogo";
    const target = document.createElement("div");
    target.id = "catalogo";
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    fireEvent.popState(window);

    render(<ScrollToTopOnLoading />);
    render(<ScrollToPendingAnchor />);

    expect(target.scrollIntoView).not.toHaveBeenCalled();
    target.remove();
  });
});
