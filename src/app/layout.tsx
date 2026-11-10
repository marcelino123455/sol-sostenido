import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const titulares = Fraunces({ variable: "--font-titulares", subsets: ["latin"] });
const cuerpo = Figtree({ variable: "--font-cuerpo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sol sostenido ♯",
  description: "Un mural sonoro de apoyo entre universidades del Perú",
};

// aplica el tema guardado antes del primer dibujo, para que el modo oscuro no parpadee en claro
const TEMA_GUARDADO = `(function(){try{var t=localStorage.getItem("sol-sostenido.tema");if(t==="oscuro")document.documentElement.setAttribute("data-tema",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-tema="claro" className={`${titulares.variable} ${cuerpo.variable}`} suppressHydrationWarning>
      <head>
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: TEMA_GUARDADO }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
