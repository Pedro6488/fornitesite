import { AccountAccess } from "@/features/auth/components/account-access";

export default function AccountPage() {
  return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">TU CUENTA</p><h1>Seguimiento sin contraseñas.</h1><p>Entra mediante un enlace enviado a tu correo.</p></div><AccountAccess /></section>;
}
