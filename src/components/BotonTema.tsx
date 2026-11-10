"use client";

import { useState } from "react";

type Tema = "claro" | "oscuro";
const CLAVE = "sol-sostenido.tema";

// el modo claro es el de siempre; el oscuro se elige y se recuerda en este navegador
export function BotonTema() {
  const [tema, setTema] = useState<Tema>(() => (document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro"));

  const cambiar = () => {
    const nuevo: Tema = tema === "claro" ? "oscuro" : "claro";
    document.documentElement.dataset.tema = nuevo;
    try { localStorage.setItem(CLAVE, nuevo); } catch { /* sin almacenamiento: dura hasta recargar */ }
    setTema(nuevo);
  };

  const oscuro = tema === "oscuro";
  return (
    <button type="button" className="boton-tema" onClick={cambiar} aria-pressed={oscuro}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={oscuro ? "Modo claro" : "Modo oscuro"}>
      {oscuro ? (
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" />
          <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor" /></svg>
      )}
    </button>
  );
}
