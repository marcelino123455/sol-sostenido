import { CIERRE, ESCALA, type Conversion } from "./conversion";
import type { Lugar } from "./tipos";
/*
  sonido.js · instrumentos alegres con Web Audio (sin librerías) y la programación de mensajes y días.

  - Cada palabra clave ocupa un compás de 4 corcheas: su acorde de fondo, su melodía de 4 notas con su ritmo
    y su timbre, y los adornos al final. Después de la última palabra, el mensaje cierra con un Re mayor.
  - Cada mensaje suena desde su lugar respecto de quien escucha (oyente.js): lo cercano al centro y presente,
    lo lejano más suave, con más eco y desde su lado.
  - Cada día empieza con la onda que sale de ti, y sus mensajes suenan del más cercano al más lejano.
  - El fondo de cada día son las notas de la pentatónica que usaron los mensajes de ese día, sostenidas y respirando.
*/

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const AQUI: Lugar = { pan: 0, nivel: 1, humedad: 0.3, brillo: 20000 }; // al centro, como un mensaje propio

function salaImpulso(ctx: BaseAudioContext, seg: number, caida: number) {
  const n = Math.floor(ctx.sampleRate * seg), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, caida);
  }
  return b;
}

// una nota de la pentatónica sostenida y respirando; se enciende si ese día suena en algún mensaje
class VozFondo {
  g: GainNode;
  constructor(s: Sonido, midi: number) {
    const c = s.ctx, f = mtof(midi);
    this.g = c.createGain();
    this.g.gain.value = 0;
    const respiro = c.createGain();
    respiro.gain.value = 1;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06 + Math.random() * 0.1; // un vaivén cada 6 a 16 s
    const prof = c.createGain();
    prof.gain.value = 0.4;
    lfo.connect(prof).connect(respiro.gain);
    lfo.start();
    const filtro = c.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = f * 3;
    for (const [mult, det, a] of [[1, 0, 1], [1, 7, 0.6], [2, -4, 0.18]]) {
      const o = c.createOscillator();
      o.frequency.value = f * mult;
      o.detune.value = det;
      const og = c.createGain();
      og.gain.value = a;
      o.connect(og).connect(filtro);
      o.start();
    }
    filtro.connect(this.g).connect(respiro).connect(s.busFondo);
  }
  fijar(nivel: number, t: number) {
    this.g.gain.setTargetAtTime(nivel, t, 0.7);
  }
}

export class Sonido {
  ctx: BaseAudioContext;
  vivos = new Map<AudioScheduledSourceNode, number>(); // fuente -> inicio (para cancelar lo que aún no sonó)
  salida: GainNode;
  seco: GainNode;
  envio: GainNode;
  busFondo: GainNode;
  vocesFondo: VozFondo[];
  constructor(ctx?: BaseAudioContext) { // ctx opcional: un OfflineAudioContext para medir la mezcla sin parlantes
    const c = (this.ctx = ctx || new AudioContext({ latencyHint: "interactive" }));
    this.salida = c.createGain();
    this.salida.gain.value = 1.3; // medido (render offline): un día completo queda entre -6 y -4 dBFS de pico
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    this.salida.connect(comp).connect(c.destination);
    this.seco = c.createGain();
    this.seco.connect(this.salida);
    this.envio = c.createGain();
    const sala = c.createConvolver();
    sala.buffer = salaImpulso(c, 2.2, 3.2);
    const retorno = c.createGain();
    retorno.gain.value = 0.4;
    this.envio.connect(sala).connect(retorno).connect(this.salida);
    this.busFondo = c.createGain();
    const fSeco = c.createGain(), fEnvio = c.createGain();
    fSeco.gain.value = 0.5;
    fEnvio.gain.value = 0.8;
    this.busFondo.connect(fSeco).connect(this.seco);
    this.busFondo.connect(fEnvio).connect(this.envio);
    this.vocesFondo = ESCALA.map((n) => new VozFondo(this, n.midi - 12));
  }

  get ahora() {
    return this.ctx.currentTime;
  }

  async despertar() {
    if (this.ctx instanceof AudioContext) await this.ctx.resume();
    return this.ctx.currentTime + 0.08;
  }

