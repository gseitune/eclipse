import type { Metadata } from "next";
import { Bebas_Neue, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// La condensada es el gesto deportivo (titular y números de tablero); Bebas
// Neue es más angosta y liviana que la Anton que usábamos, así que las
// etiquetas en mayúscula del switch y las tablas respiran mejor a tamaño
// chico. Solo tiene mayúsculas: cualquier texto display en minúscula se ve
// como capital. El cuerpo va en Source Sans 3: humanista, neutra y con cifras
// parejas, que es lo que piden las tablas de posiciones.
const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SELVARENA · En vivo",
  description: "Circuito de beach vóley — Circuito Mixto Principiantes 2026, en vivo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${bebas.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden="true"
        >
          {/* Fondo: cancha de beach volley. La foto es chica, así que va con un
              desenfoque leve —se lee como atmósfera, no como detalle— y un velo
              de arena para que el contenido siga siendo lo que manda. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fondo-cancha4.jpg"
            alt=""
            className="h-full w-full object-cover object-[50%_38%]"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sand-50/56 via-sand-50/46 to-sand-100/66" />
        </div>
        <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
