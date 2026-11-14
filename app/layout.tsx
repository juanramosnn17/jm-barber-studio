/* =====================================================================
   LAYOUT RAÍZ (app/layout.tsx)
   ---------------------------------------------------------------------
   Este componente envuelve TODAS las páginas de la aplicación.
   Aquí se definen:
     - El idioma del documento (español).
     - La fuente tipográfica principal (Plus Jakarta Sans).
     - La fuente de iconos (Material Symbols).
     - Los metadatos (título y descripción que ve Google y la pestaña).
   ===================================================================== */

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// next/font descarga la fuente en tiempo de compilación y la sirve desde
// nuestro propio dominio (más rápido y sin "saltos" de texto al cargar).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta", // Se usa en globals.css → --font-sans
  subsets: ["latin"],
  display: "swap",
});

// Metadatos de la página (pestaña del navegador y buscadores)
export const metadata: Metadata = {
  // EDITAR AQUÍ: Título que aparece en la pestaña del navegador.
  // "%s" se reemplaza por el título de cada página (p. ej. "Iniciar sesión").
  title: {
    default: "JM Barber Studio",
    template: "%s · JM Barber Studio",
  },
  // EDITAR AQUÍ: Descripción que muestra Google en los resultados.
  description:
    "Reserva tu cita en JM Barber Studio: cortes, barba y cejas con atención personalizada.",
};

// Color de la barra del navegador en móviles
export const viewport: Viewport = {
  // CAMBIAR COLOR/ESTILO AQUÍ: color de la barra superior en móviles
  themeColor: "#fcf9f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <head>
        {/* Fuente de iconos de Google (Material Symbols).
            Se carga como hoja de estilos porque es una fuente de iconos
            variable que next/font no puede recortar por glifos.
            display=block es intencional: evita que se vea el nombre del ícono
            como texto mientras la fuente carga. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      {/* min-h-full + flex-col permite que el pie de página quede
          siempre abajo aunque la página tenga poco contenido. */}
      <body className="min-h-full flex flex-col bg-background font-sans text-body-md text-on-surface">
        {children}
      </body>
    </html>
  );
}
