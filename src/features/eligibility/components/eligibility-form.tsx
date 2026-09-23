"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type EligibilityResponse = {
  receiver: { epicAccountId: string; displayName: string };
  agents: Array<{ agent: { id: string; publicAlias: string; vbucksBalance: number; giftsUsed: number; giftsLimit: number }; available: boolean; reason: string }>;
  canContinue: boolean;
  canAddFriend: boolean;
};

export function EligibilityForm({ itemId, requiredVbucks }: { itemId: string; requiredVbucks: number }) {
  const router = useRouter();
  const [result, setResult] = useState<EligibilityResponse | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [platform, setPlatform] = useState("epic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    const response = await fetch("/api/eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, platform, requiredVbucks })
    });
    const body = await response.json(); setLoading(false);
    if (!response.ok) { setError(body.error ?? "No fue posible validar la cuenta."); return; }
    setResult(body);
  }

  async function addFriend() {
    if (!result) return;
    setLoading(true); setError(null);
    const response = await fetch("/api/eligibility/friend-request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epicAccountId: result.receiver.epicAccountId })
    });
    setLoading(false);
    if (!response.ok) { const body = await response.json(); setError(body.error); return; }
    setError("Solicitud enviada. Acéptala en Fortnite para iniciar las 48 horas.");
  }

  function continueToCheckout() {
    if (!result) return;
    const params = new URLSearchParams({ item: itemId, receiver: result.receiver.displayName, receiverId: result.receiver.epicAccountId });
    router.push(`/checkout?${params.toString()}`);
  }

  return (
    <div className="validation-panel">
      <form className="validation-form" onSubmit={validate}>
        <label>Epic ID o gamertag<input required minLength={3} maxLength={32} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu nombre en Fortnite" /></label>
        <label>Plataforma<select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="epic">Epic Games</option><option value="psn">PlayStation</option><option value="xbl">Xbox</option><option value="nintendo">Nintendo</option></select></label>
        <button className="primary-button" disabled={loading}>{loading ? "Validando…" : "Validar ID"}</button>
      </form>
      {error && <p className={error.startsWith("Solicitud") ? "notice success" : "notice error"}>{error}</p>}
      {result && <div className="agent-section">
        <div className="section-heading"><div><p className="eyebrow">CUENTAS DE ENTREGA</p><h2>{result.receiver.displayName}</h2></div><p>Asignación automática y anónima.</p></div>
        <div className="agent-grid">{result.agents.map(({ agent, available, reason }) => <article className={`agent-card ${available ? "available" : ""}`} key={agent.id}><div><span>{agent.publicAlias}</span><strong>{agent.giftsUsed}/{agent.giftsLimit}</strong></div><p>◉ {agent.vbucksBalance.toLocaleString("es-MX")} paVos</p><small>{reason}</small></article>)}</div>
        {result.canContinue ? <button className="primary-button" onClick={continueToCheckout}>Continuar con agente disponible</button> : result.canAddFriend ? <button className="secondary-button" onClick={addFriend} disabled={loading}>Agregarme al pool</button> : <p className="notice">Todavía no hay un agente listo. Vuelve a consultar cuando termine la espera.</p>}
      </div>}
    </div>
  );
}
