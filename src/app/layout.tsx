import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const titulares = Fraunces({ variable: "--font-titulares", subsets: ["latin"] });
const cuerpo = Figtree({ variable: "--font-cuerpo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sol sostenido ♯",
  description: "Un mural sonoro de apoyo entre universidades del Perú",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${titulares.variable} ${cuerpo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
