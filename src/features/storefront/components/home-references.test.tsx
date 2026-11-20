import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeReferences } from "./home-references";

const references = ["Ana", "Luis"].map((recipientName) => ({ recipientName, comment: `Gracias de ${recipientName}`, createdAt: "2026-11-16T12:00:00Z", imageUrls: [], items: [{ item_name: "Atuendo", quantity: 1 }] }));

describe("HomeReferences", () => {
  afterEach(() => vi.useRealTimers());
  it("advances automatically, wraps, and resumes after manual navigation", () => {
    vi.useFakeTimers();
    render(<HomeReferences references={references} unavailable={false} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente referencia" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pausar carrusel" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reanudar carrusel" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });
  it("navigates references and wraps in both directions", () => {
    render(<HomeReferences references={references} unavailable={false} />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Referencia anterior" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente referencia" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("shows an honest empty state without invented references", () => {
    render(<HomeReferences references={[]} unavailable={false} />);
    expect(screen.getByText("Pronto verás aquí las referencias")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
