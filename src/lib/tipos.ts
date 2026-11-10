// apoyo: un mensaje para otros; testimonio: algo difícil que alguien superó y cómo salió adelante
export type Tipo = "apoyo" | "testimonio";
export type Mensaje = { id?: string; fecha: string; universidad: string; tipo?: Tipo; texto: string; nombre?: string | null };

export type Universidad = {
  id: string;
  nombre: string;
  completo: string;
  ciudad: string;
  lat: number;
  lon: number;
  etiqueta: "izq" | "der";
  mover?: [number, number];
};

export type Punto = { lat: number; lon: number };

export type Oyente = Punto & { ciudad: string; como: "zona" | "defecto" | "manual" };

export type Lugar = { pan: number; nivel: number; humedad: number; brillo: number };
