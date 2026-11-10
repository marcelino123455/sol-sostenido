// La API de mensajes (Cloudflare Worker, ver infra/worker). La URL es pública: va en el código.
// NEXT_PUBLIC_API_MENSAJES solo sirve para apuntar a otro Worker (por ejemplo, el local); vacía, usa los mensajes de ejemplo.
import type { Mensaje } from "@/lib/tipos";

const API_PUBLICADA = "https://sol-sostenido-api.marcelino-maita.workers.dev";
export const API = (process.env.NEXT_PUBLIC_API_MENSAJES ?? API_PUBLICADA).replace(/\/$/, "");

// el día de hoy en Perú, igual que lo calcula el Worker al guardar
export const hoyPeru = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

export function diasHasta(hoy: string, n: number) {
  const base = Date.parse(hoy + "T12:00:00Z");
  return Array.from({ length: n }, (_, k) => new Date(base - (n - 1 - k) * 86_400_000).toISOString().slice(0, 10));
}

// fetch sin conexión lanza "Failed to fetch": se reemplaza por un mensaje en español
async function pedir(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error("No se pudo conectar con el mural. Revisa tu conexión e inténtalo otra vez.");
  }
}

async function leerRespuesta<T>(r: Response): Promise<T> {
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo conectar con el mural");
  return cuerpo as T;
}

export async function traerMensajes(desde: string, hasta: string) {
  const r = await pedir(`${API}/mensajes?desde=${desde}&hasta=${hasta}`);
  return (await leerRespuesta<{ mensajes: Mensaje[] }>(r)).mensajes;
}

export type Enviado = { id: string; fecha: string; estado: "aprobado" | "pendiente" };

// codigo: la clave que se escribe en el modal; si coincide con el secreto del Worker, se publica sin revisión
export async function enviarMensaje(datos: { universidad: string; texto: string; nombre?: string; codigo?: string }) {
  const r = await pedir(`${API}/mensajes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(datos),
  });
  return leerRespuesta<Enviado>(r);
}
