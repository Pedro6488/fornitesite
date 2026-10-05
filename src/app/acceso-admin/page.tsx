import { AccountAccess } from "@/features/auth/components/account-access";

export default function AdminAccessPage() {
  return <section className="flow-shell"><div className="flow-heading"><p className="eyebrow">ADMINISTRACIÓN</p><h1>Acceso al panel.</h1><p>Inicia sesión con uno de los correos autorizados para administrar pedidos, transferencias y precios.</p></div><AccountAccess nextPath="/admin" adminAccess /></section>;
}
