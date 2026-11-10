"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MENSAJES } from "@/datos/mensajes";
import { UNIVERSIDADES } from "@/datos/universidades";
import { API, diasHasta, enviarMensaje, hoyPeru, traerMensajes } from "@/lib/api";
import { BotonTema } from "@/components/BotonTema";
import { guardarPerfil, Ingreso, leerPerfil, type Perfil } from "@/components/Ingreso";
import { convertir, notasDe, type Conversion } from "@/lib/conversion";
import { construirMapa, type Mapa } from "@/lib/mapa";
import { destino, lugarDesde } from "@/lib/oyente";
import { AQUI, Sonido, tocarDia, tocarMensaje } from "@/lib/sonido";
import type { Mensaje, Punto, Tipo, Universidad } from "@/lib/tipos";

const BPM = [84, 120]; // del primer día a hoy: cuanto más cerca de hoy, más rápido
// cada tipo de mensaje tiene su título, su invitación y su largo (igual que en el Worker)
const TIPOS = {
  apoyo: { titulo: "Escribe un mensaje de apoyo", boton: "Mensaje de apoyo", max: 140,
    invitacion: "Escribe algo que te hubiera gustado leer en un día difícil…" },
  testimonio: { titulo: "Comparte tu testimonio", boton: "Testimonio", max: 280,
    invitacion: "Cuenta un momento difícil que superaste y qué te ayudó a salir adelante…" },
} as const;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const UNI = Object.fromEntries(UNIVERSIDADES.map((u) => [u.id, u]));
const fechaDe = (f: string) => new Date(f + "T12:00:00");
const N_DIAS = 15;
// con API: los últimos 15 días hasta hoy (en Perú); sin API: las fechas de los mensajes de ejemplo
const FECHAS = API ? diasHasta(hoyPeru(), N_DIAS) : [...new Set(MENSAJES.map((m) => m.fecha))].sort();
const HOY = FECHAS[FECHAS.length - 1];

type Item = { m: Mensaje; uni: Universidad; conv: Conversion; lugar: ReturnType<typeof lugarDesde> };
type Carga = "cargando" | "lista" | "error";

