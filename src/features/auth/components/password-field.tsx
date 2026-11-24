"use client";

import { useId, useState } from "react";
import styles from "./password-field.module.css";

export function PasswordField({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.control}>
      <input id={id} type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      <button type="button" aria-controls={id} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled} onClick={() => setVisible((current) => !current)}>{visible ? "Ocultar" : "Mostrar"}</button>
    </div>
  </div>;
}
