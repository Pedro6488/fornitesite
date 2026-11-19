import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletPanel } from "./wallet-panel";
import { fromSlider, toSlider } from "./wallet-calculator";
const slide = (amount: number) => ({ target:{ value:String(toSlider(amount)) } });
const state = vi.hoisted(() => ({ authenticated:true,active:true,request:vi.fn(),reload:vi.fn(),tiers:[] as unknown[],bonuses:[] as unknown[],topups:[] as unknown[],balance:1500 }));
vi.mock("@/features/commerce/components/commerce-state-provider",() => ({ useCommerceState:() => ({ ready:true,authenticated:state.authenticated,sessionId:"session" }) }));
vi.mock("./use-wallet",() => ({ walletRequest:state.request,useWallet:() => ({ error:null,reload:state.reload,data:state.authenticated ? { balance:state.balance,topups:state.topups,paymentDetails:{ name:"Banco",beneficiary:"Tienda",clabe:"012",paypal:"pay@example.com" },movements:[],tiers:state.tiers,bonuses:state.bonuses,rates:[{ region:"mx",active:state.active,cents_per_100:500 }] } : null }) }));
describe("compra de pavos",() => {
  beforeEach(() => { vi.clearAllMocks(); state.authenticated=true; state.active=true; state.tiers=[]; state.bonuses=[]; state.topups=[]; state.balance=1500; state.request.mockResolvedValue({}); });
  it("muestra el tramo, el regalo y sugiere subir al siguiente escalón; envía el regalo esperado",async () => {
    state.tiers=[{ id:"t5",region:"mx",min_vbucks:5000,cents_per_100:450 }];
    state.bonuses=[{ id:"b1",region:"mx",label:"Noviembre +5%",min_vbucks:5000,bonus_bp:500,bonus_cap:null,first_topup_only:false,ends_at:"2099-11-30T23:00:00Z" }];
    render(<WalletPanel />);
    fireEvent.change(screen.getByRole("slider"),slide(4500));
    expect(screen.getByText(/Agrega/)).toHaveTextContent("Agrega 500 pavos y recibes +250 de regalo");
    expect(screen.getByText("Noviembre +5%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{ name:"Subir a 5,000" }));
    expect(screen.getByText(/5,000 \+ 250 de regalo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{ name:"Comprar 5,000 pavos" }));
    await waitFor(() => expect(state.request).toHaveBeenCalled());
    expect(JSON.parse(state.request.mock.calls[0][1].body)).toMatchObject({ vbucks:5000,expectedCents:22500,expectedBonus:250 });
  });
  it("muestra el saldo y permite elegir la cantidad antes de crear la recarga",async () => {
    render(<WalletPanel />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"),slide(5000));
    fireEvent.click(screen.getByRole("button",{ name:"Comprar 5,000 pavos" }));
    await waitFor(() => expect(state.request).toHaveBeenCalled());
    const body=JSON.parse(state.request.mock.calls[0][1].body);
    expect(body).toMatchObject({ region:"mx",vbucks:5000,expectedCents:25000 });
  });
  it("no permite comprar recargas con precios aún sin definir",() => {
    state.active=false; render(<WalletPanel />);
    expect(screen.getByText("Precio por definir")).toBeInTheDocument();
    expect(screen.getByRole("button",{ name:"Comprar 3,500 pavos" })).toBeDisabled();
  });
  it("explica los pavos a un visitante, le deja calcular con precios reales y le pide cuenta para comprar",() => {
    state.authenticated=false;
    render(<WalletPanel offers={{ rates:[{ region:"mx",active:true,cents_per_100:750 }],tiers:[{ id:"t5",region:"mx",min_vbucks:5000,cents_per_100:700 }],bonuses:[] }} />);
    expect(screen.getByRole("heading",{ level:1 })).toHaveTextContent("RECARGA UNA VEZ.COMPRA AL INSTANTE.");
    expect(screen.getByRole("heading",{ name:"Con pavos" })).toBeInTheDocument();
    expect(screen.getByText(/por cada 100 pavos/)).toHaveTextContent("desde $7.00");
    fireEvent.change(screen.getByRole("slider"),slide(5000));
    expect(screen.getByText(/^Pagas por/).parentElement).toHaveTextContent("$350.00 MXN");
    expect(screen.getByText(/^Recibes/).parentElement).toHaveTextContent("5,000");
    expect(screen.getByRole("link",{ name:"Inicia sesión para comprar" })).toHaveAttribute("href",`/cuenta?next=${encodeURIComponent("/pavos?cantidad=5000#recargar")}`);
    expect(screen.getAllByRole("link",{ name:/Crear cuenta y recargar/ })[0]).toHaveAttribute("href","/cuenta?mode=register&next=/pavos");
    expect(screen.queryByRole("button",{ name:/^Comprar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading",{ name:"Lo que nunca te pedimos" })).toBeInTheDocument();
  });
  it("marca el siguiente paso: con una recarga pendiente muestra la referencia y el comprobante arriba",() => {
    state.balance=0;
    state.topups=[{ id:"abcdef12-0000-0000-0000-000000000000",user_id:"u",vbucks:1000,region:"mx",amount_cents:5000,status:"awaiting_payment",review_note:null,created_at:"2026-11-18T10:00:00Z",expires_at:"2099-01-01T00:00:00Z",reference_code:"RECARGA-ABCDEF12" }];
    render(<WalletPanel />);
    expect(screen.getByRole("heading",{ name:/PAGA Y SUBE TU COMPROBANTE/ })).toBeInTheDocument();
    expect(screen.getByText("Paga y sube tu comprobante").closest("li")).toHaveAttribute("aria-current","step");
    expect(screen.getAllByText("RECARGA-ABCDEF12").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Comprobante de la recarga")).toBeInTheDocument();
  });
  it("con saldo, invita a usar los pavos",() => {
    render(<WalletPanel />);
    expect(screen.getByRole("heading",{ name:/LISTO PARA COMPRAR/ })).toBeInTheDocument();
    expect(screen.getByRole("link",{ name:"Usar mis pavos" })).toHaveAttribute("href","/fortnite#catalogo");
  });
});

describe("cantidad desde la portada",() => {
  it("abre /pavos con la cantidad elegida y permite ajustarla con los botones",() => {
    state.authenticated=true; state.active=true; state.tiers=[]; state.bonuses=[]; state.topups=[]; state.balance=0;
    render(<WalletPanel initialAmount={13500} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext","13,500 pavos");
    fireEvent.click(screen.getByRole("button",{ name:"Agregar 500 pavos" }));
    expect(screen.getByRole("button",{ name:"Comprar 14,000 pavos" })).toBeEnabled();
  });
});

describe("escala de la barra",() => {
  it("ida y vuelta exacta en múltiplos de 100 y más recorrido para recargas chicas",() => {
    for (const amount of [100,1000,2800,4500,5000,13500,50000]) expect(fromSlider(toSlider(amount))).toBe(amount);
    expect(toSlider(13500)).toBeGreaterThan(500);
  });
});
