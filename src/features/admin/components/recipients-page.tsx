"use client";

import { AdminPageHeader } from "./admin-shell";
import { IdentityReviewQueue } from "./identity-review-queue";

/** Destinatarios: los IDs de Fortnite a los que se envían regalos y su espera de 48 horas. */
export function RecipientsPage() {
  return <>
    <AdminPageHeader title="Destinatarios" lead="Los IDs que piden los clientes, su solicitud de amistad y la espera de 48 horas." />
    <div className="ac-legacy"><IdentityReviewQueue /></div>
  </>;
}
