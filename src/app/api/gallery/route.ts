import { NextRequest, NextResponse } from "next/server";

import { getGalleryFolder } from "@/lib/back";
import {
  GALERIA_FOLDER_POR_DEFECTO,
  listarFotosGaleria,
  urlAlbumDrive,
} from "@/lib/front/galeria";
import type { Circuit } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CIRCUITS: readonly Circuit[] = ["PRINCIPIANTES", "INTERMEDIOS"];

/**
 * GET /api/gallery?circuit= — photos of that circuit's Drive folder.
 *
 * The organizer sets the folder per circuit from the panel; when none is set the
 * deployment default (env var, then the hardcoded album) applies. The gallery is
 * decorative: a Drive failure returns an empty list, never an error the page
 * would have to handle.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("circuit");
  if (raw !== null && raw !== "" && !CIRCUITS.includes(raw as Circuit)) {
    return NextResponse.json({ error: "Invalid circuit." }, { status: 400 });
  }
  const circuit = (raw || "PRINCIPIANTES") as Circuit;

  let folder = process.env.GALERIA_FOLDER_ID ?? GALERIA_FOLDER_POR_DEFECTO;
  try {
    const stored = await getGalleryFolder(circuit);
    if (stored) folder = stored;
  } catch {
    // A settings read must never take the gallery down.
  }

  const fotos = await listarFotosGaleria(folder, 12);
  return NextResponse.json({ fotos, albumUrl: urlAlbumDrive(folder) });
}
