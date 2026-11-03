import type { Universidad } from "@/lib/tipos";

// Universidades del Perú para la demo. lat/lon aproximadas del campus (con ellas se miden las distancias).
// etiqueta: de qué lado va el nombre en el mapa. mover: [dx, dy] en píxeles, solo para el dibujo, para que las
// de Lima (a pocos km entre sí) no queden una encima de otra.
export const UNIVERSIDADES: Universidad[] = [
  { id: "utec", nombre: "UTEC", completo: "Universidad de Ingeniería y Tecnología", ciudad: "Lima", lat: -12.135, lon: -77.022, etiqueta: "izq", mover: [4, 22] },
  { id: "pucp", nombre: "PUCP", completo: "Pontificia Universidad Católica del Perú", ciudad: "Lima", lat: -12.069, lon: -77.079, etiqueta: "izq", mover: [-6, 0] },
  { id: "unmsm", nombre: "San Marcos", completo: "Universidad Nacional Mayor de San Marcos", ciudad: "Lima", lat: -12.056, lon: -77.084, etiqueta: "izq", mover: [4, -22] },
  { id: "unt", nombre: "UNT", completo: "Universidad Nacional de Trujillo", ciudad: "Trujillo", lat: -8.112, lon: -79.037, etiqueta: "izq" },
  { id: "udep", nombre: "UDEP", completo: "Universidad de Piura", ciudad: "Piura", lat: -5.177, lon: -80.636, etiqueta: "der" },
  { id: "unc", nombre: "UNC", completo: "Universidad Nacional de Cajamarca", ciudad: "Cajamarca", lat: -7.168, lon: -78.505, etiqueta: "der" },
  { id: "unap", nombre: "UNAP", completo: "Universidad Nacional de la Amazonía Peruana", ciudad: "Iquitos", lat: -3.749, lon: -73.252, etiqueta: "der" },
  { id: "uncp", nombre: "UNCP", completo: "Universidad Nacional del Centro del Perú", ciudad: "Huancayo", lat: -12.035, lon: -75.233, etiqueta: "der" },
  { id: "unsch", nombre: "UNSCH", completo: "Universidad Nacional de San Cristóbal de Huamanga", ciudad: "Ayacucho", lat: -13.148, lon: -74.222, etiqueta: "izq" },
  { id: "unsaac", nombre: "UNSAAC", completo: "Universidad Nacional de San Antonio Abad del Cusco", ciudad: "Cusco", lat: -13.523, lon: -71.967, etiqueta: "der" },
  { id: "unsa", nombre: "UNSA", completo: "Universidad Nacional de San Agustín de Arequipa", ciudad: "Arequipa", lat: -16.406, lon: -71.524, etiqueta: "izq" },
  { id: "unap-puno", nombre: "UNA Puno", completo: "Universidad Nacional del Altiplano", ciudad: "Puno", lat: -15.825, lon: -70.017, etiqueta: "der" },
];
