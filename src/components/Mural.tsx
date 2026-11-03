"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MENSAJES } from "@/datos/mensajes";
import { UNIVERSIDADES } from "@/datos/universidades";
import { convertir, notasDe, type Conversion } from "@/lib/conversion";
import { construirMapa, type Mapa } from "@/lib/mapa";
import { destino, lugarDesde } from "@/lib/oyente";
import { AQUI, Sonido, tocarDia, tocarMensaje } from "@/lib/sonido";
import type { Mensaje, Punto, Universidad } from "@/lib/tipos";

const BPM = [84, 120]; // del primer día a hoy: cuanto más cerca de hoy, más rápido
const MAX_MENSAJE = 140;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const UNI = Object.fromEntries(UNIVERSIDADES.map((u) => [u.id, u]));
const fechaDe = (f: string) => new Date(f + "T12:00:00");
const FECHAS = [...new Set(MENSAJES.map((m) => m.fecha))].sort();
const HOY = FECHAS[FECHAS.length - 1];

type Item = { m: Mensaje; uni: Universidad; conv: Conversion; lugar: ReturnType<typeof lugarDesde> };

// cada mensaje se ubica respecto de quien escucha, y cada día queda del más cercano al más lejano
function armarDias(oyente: Universidad, propios: Mensaje[]) {
  const todos = [...MENSAJES, ...propios];
  return FECHAS.map((fecha, d) => {
    const items = todos.filter((m) => m.fecha === fecha && UNI[m.universidad])
      .map((m): Item => ({ m, uni: UNI[m.universidad], conv: convertir(m.texto), lugar: lugarDesde(oyente, UNI[m.universidad]) }))
      .sort((a, b) => a.lugar.km - b.lugar.km);
    const bpm = Math.round(BPM[0] + (BPM[1] - BPM[0]) * (FECHAS.length > 1 ? d / (FECHAS.length - 1) : 1));
    return { fecha, items, bpm, cifras: notasDe(items.map((x) => x.conv)) };
  });
}

type Agenda = { item: Item; inicio: number; palabras: { k: number; t: number; fin: number; pulsado?: boolean }[]; cierre: number; fin: number };
type Rep = { agenda: Agenda[]; inicio: number; fin: number; salio?: boolean };
type Pulso = { id: number; x: number; y: number; clase: string };
type Ahora = { item: Item; k: number; enCierre: boolean } | null;

// la onda de un día sale de ti al empezar y llega a cada universidad justo cuando empieza su mensaje;
// después del último sigue de largo y se apaga
function ondaEn(rep: Rep, t: number) {
  if (!rep.agenda.length || t < rep.inicio || t >= rep.fin) return null;
  const pts: [number, number][] = [[rep.inicio, 0], ...rep.agenda.map((a): [number, number] => [a.inicio, a.item.lugar.km])];
  const [tu, ku] = pts[pts.length - 1];
  pts.push([rep.fin, ku + 600]);
  for (let j = 1; j < pts.length; j++) {
    if (t >= pts[j][0]) continue;
    const [ta, ka] = pts[j - 1], [tb, kb] = pts[j];
    return { km: ka + ((kb - ka) * (t - ta)) / Math.max(1e-6, tb - ta), opacidad: t <= tu ? 1 : 1 - (t - tu) / (rep.fin - tu) };
  }
  return null;
}

