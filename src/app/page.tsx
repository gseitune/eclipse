import { connection } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import type { Circuit, RankingResponse, StateSnapshot } from "@/lib/front/types";
import {
  GALERIA_FOLDER_POR_DEFECTO,
  listarFotosGaleria,
  urlAlbumDrive,
} from "@/lib/front/galeria";
import { PublicHome } from "@/components/public/PublicHome";
import { getGalleryFolder } from "@/lib/back";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; circuito?: string }>;
}) {
  await connection();

  const params = await searchParams;
  const isPreview = params.preview === "1";

  // El circuito viaja en la URL (`?circuito=intermedios`) para que un refresh no
  // devuelva al visitante a Principiantes y para poder compartir el enlace.
  const initialCircuit: Circuit =
    params.circuito === "intermedios" ? "INTERMEDIOS" : "PRINCIPIANTES";

  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost:3000";

  // La galería se pide EN PARALELO al estado: si Google tarda, no frena la
  // home (tiene timeout propio y devuelve [] ante cualquier problema).
  // La carpeta puede venir del panel del organizador; si no hay ninguna
  // configurada, manda la env var y después el álbum por defecto.
  let carpetaGaleria = process.env.GALERIA_FOLDER_ID ?? GALERIA_FOLDER_POR_DEFECTO;
  try {
    const carpetaConfigurada = await getGalleryFolder(initialCircuit);
    if (carpetaConfigurada) carpetaGaleria = carpetaConfigurada;
  } catch {
    // Una lectura de configuración nunca puede tumbar la home.
  }
  const fotosGaleria = listarFotosGaleria(carpetaGaleria, 12);

  let initial: StateSnapshot | null = null;
  let initialRanking: RankingResponse | null = null;
  let fetchError = false;

  try {
    const res = await fetch(
      `${proto}://${host}/api/state?circuit=${initialCircuit}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      fetchError = true;
    } else {
      initial = await res.json();
    }
  } catch {
    fetchError = true;
  }

  // El ranking va también desde el servidor: el podio del marcador y el estado
  // de la etapa se dibujan completos en la primera pintura, sin saltos.
  try {
    const res = await fetch(
      `${proto}://${host}/api/ranking?circuit=${initialCircuit}`,
      { cache: "no-store" },
    );
    if (res.ok) initialRanking = await res.json();
  } catch {
    // La tabla es complementaria: si falla, la home sigue.
  }

  const fotos = await fotosGaleria;

  return (
    <>
      <PublicHome
        initial={initial}
        initialRanking={initialRanking}
        initialCircuit={initialCircuit}
        isPreview={isPreview}
          fotos={fotos}
        albumUrl={urlAlbumDrive(carpetaGaleria)}
      />
      {fetchError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Link
            href="/"
            className="rounded-xl bg-red-950/90 px-4 py-2 text-sm text-red-100 ring-1 ring-red-700/50 backdrop-blur hover:bg-red-900 transition-colors"
          >
            No se pudo conectar. Recargá.
          </Link>
        </div>
      )}
    </>
  );
}
