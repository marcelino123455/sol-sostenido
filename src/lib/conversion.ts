import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

const codificador = new Tiktoken(o200k_base);
export const decodificar = (id: number) => codificador.decode([id]);
export type Firma = ReturnType<typeof firma>;
export type Conversion = ReturnType<typeof convertir>;
/*
  conversion.js · "No estás solo": de un mensaje de apoyo a una frase musical feliz.

  mensaje  →  palabras clave  →  token ID (tiktoken o200k_base)  →  firma musical de cada palabra

  - Todo está en re mayor. Las melodías usan la pentatónica (re mi fa# la si): no tiene semitonos,
    así que nada choca aunque suenen muchos mensajes juntos. Los acordes son I, IV, V y vi
    (la progresión del pop optimista). Cada mensaje cierra en Re mayor.
  - El primer ID de la palabra elige acorde, ritmo, timbre, octava y melodía. Si la palabra se parte en
    varios tokens (" val" + "iente"), los tokens extra agregan un adorno al final: "valiente" y "vales"
    comparten raíz y suenan de la misma familia, pero no iguales.
  - Es determinista: la misma palabra suena igual siempre, en cualquier mensaje y desde cualquier universidad.
*/

export const ESCALA = [ // pentatónica de re mayor
  { nombre: "re", midi: 62 },
  { nombre: "mi", midi: 64 },
  { nombre: "fa#", midi: 66 },
  { nombre: "la", midi: 69 },
  { nombre: "si", midi: 71 },
];

export const ACORDES = [
  { grado: "I", nombre: "Re mayor", corto: "Re", raiz: 62, notas: [50, 54, 57] },
  { grado: "IV", nombre: "Sol mayor", corto: "Sol", raiz: 67, notas: [55, 59, 62] },
  { grado: "V", nombre: "La mayor", corto: "La", raiz: 69, notas: [57, 61, 64] },
  { grado: "vi", nombre: "Si menor", corto: "Si m", raiz: 71, notas: [59, 62, 66] },
];
export const CIERRE = ACORDES[0]; // todo mensaje termina en casa: Re mayor

export const RITMOS = [ // duraciones de las 4 notas, en corcheas (un compás de 4 corcheas por palabra)
  { nombre: "parejo", d: [1, 1, 1, 1] },
  { nombre: "impulso", d: [0.5, 0.5, 1, 2] },
  { nombre: "saltado", d: [1.5, 0.5, 1, 1] },
  { nombre: "galope", d: [1, 0.5, 0.5, 2] },
];

export const TIMBRES = ["marimba", "campanita", "guitarra", "piano eléctrico"];

const MAX_CLAVES = 5;

// palabras vacías en español y portugués: no llevan sonido propio
const PARADA = new Set(`
a al algo alguna algunas alguno algunos ante antes aquel aquella aquellas aquello aquellos asi así aun aún aunque
cada como cómo con contra cual cuál cuales cuando cuándo cuanto cuánto de del desde donde dónde durante e el él ella
ellas ello ellos en entre era eras eres es esa esas ese eso esos esta está estaba estaban estamos están estar estará
estas estás este esto estos estoy fue fueron fui ha había han has hasta hay haya he hemos hace hacer hacia incluso
la las le les lo los más mas me mi mí mis mucha muchas mucho muchos muy nada ni no nos nosotras nosotros nuestra
nuestras nuestro nuestros o os otra otras otro otros para pero poco por porque que qué quien quién quienes se sea
sean será serán si sí sin sobre son su sus también tan tanto te tenés tener tengo tiene tienen ti toda todas todo
todos tu tú tus un una unas uno unos usted ustedes vos y ya yo cualquier
à às ao aos com da das do dos é ela elas ele eles essa esse está estão eu foi isso isto já mais meu minha muito na
nas não nem nós ou pela pelo qual quando quem sem ser seu sua são tem teu tua um uma você vocês vai vou
`.split(/\s+/).filter(Boolean));

