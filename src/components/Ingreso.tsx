"use client";

import { useState } from "react";
import { BotonTema } from "@/components/BotonTema";
import { UNIVERSIDADES } from "@/datos/universidades";

export type Perfil = { universidad: string; nombre?: string };

const CLAVE = "sol-sostenido.perfil";
const LARGO_NOMBRE = 40;

// el último ingreso se guarda en este navegador solo para rellenar el formulario la próxima vez
export function leerPerfil(): Perfil | null {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    return p && UNIVERSIDADES.some((u) => u.id === p.universidad) ? p : null;
  } catch {
    return null;
  }
}

export function guardarPerfil(p: Perfil | null) {
  try {
    if (p) localStorage.setItem(CLAVE, JSON.stringify(p));
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento */ }
}

const ORDENADAS = [...UNIVERSIDADES].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export function Ingreso({ alEntrar, inicial }: { alEntrar: (p: Perfil) => void; inicial?: Perfil | null }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [universidad, setUniversidad] = useState(inicial?.universidad ?? "");

  const entrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!universidad) return;
    const limpio = nombre.trim();
    alEntrar({ universidad, ...(limpio ? { nombre: limpio } : {}) });
  };

  return (
    <main className="ingreso">
      <BotonTema />
      <form className="ingreso-caja" onSubmit={entrar}>
        <h1>Sol sostenido <span>♯</span></h1>
        <p className="subtitulo">Un mural sonoro de apoyo entre universidades del Perú</p>

        <label className="etiqueta" htmlFor="nombre">Nombre <small>(opcional)</small></label>
        <input id="nombre" value={nombre} maxLength={LARGO_NOMBRE} autoComplete="given-name"
          placeholder="¿Cómo te llamas?" onChange={(e) => setNombre(e.target.value)} />
        <p className="ayuda">Si lo dejas vacío, tus mensajes serán anónimos.</p>

        <label className="etiqueta" htmlFor="universidad">Universidad</label>
        <select id="universidad" required value={universidad} onChange={(e) => setUniversidad(e.target.value)}>
          <option value="" disabled>Elige tu universidad</option>
          {ORDENADAS.map((u) => <option key={u.id} value={u.id}>{u.nombre} · {u.ciudad}</option>)}
        </select>
        <p className="ayuda">Tus mensajes aparecerán en el mapa desde aquí.</p>

        <button className="boton" type="submit" disabled={!universidad}>Entrar</button>
      </form>
      <p className="linea">¿Necesitas hablar con alguien? Línea 113, opción 5</p>
    </main>
  );
}
