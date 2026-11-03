"use client";

import dynamic from "next/dynamic";

// solo en el navegador: usa Web Audio y carga el tokenizador (2 MB)
export const MuralCliente = dynamic(() => import("./Mural"), {
  ssr: false,
  loading: () => <p className="cargando">Afinando el mural…</p>,
});
