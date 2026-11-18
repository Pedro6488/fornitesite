import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletPanel } from "./wallet-panel";
const state = vi.hoisted(() => ({ authenticated:true,active:true,request:vi.fn(),reload:vi.fn() }));
vi.mock("@/features/commerce/components/commerce-state-provider",() => ({ useCommerceState:() => ({ ready:true,authenticated:state.authenticated,sessionId:"session" }) }));
vi.mock("./use-wallet",() => ({ walletRequest:state.request,useWallet:() => ({ error:null,reload:state.reload,data:{ balance:1500,topups:[],movements:[],rates:[{ region:"mx",active:state.active,cents_per_100:500 }] } }) }));
describe("compra de pavos",() => {
  beforeEach(() => { vi.clearAllMocks(); state.authenticated=true; state.active=true; state.request.mockResolvedValue({}); });
  it("muestra el saldo y permite elegir la cantidad antes de crear la recarga",async () => {
    render(<WalletPanel />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"),{ target:{ value:"5000" } });
    fireEvent.click(screen.getByRole("button",{ name:"Comprar pavos" }));
    await waitFor(() => expect(state.request).toHaveBeenCalled());
    const body=JSON.parse(state.request.mock.calls[0][1].body);
    expect(body).toMatchObject({ region:"mx",vbucks:5000,expectedCents:25000 });
  });
  it("no permite comprar recargas con precios aún sin definir",() => {
    state.active=false; render(<WalletPanel />);
    expect(screen.getByText("Precio por definir")).toBeInTheDocument();
    expect(screen.getByRole("button",{ name:"Comprar pavos" })).toBeDisabled();
  });
  it("pide iniciar sesión antes de comprar pavos",() => {
    state.authenticated=false; render(<WalletPanel />);
    expect(screen.getByRole("link",{ name:"Iniciar sesión" })).toHaveAttribute("href","/cuenta?next=/pavos");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});