function circuloGeo(mapa: Mapa, c: Punto, km: number) {
  let d = "";
  for (let b = 0; b < 360; b += 4) {
    const [x, y] = mapa.aPantalla(destino(c, b, km));
    d += (b ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
  }
  return d + "Z";
}

function TextoConClaves({ item, activa }: { item: Item; activa: number }) {
  let k = 0;
  return item.m.texto.split(/(\p{L}+)/u).map((parte, j) => {
    if (k < item.conv.claves.length && parte.toLowerCase().normalize("NFC") === item.conv.claves[k]) {
      const n = k++;
      return <span key={j} className={"clave" + (n === activa ? " activa" : "")}>{parte}</span>;
    }
    return parte;
  });
}

const IconoPlay = () => <svg className="icono play" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.5 6z" fill="currentColor" /></svg>;
const IconoPausa = () => <svg className="icono" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" fill="currentColor" /></svg>;

export default function Mural() {
  const [oyente, setOyente] = useState<Universidad>(UNI.utec);
  const [propios, setPropios] = useState<Mensaje[]>([]);
  const [diaSel, setDiaSel] = useState(FECHAS.length - 1);
  const [ahora, setAhora] = useState<Ahora>(null);
  const [pausado, setPausado] = useState(false);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [alcanzadas, setAlcanzadas] = useState<string[]>([]);
  const [pulsos, setPulsos] = useState<Pulso[]>([]);
  const [modal, setModal] = useState(false);
  const [borrador, setBorrador] = useState("");

  const dias = useMemo(() => armarDias(oyente, propios), [oyente, propios]);
  const dia = dias[diaSel];
  const mapa = useMemo(() => (tam ? construirMapa(tam.w, tam.h) : null), [tam]);

  const svgRef = useRef<SVGSVGElement>(null);
  const zonaRef = useRef<HTMLElement>(null);
  const burbujaRef = useRef<HTMLDivElement>(null);
  const ondaRef = useRef<SVGGElement>(null);
  const sonidoRef = useRef<Sonido | null>(null);
  const repRef = useRef<Rep | null>(null);
  const pulsoId = useRef(0);
  const ctxRef = useRef({ mapa, oyente });
  useEffect(() => { ctxRef.current = { mapa, oyente }; });

  const detener = useCallback(() => {
    sonidoRef.current?.detener();
    repRef.current = null;
    setAhora(null);
    setPausado(false);
    setAlcanzadas([]);
    if (ondaRef.current) ondaRef.current.style.display = "none";
  }, []);

  const audio = async () => {
    sonidoRef.current ??= new Sonido();
    return sonidoRef.current.despertar();
  };

  const tocar = async (items: Item[]) => {
    detener();
    const t = await audio();
    repRef.current = tocarDia(sonidoRef.current!, { ...dia, items }, t);
  };

  const pausar = () => {
    (sonidoRef.current?.ctx as AudioContext | undefined)?.suspend();
    setPausado(true);
  };
  const seguir = () => {
    (sonidoRef.current?.ctx as AudioContext | undefined)?.resume();
    setPausado(false);
  };

  const elegirDia = (d: number) => { detener(); setDiaSel(d); };
  const elegirOyente = (id: string) => { detener(); setOyente(UNI[id]); };

  const escucharBorrador = async () => {
    detener();
    const t = await audio();
    tocarMensaje(sonidoRef.current!, convertir(borrador), t + 0.1, dia.bpm, AQUI);
  };
  const cerrarModal = () => { detener(); setModal(false); setBorrador(""); };
  const enviar = () => {
    const texto = borrador.trim();
    if (!texto) return;
    setPropios((l) => [...l, { fecha: HOY, universidad: oyente.id, texto }]);
    setDiaSel(FECHAS.length - 1);
    cerrarModal();
  };

  // el reloj de la obra: sincroniza la imagen con el audio ya programado
  useEffect(() => {
    let raf = 0, clave = "";
    const cuadro = () => {
      raf = requestAnimationFrame(cuadro);
      const s = sonidoRef.current, rep = repRef.current, g = ondaRef.current, { mapa, oyente } = ctxRef.current;
      if (!s || !rep) { clave = ""; return; }
      const t = s.ahora, onda = ondaEn(rep, t);
      if (g && mapa) {
        g.style.display = onda && onda.km >= 2 ? "" : "none";
        if (onda && onda.km >= 2) {
          // tres aros: el frente y dos ecos que lo siguen, cada vez más tenues
          Array.from(g.children).forEach((aro, j) => {
            aro.setAttribute("d", circuloGeo(mapa, oyente, onda.km * (1 - 0.07 * j)));
            (aro as SVGElement).style.opacity = (onda.opacidad * [0.85, 0.35, 0.15][j]).toFixed(3);
          });
        }
      }
      const punto = (id: string, clase: string) => {
        const u = mapa?.universidades.find((v) => v.u.id === id);
        if (u) setPulsos((l) => [...l, { id: ++pulsoId.current, x: u.x, y: u.y, clase }]);
      };
      if (!rep.salio && t >= rep.inicio) { rep.salio = true; punto(oyente.id, "pulso-onda"); }
      for (const a of rep.agenda) for (const x of a.palabras) if (!x.pulsado && t >= x.t) { x.pulsado = true; punto(a.item.uni.id, "pulso"); }
      const llegadas = rep.agenda.filter((a) => t >= a.inicio).map((a) => a.item.uni.id);
      setAlcanzadas((l) => (l.join() === llegadas.join() ? l : llegadas));
      const actual = rep.agenda.find((a) => t >= a.inicio && t < a.fin) ?? null;
      const k = actual?.palabras.find((p) => t >= p.t && t < p.fin)?.k ?? -1;
      const enCierre = !!actual && t >= actual.cierre;
      const nueva = actual ? `${actual.inicio}|${k}|${enCierre}` : "";
      if (nueva !== clave) { clave = nueva; setAhora(actual ? { item: actual.item, k, enCierre } : null); }
      if (t > rep.fin + 0.2) {
        s.fondo([], t);
        repRef.current = null;
        clave = "";
        setAhora(null);
        setAlcanzadas([]);
        if (g) g.style.display = "none";
      }
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const obs = new ResizeObserver(() => { if (svg.clientWidth && svg.clientHeight) setTam({ w: svg.clientWidth, h: svg.clientHeight }); });
    obs.observe(svg);
    return () => obs.disconnect();
  }, []);

  // la burbuja se coloca sobre su universidad, ya medida
  const burbujaItem = ahora?.item;
  useLayoutEffect(() => {
    const b = burbujaRef.current, z = zonaRef.current;
    const p = burbujaItem && mapa?.universidades.find((v) => v.u.id === burbujaItem.uni.id);
    if (!b || !z || !p) return;
    const y = p.y - b.offsetHeight - 22;
    b.style.left = clamp(p.x - b.offsetWidth / 2, 10, z.clientWidth - b.offsetWidth - 10) + "px";
    b.style.top = (y > 10 ? y : p.y + 22) + "px";
  }, [burbujaItem, mapa]);

  // la onda sale del punto dibujado de la universidad (las de Lima se separan un poco en el mapa)
  const posTu = mapa?.universidades.find((v) => v.u.id === oyente.id);
  const real = mapa?.aPantalla(oyente);
  const desfase = posTu && real ? `translate(${(posTu.x - real[0]).toFixed(1)},${(posTu.y - real[1]).toFixed(1)})` : undefined;

  return (
    <div className="app">
      <section className="mapa-zona" ref={zonaRef} aria-label="Mapa de universidades del Perú">
        <svg ref={svgRef} className="mapa" role="img" viewBox={tam ? `0 0 ${tam.w} ${tam.h}` : undefined} aria-label="Mapa del Perú con sus universidades">
          {mapa && <>
            {mapa.paises.filter((p) => p.cc === "PE").map((p) => <path key={p.cc} d={p.d} fillRule="evenodd" className="pais" />)}
            <text className="peru" x={tam!.w - 24} y={34} textAnchor="end">PERÚ</text>
            <g ref={ondaRef} className="onda" transform={desfase} style={{ display: "none" }}><path /><path /><path /></g>
            {pulsos.map((p) => (
              <g key={p.id} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}>
                <circle r={6} className={p.clase} onAnimationEnd={() => setPulsos((l) => l.filter((x) => x.id !== p.id))} />
              </g>
            ))}
            {mapa.universidades.map(({ u, x, y }) => (
              <g key={u.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className={"uni" + (ahora?.item.uni.id === u.id ? " activa" : "") + (u.id === oyente.id ? " oyente" : "") + (alcanzadas.includes(u.id) ? " alcanzada" : "")}>
                <circle className="uni-halo" r={11} />
                <circle className="uni-luz" r={4} />
                <text className="uni-texto" x={u.etiqueta === "izq" ? -10 : 10} y={4} textAnchor={u.etiqueta === "izq" ? "end" : "start"}>{u.nombre}</text>
                <title>{`${u.completo} · ${u.ciudad}`}</title>
              </g>
            ))}
          </>}
        </svg>
        {ahora && (
          <div className="burbuja" ref={burbujaRef}>
            <div className="quien">{ahora.item.uni.nombre} · {ahora.item.uni.ciudad}</div>
            <div className="que">“<TextoConClaves item={ahora.item} activa={ahora.enCierre ? -1 : ahora.k} />”</div>
          </div>
        )}
      </section>

      <aside className="panel">
        <h1>Sol sostenido <span>♯</span></h1>
        <label className="desde">
          Escuchas desde:{" "}
          <select value={oyente.id} onChange={(e) => elegirOyente(e.target.value)}>
            {UNIVERSIDADES.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
        <div className="acciones">
          <button className="boton" type="button" onClick={() => tocar(dia.items)}><IconoPlay /> Escuchar</button>
          <button className="boton suave" type="button" onClick={() => { detener(); setModal(true); }}>+ Escribir</button>
        </div>
        <h2>Mensajes del {fechaDe(dia.fecha).toLocaleDateString("es-PE", { day: "numeric", month: "long" })}:</h2>
        <div className="tarjetas">
          {dia.items.map((item, n) => {
            const suena = ahora?.item.m === item.m;
            return (
              <article key={n} className={"tarjeta" + (suena ? " sonando" : "")}>
                <b>{item.uni.nombre} · {item.uni.ciudad}</b>
                <p>“{item.m.texto}”</p>
                <div className="botones">
                  <button type="button" onClick={() => (suena && pausado ? seguir() : tocar([item]))}><IconoPlay /> Escuchar</button>
                  <button type="button" disabled={!suena || pausado} onClick={pausar}><IconoPausa /> Pausa</button>
                </div>
              </article>
            );
          })}
        </div>
      </aside>

      <footer className="pie">
        <nav className="dias" aria-label="Días">
          {dias.map((d, n) => (
            <button key={d.fecha} type="button" className={"dia" + (n === diaSel ? " sel" : "")} onClick={() => elegirDia(n)}>
              <b>{+d.fecha.slice(8)}</b>
              {fechaDe(d.fecha).toLocaleDateString("es-PE", { month: "short" }).replace(".", "")}
            </button>
          ))}
        </nav>
        <b className="hoy">hoy</b>
        <span className="linea">Línea 113, opción 5</span>
      </footer>

      {modal && (
        <div className="velo">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
            <header>
              <h2 id="modal-titulo">Escribe un mensaje de apoyo</h2>
              <button type="button" aria-label="Cerrar" onClick={cerrarModal}>×</button>
            </header>
            <p className="desde">Desde: <b>{oyente.nombre}</b> · {oyente.ciudad} · Nombre: <i>anónimo</i></p>
            <div className="campo">
              <textarea autoFocus maxLength={MAX_MENSAJE} value={borrador} onChange={(e) => setBorrador(e.target.value)}
                aria-label="Tu mensaje" placeholder="Escribe algo que te hubiera gustado leer en un día difícil…" />
              <small>{borrador.length} / {MAX_MENSAJE}</small>
            </div>
            <button className="boton suave" type="button" disabled={!borrador.trim()} onClick={escucharBorrador}><IconoPlay /> Escuchar cómo suena</button>
            <div className="fin">
              <button className="boton suave" type="button" onClick={cerrarModal}>Cancelar</button>
              <button className="boton" type="button" disabled={!borrador.trim()} onClick={enviar}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