const NOMBRE_NOTA: Record<number, string> = { 0: "do", 1: "do#", 2: "re", 3: "re#", 4: "mi", 5: "fa", 6: "fa#", 7: "sol", 8: "sol#", 9: "la", 10: "la#", 11: "si" };
const nombreNota = (midi: number) => NOMBRE_NOTA[((midi % 12) + 12) % 12];

// 1. mensaje -> palabras clave (en orden, hasta 5)
function claves(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}]+/u)
    .filter((p) => p.length >= 3 && !PARADA.has(p))
    .slice(0, MAX_CLAVES);
}

// 2. palabra -> token IDs. Con espacio delante, como aparece dentro de una frase:
//    " puedes" -> [28190]; sin espacio o con mayúscula daría otros IDs.
function tokens(palabra: string) {
  return codificador.encode(" " + palabra);
}

// 3. token IDs -> firma musical
function firma(palabra: string) {
  const ids = tokens(palabra), id = ids[0];
  const pasos = {
    acorde: id % 4,
    ritmo: Math.floor(id / 4) % 4,
    timbre: Math.floor(id / 16) % 4,
    octava: Math.floor(id / 64) % 2,
    base5: Math.floor(id / 128),
    cifras: [] as number[],
  };
  // las 3 últimas cifras de base5 escrito en base 5 (de derecha a izquierda) son 3 notas de la pentatónica
  pasos.cifras = [pasos.base5 % 5, Math.floor(pasos.base5 / 5) % 5, Math.floor(pasos.base5 / 25) % 5];
  const subir = pasos.octava ? 12 : 0;
  const acorde = ACORDES[pasos.acorde];
  const notas = pasos.cifras.map((c) => ESCALA[c].midi + subir).concat(acorde.raiz + subir); // cierra en la raíz del acorde
  const adornos = ids.slice(1).map((x) => ESCALA[x % 5].midi + subir + 12); // tokens extra: notas de adorno, una octava arriba
  return {
    palabra, ids, id, pasos, acorde,
    ritmo: RITMOS[pasos.ritmo],
    timbre: TIMBRES[pasos.timbre],
    octava: pasos.octava ? "aguda" : "media",
    notas, adornos,
    nombres: notas.map(nombreNota),
    nombresAdornos: adornos.map(nombreNota),
  };
}

// 4. mensaje completo -> su frase: una firma por palabra clave, en orden (y luego el cierre en Re mayor)
export function convertir(texto: string) {
  const lista = claves(texto);
  return { texto, claves: lista, firmas: lista.map(firma) };
}

// las notas de la pentatónica que suenan en un grupo de mensajes (para el fondo de cada día)
export function notasDe(conversiones: Conversion[]) {
  const usadas = new Set<number>();
  for (const c of conversiones) for (const f of c.firmas) for (const k of f.pasos.cifras) usadas.add(k);
  return [...usadas].sort((a, b) => a - b);
}

// la explicación paso a paso de una firma, con los números reales
export function explicar(f: Firma) {
  const p = f.pasos;
  return [
    ["acorde", `${f.id} mod 4 = ${p.acorde}`, `${f.acorde.grado} · ${f.acorde.nombre}`],
    ["ritmo", `⌊${f.id} ÷ 4⌋ mod 4 = ${p.ritmo}`, f.ritmo.nombre],
    ["timbre", `⌊${f.id} ÷ 16⌋ mod 4 = ${p.timbre}`, f.timbre],
    ["octava", `⌊${f.id} ÷ 64⌋ mod 2 = ${p.octava}`, f.octava],
    ["melodía", `⌊${f.id} ÷ 128⌋ = ${p.base5} = ${p.base5.toString(5).padStart(3, "0")} en base 5 → cifras ${p.cifras.join(" · ")} (de derecha a izquierda)`,
      `${f.nombres.slice(0, 3).join(" · ")} y cierra en ${f.nombres[3]}`],
    ["adorno", f.ids.length > 1 ? `tokens extra ${f.ids.slice(1).join(", ")} → mod 5` : "la palabra es un solo token",
      f.adornos.length ? f.nombresAdornos.join(" · ") : "sin adorno"],
  ];
}
