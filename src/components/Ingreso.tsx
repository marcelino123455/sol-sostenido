"use client";

import { useId, useMemo, useState } from "react";
import { BotonTema } from "@/components/BotonTema";
import { UNIVERSIDADES } from "@/datos/universidades";
import type { Universidad } from "@/lib/tipos";

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
const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
const etiquetaDe = (u: Universidad) => `${u.nombre} · ${u.ciudad}`;

// universidad: se escribe y la lista se va acotando (sin importar tildes ni mayúsculas)
function BuscarUniversidad({ valor, alElegir }: { valor: string; alElegir: (id: string) => void }) {
  const lista = useId();
  const elegida = UNIVERSIDADES.find((u) => u.id === valor);
  const [texto, setTexto] = useState(elegida ? etiquetaDe(elegida) : "");
  const [abierta, setAbierta] = useState(false);
  const [activa, setActiva] = useState(0);

  const opciones = useMemo(() => {
    const q = sinTildes(texto);
    if (!q || (elegida && texto === etiquetaDe(elegida))) return ORDENADAS;
    return ORDENADAS.filter((u) => sinTildes(`${u.nombre} ${u.completo} ${u.ciudad}`).includes(q));
  }, [texto, elegida]);

  const elegir = (u: Universidad) => {
    alElegir(u.id);
    setTexto(etiquetaDe(u));
    setAbierta(false);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAbierta(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActiva((a) => (opciones.length ? (a + d + opciones.length) % opciones.length : 0));
    } else if (e.key === "Enter" && abierta && opciones[activa]) {
      e.preventDefault();
      elegir(opciones[activa]);
    } else if (e.key === "Escape") {
      setAbierta(false);
    }
  };

  return (
    <div className="buscador">
      <input id="universidad" role="combobox" aria-expanded={abierta} aria-controls={lista} aria-autocomplete="list"
        aria-activedescendant={abierta && opciones[activa] ? `${lista}-${opciones[activa].id}` : undefined}
        value={texto} autoComplete="off" placeholder="Escribe tu universidad o tu ciudad"
        onChange={(e) => { setTexto(e.target.value); setAbierta(true); setActiva(0); if (valor) alElegir(""); }}
        onFocus={() => setAbierta(true)} onBlur={() => setAbierta(false)} onKeyDown={teclas} />
      {abierta && (
        <ul id={lista} role="listbox" className="opciones">
          {opciones.length ? opciones.map((u, n) => (
            <li key={u.id} id={`${lista}-${u.id}`} role="option" aria-selected={u.id === valor}
              className={n === activa ? "activa" : undefined}
              onMouseDown={(e) => { e.preventDefault(); elegir(u); }} onMouseEnter={() => setActiva(n)}>
              <b>{u.nombre}</b> <span>{u.completo !== u.nombre ? u.completo + " · " : ""}{u.ciudad}</span>
            </li>
          )) : <li className="sin-resultados">No encontramos esa universidad</li>}
        </ul>
      )}
    </div>
  );
}

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
      <section className="ingreso-descripcion">
        <h1>Sol sostenido <span>♯</span></h1>
        <p className="lema">Un mural sonoro de apoyo y contención entre universidades del Perú.</p>
        <p>
          Estudiantes universitarios de todo el país se dejan mensajes de apoyo. Cada mensaje se convierte en una
          melodía alegre que suena desde su universidad en el mapa, para recordarte que, aunque no lo veas, hay
          alguien contigo.
        </p>
      </section>

      <form className="ingreso-caja" onSubmit={entrar}>
        <h2>Entra al mural</h2>

        <label className="etiqueta" htmlFor="nombre">Nombre <small>(opcional)</small></label>
        <input id="nombre" value={nombre} maxLength={LARGO_NOMBRE} autoComplete="given-name"
          placeholder="¿Cómo te llamas?" onChange={(e) => setNombre(e.target.value)} />
        <p className="ayuda">Si lo dejas vacío, tus mensajes serán anónimos.</p>

        <label className="etiqueta" htmlFor="universidad">Universidad</label>
        <BuscarUniversidad valor={universidad} alElegir={setUniversidad} />
        <p className="ayuda">Tus mensajes aparecerán en el mapa desde aquí.</p>

        <button className="boton" type="submit" disabled={!universidad}>Entrar</button>
        <p className="linea">¿Necesitas hablar con alguien? Línea 113, opción 5</p>
      </form>
    </main>
  );
}
