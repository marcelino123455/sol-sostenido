// Reglas de los mensajes, sin dependencias de AWS para poder probarlas con `node --test`.
import { randomBytes } from "node:crypto";

const LARGO_TEXTO = 140;
const LARGO_NOMBRE = 40;

// Mantener igual a los id de src/datos/universidades.ts
const UNIVERSIDADES = new Set([
  "utec", "pucp", "unmsm", "unt", "udep", "unc", "unap", "uncp", "unsch", "unsaac", "unsa", "unap-puno",
]);

// Filtro inicial: se compara sin mayúsculas ni tildes, por palabra completa
const PALABRAS_BLOQUEADAS = ["matate", "suicidate", "muerete", "idiota", "imbecil", "inutil"];

const normalizar = (texto) => texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function tieneBloqueadas(texto) {
  const palabras = normalizar(texto).split(/[^\p{L}]+/u);
  return palabras.some((p) => PALABRAS_BLOQUEADAS.includes(p));
}

// Devuelve { error } o { datos } con los campos ya limpios
export function validarMensaje(cuerpo) {
  const { universidad, texto, nombre } = cuerpo ?? {};
  if (typeof universidad !== "string" || !UNIVERSIDADES.has(universidad)) return { error: "Universidad no válida" };
  if (typeof texto !== "string" || !texto.trim()) return { error: "Escribe un mensaje" };
  const limpio = texto.trim();
  if (limpio.length > LARGO_TEXTO) return { error: `El mensaje admite hasta ${LARGO_TEXTO} caracteres` };
  if (nombre !== undefined && typeof nombre !== "string") return { error: "Nombre no válido" };
  const nombreLimpio = nombre?.trim();
  if (nombreLimpio && nombreLimpio.length > LARGO_NOMBRE) return { error: `El nombre admite hasta ${LARGO_NOMBRE} caracteres` };
  if (tieneBloqueadas(limpio) || (nombreLimpio && tieneBloqueadas(nombreLimpio))) {
    return { error: "Tu mensaje no se puede publicar. Intenta con otras palabras." };
  }
  return { datos: { universidad, texto: limpio, ...(nombreLimpio ? { nombre: nombreLimpio } : {}) } };
}

export function fechaValida(fecha) {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(fecha);
}

export const fechaPeru = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(ahora);

// Solo el código exacto publica directo; cualquier otro valor queda pendiente, sin avisar que falló
export const estadoPara = (codigo, esperado) =>
  typeof codigo === "string" && esperado && codigo === esperado ? "aprobado" : "pendiente";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(ms = Date.now()) {
  let tiempo = "";
  for (let k = 0, t = ms; k < 10; k++) {
    tiempo = CROCKFORD[t % 32] + tiempo;
    t = Math.floor(t / 32);
  }
  const azar = Array.from(randomBytes(16), (b) => CROCKFORD[b % 32]).join("");
  return tiempo + azar;
}