  registrar(nodo: AudioScheduledSourceNode, t: number) {
    this.vivos.set(nodo, t);
    nodo.onended = () => this.vivos.delete(nodo);
  }

  detener() {
    const ahora = this.ctx.currentTime;
    for (const [n, t] of this.vivos) if (t > ahora + 0.01) try { n.stop(); } catch { /* ya detenida */ }
    this.fondo([], ahora);
  }

  // dónde suena: brillo -> nivel -> paneo -> seco + eco (ver lugarDesde en oyente.js). Devuelve la entrada.
  espacio(l: Lugar = AQUI) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(l.brillo, c.sampleRate / 2);
    lp.Q.value = -3; // sin resonancia
    g.gain.value = l.nivel;
    p.pan.value = Math.max(-1, Math.min(1, l.pan));
    const s = c.createGain(), e = c.createGain();
    s.gain.value = 1 - l.humedad * 0.6;
    e.gain.value = l.humedad;
    lp.connect(g).connect(p);
    p.connect(s).connect(this.seco);
    p.connect(e).connect(this.envio);
    return lp;
  }

  env(g: GainNode, t: number, pico: number, ataque: number, caida: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + caida);
  }

  osc(tipo: OscillatorType, f: number, t: number, fin: number, destino: AudioNode, det = 0) {
    const o = this.ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(destino);
    o.start(t);
    o.stop(fin);
    this.registrar(o, t);
    return o;
  }

  // ---------------------------------------------------------------- instrumentos
  marimba(f: number, t: number, v: number, dur: number, dest: AudioNode) {
    for (const [mult, a, caida] of [[1, 1, 0.9], [3.98, 0.3, 0.14], [9.9, 0.08, 0.05]]) {
      const g = this.ctx.createGain();
      this.env(g, t, v * a, 0.004, mult === 1 ? Math.max(0.35, Math.min(caida, dur * 3)) : caida);
      g.connect(dest);
      this.osc("sine", f * mult, t, t + caida + 0.1, g);
    }
  }

  campanita(f: number, t: number, v: number, dur: number, dest: AudioNode) { // glockenspiel: una octava arriba, parciales inarmónicos que se apagan rápido
    for (const [mult, a, caida] of [[2, 0.75, 1.3], [5.52, 0.3, 0.45], [10.8, 0.12, 0.18]]) {
      const g = this.ctx.createGain();
      this.env(g, t, v * a, 0.002, caida);
      g.connect(dest);
      this.osc("sine", f * mult, t, t + caida + 0.1, g);
    }
  }

  guitarra(f: number, t: number, v: number, dur: number, dest: AudioNode) { // cuerda pulsada: diente de sierra con un filtro que se cierra
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 10, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.35);
    const g = this.ctx.createGain(); // niveles igualados a la marimba (medido en render offline)
    this.env(g, t, v * 0.85, 0.003, Math.max(0.3, Math.min(1.1, dur * 2.5)));
    lp.connect(g).connect(dest);
    this.osc("sawtooth", f, t, t + 1.3, lp);
    const g2 = this.ctx.createGain();
    this.env(g2, t, v * 0.6, 0.003, 0.8);
    g2.connect(dest);
    this.osc("triangle", f, t, t + 1, g2);
  }

  pianoE(f: number, t: number, v: number, dur: number, dest: AudioNode) { // piano eléctrico por FM: el brillo del ataque se apaga en medio segundo
    const c = this.ctx, fin = t + 1.9;
    const mod = c.createOscillator();
    mod.frequency.value = f;
    const indice = c.createGain();
    indice.gain.setValueAtTime(f * 2.2, t);
    indice.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.6);
    mod.connect(indice);
    const car = c.createOscillator();
    car.frequency.value = f;
    indice.connect(car.frequency);
    const g = c.createGain();
    this.env(g, t, v * 1.1, 0.005, Math.max(0.5, Math.min(1.7, dur * 3)));
    car.connect(g).connect(dest);
    mod.start(t);
    car.start(t);
    mod.stop(fin);
    car.stop(fin);
    this.registrar(car, t);
    this.registrar(mod, t);
  }

  nota(timbre: string, midi: number, t: number, v: number, dur: number, dest: AudioNode) {
    const f = mtof(midi);
    if (timbre === "marimba") this.marimba(f, t, v, dur, dest);
    else if (timbre === "campanita") this.campanita(f, t, v, dur, dest);
    else if (timbre === "guitarra") this.guitarra(f, t, v, dur, dest);
    else this.pianoE(f, t, v, dur, dest);
  }

  acorde(midis: number[], t: number, dur: number, v: number, dest: AudioNode) { // colchón suave bajo la melodía de cada palabra
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    lp.connect(dest);
    for (const m of midis)
      for (const det of [-6, 6]) {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.06);
        g.gain.setValueAtTime(v, t + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.45);
        g.connect(lp);
        this.osc("triangle", mtof(m), t, t + dur + 0.5, g, det);
      }
  }

  cierre(t: number, dur: number, dest: AudioNode) { // rasgueo de Re mayor: el mensaje vuelve a casa
    [50, 54, 57, 62, 66].forEach((m, k) => this.pianoE(mtof(m), t + k * 0.035, 0.13, dur, dest));
    this.acorde(CIERRE.notas, t, dur, 0.022, dest);
  }

  // el fondo del día: se encienden las notas (posiciones de la pentatónica) que usaron sus mensajes
  fondo(cifras: number[], t: number) {
    this.vocesFondo.forEach((v, k) => v.fijar(cifras.includes(k) ? 0.016 : 0, t));
  }

  // la onda sale de ti: un destello en re y un soplo de re y la, al centro y con mucho eco
  onda(t: number) {
    const dest = this.espacio({ pan: 0, nivel: 1, humedad: 0.7, brillo: 9000 });
    this.campanita(mtof(74), t, 0.14, 1, dest);
    for (const [m, v] of [[62, 0.05], [69, 0.035]]) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      g.connect(dest);
      this.osc("sine", mtof(m), t, t + 2.9, g);
    }
  }
}

