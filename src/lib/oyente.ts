import type { Lugar, Oyente, Punto } from "./tipos";
/*
  oyente.js · desde dónde escuchas, dentro del Perú.

  - Al abrir, se empieza en Lima si la zona horaria del equipo es la del Perú (America/Lima). No se piden permisos
    ni conexión, y nada sale del equipo. Para escuchar desde otra ciudad, se elige en la lista o se toca el mapa.
  - Las distancias son sobre la Tierra (gran círculo). La onda que sale de ti es el círculo de puntos a una misma
    distancia: alcanza a cada universidad en el orden de su distancia, y ese es el orden en que suenan.
  - El sonido se ubica respecto de ti: lo cercano suena al centro, presente y brillante; lo lejano, más suave,
    con más eco y más opaco, y desde su lado (este a la derecha, oeste a la izquierda).
*/

// ciudades del Perú para elegir desde dónde escuchar: id -> [nombre, lat, lon]
export const CIUDADES: Record<string, [string, number, number]> = {
  lima: ["Lima", -12.05, -77.04], arequipa: ["Arequipa", -16.4, -71.54], trujillo: ["Trujillo", -8.11, -79.03],
  chiclayo: ["Chiclayo", -6.77, -79.84], piura: ["Piura", -5.19, -80.63], tumbes: ["Tumbes", -3.57, -80.45],
  cajamarca: ["Cajamarca", -7.16, -78.51], chachapoyas: ["Chachapoyas", -6.23, -77.87], tarapoto: ["Tarapoto", -6.49, -76.37],
  iquitos: ["Iquitos", -3.75, -73.25], pucallpa: ["Pucallpa", -8.38, -74.55], huaraz: ["Huaraz", -9.53, -77.53],
  huanuco: ["Huánuco", -9.93, -76.24], huancayo: ["Huancayo", -12.07, -75.21], ica: ["Ica", -14.07, -75.73],
  ayacucho: ["Ayacucho", -13.16, -74.22], cusco: ["Cusco", -13.53, -71.97], puertomaldonado: ["Puerto Maldonado", -12.59, -69.19],
  puno: ["Puno", -15.84, -70.02], moquegua: ["Moquegua", -17.19, -70.93], tacna: ["Tacna", -18.01, -70.25],
};

export const enCiudad = (id: string, como: Oyente["como"]): Oyente => ({ ciudad: id, lat: CIUDADES[id][1], lon: CIUDADES[id][2], como });

// como: "zona" | "defecto" (y "manual" cuando lo eligen en el mapa o en la lista)
export function detectarOyente() {
  let zona = "";
  try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* sin Intl */ }
  return enCiudad("lima", zona === "America/Lima" ? "zona" : "defecto");
}

// la ciudad de la lista más cercana a un punto (para nombrar un lugar tocado en el mapa)
export function ciudadCercana(p: Punto) {
  let mejor = "lima", d = Infinity;
  for (const id in CIUDADES) {
    const k = kmEntre(p, { lat: CIUDADES[id][1], lon: CIUDADES[id][2] });
    if (k < d) { d = k; mejor = id; }
  }
  return { id: mejor, km: d };
}

// "Lima" o "cerca de Huancayo"
export function nombreLugar(o: Punto) {
  const c = ciudadCercana(o);
  return (c.km < 15 ? "" : "cerca de ") + CIUDADES[c.id][0];
}

// ---------------------------------------------------------------- geometría sobre la Tierra
const RAD = Math.PI / 180, RADIO_TIERRA = 6371;

export function kmEntre(a: Punto, b: Punto) {
  const f1 = a.lat * RAD, f2 = b.lat * RAD, df = f2 - f1, dl = (b.lon - a.lon) * RAD;
  const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(h)));
}

// rumbo inicial de a hacia b, en grados: 0 norte, 90 este
function rumbo(a: Punto, b: Punto) {
  const f1 = a.lat * RAD, f2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD;
  return Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) / RAD;
}

// el punto a `km` de `a` saliendo con rumbo `grados` (para dibujar la onda)
export function destino(a: Punto, grados: number, km: number) {
  const d = km / RADIO_TIERRA, t = grados * RAD, f1 = a.lat * RAD;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(t));
  const l2 = a.lon * RAD + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return { lat: f2 / RAD, lon: ((l2 / RAD + 540) % 360) - 180 };
}

// ---------------------------------------------------------------- cómo suena según la distancia
const LEJOS_KM = 1800; // desde aquí, "lejos del todo" (Tumbes–Tacna son unos 2000 km)

// dónde suena un punto para quien escucha: lo usa Sonido.espacio()
export function lugarDesde(oyente: Punto, punto: Punto): Lugar & { km: number } {
  const km = kmEntre(oyente, punto);
  const lejania = Math.sqrt(Math.min(1, km / LEJOS_KM)); // 0 aquí, 1 lejísimos; la raíz separa mejor lo cercano
  return {
    km,
    pan: Math.sin(rumbo(oyente, punto) * RAD) * Math.min(1, km / 300) * 0.8, // este a la derecha; lo muy cercano, al centro
    nivel: 1 - 0.2 * lejania,                       // hasta 2 dB más suave
    humedad: 0.22 + 0.28 * lejania,                 // más eco
    brillo: 16000 * Math.pow(5000 / 16000, lejania), // y más opaco, como el aire a lo lejos
  };
}

export function kmTexto(km: number, deTi = false) {
  if (km < 1) return "aquí mismo";
  const n = km < 100 ? Math.round(km) : Math.round(km / 10) * 10;
  return `a ${n.toLocaleString("es-PE")} km${deTi ? " de ti" : ""}`;
}
