import { MAPA_LATAM } from "@/datos/mapa";
import { UNIVERSIDADES } from "@/datos/universidades";
import type { Punto } from "./tipos";

// proyección equidistante azimutal centrada en el Perú; el encuadre es solo el Perú y los vecinos quedan de referencia
const CENTRO = { lat: -9.5, lon: -75 };
const R = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function proyectar(lon: number, lat: number): [number, number] {
  const f0 = CENTRO.lat * R, s0 = Math.sin(f0), c0 = Math.cos(f0);
  const f = lat * R, dl = (lon - CENTRO.lon) * R, sf = Math.sin(f), cf = Math.cos(f), cdl = Math.cos(dl);
  const c = Math.acos(clamp(s0 * sf + c0 * cf * cdl, -1, 1)), k = c < 1e-9 ? 1 : c / Math.sin(c);
  return [k * cf * Math.sin(dl), k * (c0 * sf - s0 * cf * cdl)];
}

export type Mapa = ReturnType<typeof construirMapa>;

export function construirMapa(W: number, H: number) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const formas = Object.entries(MAPA_LATAM).map(([cc, p]) => ({
    cc,
    anillos: p.poligonos.flat().map((a) => {
      const pts: number[] = [];
      for (let k = 0; k < a.length; k += 2) {
        const [x, y] = proyectar(a[k], a[k + 1]);
        pts.push(x, y);
        if (cc === "PE") { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      return pts;
    }),
  }));
  const pad = 40, esc = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const ox = W / 2 - (esc * (x0 + x1)) / 2, oy = H / 2 + (esc * (y0 + y1)) / 2;

  const aPantalla = (p: Punto): [number, number] => {
    const [px, py] = proyectar(p.lon, p.lat);
    return [ox + px * esc, oy - py * esc];
  };
  // al revés: del punto tocado en el mapa a lat/lon
  const desdePantalla = (x: number, y: number): Punto => {
    const f0 = CENTRO.lat * R, px = (x - ox) / esc, py = (oy - y) / esc, c = Math.hypot(px, py);
    if (c < 1e-9) return { ...CENTRO };
    const sc = Math.sin(c), cc = Math.cos(c);
    return {
      lat: Math.asin(clamp(cc * Math.sin(f0) + (py * sc * Math.cos(f0)) / c, -1, 1)) / R,
      lon: CENTRO.lon + Math.atan2(px * sc, c * Math.cos(f0) * cc - py * Math.sin(f0) * sc) / R,
    };
  };

  const paises = formas.map(({ cc, anillos }) => ({
    cc,
    d: anillos.map((a) => {
      let d = "";
      for (let k = 0; k < a.length; k += 2) d += (k ? "L" : "M") + (ox + a[k] * esc).toFixed(1) + "," + (oy - a[k + 1] * esc).toFixed(1);
      return d + "Z";
    }).join(""),
  }));
  const vecinos = ([["Ecuador", -1.3, -78.4], ["Colombia", -1.2, -71.8], ["Brasil", -8.5, -68.8], ["Bolivia", -15.5, -66.2], ["Chile", -19.6, -69.6]] as const)
    .map(([nombre, lat, lon]) => { const [x, y] = aPantalla({ lat, lon }); return { nombre, x, y }; });
  const universidades = UNIVERSIDADES.map((u) => {
    const [ax, ay] = aPantalla(u), [dx, dy] = u.mover ?? [0, 0];
    return { u, x: ax + dx, y: ay + dy };
  });
  return { paises, vecinos, universidades, aPantalla, desdePantalla };
}