// ---------------------------------------------------------------- mensajes y días

// programa un mensaje convertido (conversion.js) desde t0, sonando desde `lugar`; devuelve cuándo suena cada palabra.
// conCierre = false: solo las palabras, sin el Re mayor final (para escuchar una palabra sola)
export function tocarMensaje(s: Sonido, conv: Conversion, t0: number, bpm: number, lugar: Lugar = AQUI, conCierre = true) {
  const corchea = 30 / bpm, compas = 4 * corchea, dest = s.espacio(lugar);
  const palabras = conv.firmas.map((f, k) => {
    const tc = t0 + k * compas;
    s.acorde(f.acorde.notas, tc, compas, 0.022, dest);
    let tt = tc;
    f.notas.forEach((m, j) => {
      const d = f.ritmo.d[j] * corchea;
      s.nota(f.timbre, m, tt, j === f.notas.length - 1 ? 0.2 : 0.16, d, dest);
      tt += d;
    });
    f.adornos.forEach((m, j) => s.nota("campanita", m, tc + compas - (f.adornos.length - j) * corchea * 0.5, 0.07, corchea * 0.5, dest));
    return { k, t: tc, fin: tc + compas };
  });
  const cierre = t0 + conv.firmas.length * compas;
  if (!conCierre) return { palabras, cierre: Infinity, fin: cierre + 0.6 };
  s.cierre(cierre, compas * 1.5, dest);
  return { palabras, cierre, fin: cierre + compas * 1.5 };
}

// programa un día completo: su fondo, la onda que sale de ti y sus mensajes uno tras otro, en el orden de
// dia.items (del más cercano al más lejano, con item.lugar ya calculado); devuelve la agenda para dibujarlo
export function tocarDia<I extends { conv: Conversion; lugar: Lugar & { km: number } }>(s: Sonido, dia: { items: I[]; bpm: number; cifras: number[] }, t0: number) {
  s.fondo(dia.cifras, t0);
  s.onda(t0);
  const primero = dia.items.length ? dia.items[0].lugar.km : 0;
  let t = t0 + 0.9 + Math.min(1.2, primero / 600); // si lo más cercano está lejos, la onda tarda un poco más
  const agenda = [];
  for (const item of dia.items) {
    const r = tocarMensaje(s, item.conv, t, dia.bpm, item.lugar);
    agenda.push({ item, inicio: t, ...r });
    t = r.fin + 0.4;
  }
  return { agenda, inicio: t0, fin: t + 0.5 };
}
