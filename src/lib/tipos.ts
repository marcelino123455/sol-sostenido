export type Mensaje = { fecha: string; universidad: string; texto: string };

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