// cada mensaje se ubica respecto de quien escucha, y cada día queda del más cercano al más lejano
function armarDias(oyente: Universidad, todos: Mensaje[]) {
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

function TextoConClaves({ texto, claves, activa }: { texto: string; claves: string[]; activa: number }) {
  let k = 0;
  return texto.split(/(\p{L}+)/u).map((parte, j) => {
    if (k < claves.length && parte.toLowerCase().normalize("NFC") === claves[k]) {
      const n = k++;
      return <span key={j} className={"clave" + (n === activa ? " activa" : "")}>{parte}</span>;
    }
    return parte;
  });
}

const IconoPlay = () => <svg className="icono play" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.5 6z" fill="currentColor" /></svg>;
const IconoPausa = () => <svg className="icono" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" fill="currentColor" /></svg>;

// siempre se entra por el ingreso; trae rellenados el nombre y la universidad de la última vez
export default function Mural() {
  const [ultimo] = useState<Perfil | null>(leerPerfil);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [editando, setEditando] = useState(false);
  if (!perfil || editando) {
    return <Ingreso inicial={perfil ?? ultimo} alEntrar={(p) => { guardarPerfil(p); setPerfil(p); setEditando(false); }} />;
  }
  return <MuralSonoro key={perfil.universidad} perfil={perfil} alCambiar={() => setEditando(true)} />;
}

function MuralSonoro({ perfil, alCambiar }: { perfil: Perfil; alCambiar: () => void }) {
  const autor = UNI[perfil.universidad];
  const [oyente, setOyente] = useState<Universidad>(autor);
  const [mensajes, setMensajes] = useState<Mensaje[]>(API ? [] : MENSAJES);
  const [carga, setCarga] = useState<Carga>(API ? "cargando" : "lista");
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState(FECHAS.length - 1);
  const [ahora, setAhora] = useState<Ahora>(null);
  const [pausado, setPausado] = useState(false);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [alcanzadas, setAlcanzadas] = useState<string[]>([]);
  const [pulsos, setPulsos] = useState<Pulso[]>([]);
  const [modal, setModal] = useState(false);
  const [borrador, setBorrador] = useState("");
  // si coincide con el secreto del Worker, el mensaje se publica sin revisión; nunca se guarda en el código
  const [clave, setClave] = useState("");
  const [tipo, setTipo] = useState<Tipo>("apoyo");
  const T = TIPOS[tipo];

  const dias = useMemo(() => armarDias(oyente, mensajes), [oyente, mensajes]);

  useEffect(() => {
    if (!API) return;
    traerMensajes(FECHAS[0], HOY)
      .then((m) => { setMensajes(m); setCarga("lista"); })
      .catch(() => setCarga("error"));
  }, []);
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

  // vista previa del borrador: qué palabra suena mientras se escucha (-1: ninguna)
  const [previaK, setPreviaK] = useState(-1);
  const previaId = useRef(0);
  const fondoRef = useRef<HTMLDivElement>(null);
  const convBorrador = useMemo(() => convertir(borrador), [borrador]);

  const detener = useCallback(() => {
    sonidoRef.current?.detener();
    previaId.current++;
    setPreviaK(-1);
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
    const id = previaId.current;
    const t = await audio();
    const r = tocarMensaje(sonidoRef.current!, convBorrador, t + 0.1, dia.bpm, AQUI);
    // subraya la palabra que suena, siguiendo el reloj del audio
    const cuadro = () => {
      if (previaId.current !== id) return;
      const ahora = sonidoRef.current!.ahora;
      setPreviaK(r.palabras.find((p) => ahora >= p.t && ahora < p.fin)?.k ?? -1);
      if (ahora < r.fin) requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  };
  const cerrarModal = () => { detener(); setModal(false); setBorrador(""); setErrorEnvio(null); setTipo("apoyo"); };
  const enviar = async () => {
    const texto = borrador.trim();
    if (!texto || enviando) return;
    if (!API) { // sin API, el mensaje solo vive en esta pestaña
      setMensajes((l) => [...l, { fecha: HOY, universidad: autor.id, tipo, texto, nombre: perfil.nombre }]);
      setDiaSel(FECHAS.length - 1);
      cerrarModal();
      return;
    }
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const r = await enviarMensaje({ universidad: autor.id, tipo, texto, nombre: perfil.nombre, codigo: clave.trim() || undefined });
      if (r.estado === "aprobado") {
        setMensajes((l) => [...l, { id: r.id, fecha: r.fecha, universidad: autor.id, tipo, texto, nombre: perfil.nombre }]);
        setDiaSel(FECHAS.length - 1);
        setAviso(null);
      } else {
        setAviso("Gracias por tu mensaje. Lo revisaremos antes de que aparezca en el mural.");
      }
      cerrarModal();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
    } finally {
      setEnviando(false);
    }
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
            {/* los países vecinos, solo de contorno, para que el Perú no flote solo */}
            {mapa.paises.filter((p) => p.cc !== "PE").map((p) => <path key={p.cc} d={p.d} fillRule="evenodd" className="vecino" />)}
            {mapa.vecinos.filter((v) => v.x > 40 && v.x < tam!.w - 40 && v.y > 20 && v.y < tam!.h - 14).map((v) => <text key={v.nombre} className="vecino-texto" x={v.x.toFixed(1)} y={v.y.toFixed(1)} textAnchor="middle">{v.nombre}</text>)}
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
          <div className={"burbuja" + (ahora.item.m.tipo === "testimonio" ? " testimonio" : "")} ref={burbujaRef}>
            <div className="quien">{ahora.item.m.tipo === "testimonio" && <span className="etiqueta-tipo">Testimonio</span>}{ahora.item.uni.nombre} · {ahora.item.uni.ciudad}</div>
            <div className="que">“<TextoConClaves texto={ahora.item.m.texto} claves={ahora.item.conv.claves} activa={ahora.enCierre ? -1 : ahora.k} />”</div>
          </div>
        )}
      </section>

      <aside className="panel">
        <div className="cabecera">
          <h1>Sol sostenido <span>♯</span></h1>
          <BotonTema />
        </div>
        <p className="desde">
          Escribes como <b>{perfil.nombre ?? "anónimo"}</b> · {autor.nombre}{" "}
          <button type="button" className="enlace" onClick={() => { detener(); alCambiar(); }}>Cambiar</button>
        </p>
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
        {aviso && <p className="aviso" role="status">{aviso}</p>}
        <h2>Mensajes del {fechaDe(dia.fecha).toLocaleDateString("es-PE", { day: "numeric", month: "long" })}:</h2>
        <div className="tarjetas">
          {carga === "cargando" && <p className="vacio">Cargando mensajes…</p>}
          {carga === "error" && <p className="vacio">No pudimos cargar los mensajes. Intenta recargar la página.</p>}
          {carga === "lista" && !dia.items.length && <p className="vacio">Aún no hay mensajes este día. ¿Escribes el primero?</p>}
          {dia.items.map((item, n) => {
            const suena = ahora?.item.m === item.m;
            return (
              <article key={item.m.id ?? n} className={"tarjeta" + (item.m.tipo === "testimonio" ? " testimonio" : "") + (suena ? " sonando" : "")}>
                {item.m.tipo === "testimonio" && <span className="etiqueta-tipo">Testimonio</span>}
                <b>{item.uni.nombre} · {item.uni.ciudad}{item.m.nombre ? ` · ${item.m.nombre}` : ""}</b>
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
        {/* línea de tiempo: el punto de cada día crece con sus mensajes; el mes se marca donde empieza */}
        <nav className="dias" aria-label="Días">
          {dias.map((d, n) => {
            const f = fechaDe(d.fecha), esHoy = n === dias.length - 1;
            const mes = n === 0 || d.fecha.slice(5, 7) !== dias[n - 1].fecha.slice(5, 7) ? f.toLocaleDateString("es-PE", { month: "long" }) : null;
            const total = d.items.length;
            return (
              <button key={d.fecha} type="button" className={"dia" + (n === diaSel ? " sel" : "") + (esHoy ? " hoy" : "")} onClick={() => elegirDia(n)}
                aria-label={`${f.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}: ${total} ${total === 1 ? "mensaje" : "mensajes"}`}
                aria-current={n === diaSel ? "date" : undefined}>
                {mes && <span className="mes">{mes}</span>}
                <span className="semana">{esHoy ? "hoy" : f.toLocaleDateString("es-PE", { weekday: "narrow" })}</span>
                <b>{+d.fecha.slice(8)}</b>
                <i className="punto" style={{ "--n": Math.min(total, 6) } as React.CSSProperties} />
              </button>
            );
          })}
        </nav>
        <span className="linea">Línea 113, opción 5</span>
      </footer>

      {modal && (
        <div className="velo">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
            <header>
              <h2 id="modal-titulo">{T.titulo}</h2>
              <button type="button" aria-label="Cerrar" onClick={cerrarModal}>×</button>
            </header>
            <div className="selector-tipo" role="radiogroup" aria-label="Tipo de mensaje">
              {(Object.keys(TIPOS) as Tipo[]).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tipo === t} className={t + (tipo === t ? " elegido" : "")}
                  onClick={() => { detener(); setTipo(t); setBorrador((b) => b.slice(0, TIPOS[t].max)); }}>{TIPOS[t].boton}</button>
              ))}
            </div>
            <p className="desde">Desde: <b>{autor.nombre}</b> · {autor.ciudad} · Nombre: {perfil.nombre ? <b>{perfil.nombre}</b> : <i>anónimo</i>}</p>
            {/* el texto con formato se dibuja detrás; el textarea queda encima, transparente, con su cursor */}
            <div className="campo">
              <div className="editor-fondo" ref={fondoRef} aria-hidden="true">
                <TextoConClaves texto={borrador} claves={convBorrador.claves} activa={previaK} />{"\n"}
              </div>
              <textarea autoFocus maxLength={T.max} value={borrador} onChange={(e) => setBorrador(e.target.value)}
                onScroll={(e) => { if (fondoRef.current) fondoRef.current.scrollTop = e.currentTarget.scrollTop; }}
                aria-label="Tu mensaje" placeholder={T.invitacion} />
              <small>{borrador.length} / {T.max}</small>
            </div>
            {tipo === "testimonio" && <p className="nota">Cuenta cómo saliste adelante; no hace falta dar detalles de lo que pasó.</p>}
            <button className="boton suave" type="button" disabled={!borrador.trim()} onClick={escucharBorrador}><IconoPlay /> Escuchar cómo suena</button>
            {API && <>
              <label className="clave-campo">
                <span>Clave <small>(opcional)</small></span>
                <input type="password" value={clave} autoComplete="off" onChange={(e) => setClave(e.target.value)} />
              </label>
              <p className="nota">Tu mensaje se revisa antes de aparecer en el mural. Con la clave correcta, se publica al instante.</p>
            </>}
            {errorEnvio && <p className="error" role="alert">{errorEnvio}</p>}
            <div className="fin">
              <button className="boton suave" type="button" onClick={cerrarModal}>Cancelar</button>
              <button className="boton" type="button" disabled={!borrador.trim() || enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
