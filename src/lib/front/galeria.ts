// Galería pública de fotos del fotógrafo (DACOSTA).
//
// ESTRATEGIA (decidida en el relevamiento previo):
//  - El listado de fotos sale de la página que Google ya renderiza para la
//    carpeta (embeddedfolderview), parseada del lado servidor. Cero
//    credenciales y cero setup en Google Cloud.
//  - Las miniaturas se piden con <img> plano, así el navegador las baja
//    DIRECTO de Google: Vercel no transfiere ni transforma un solo byte.
//    (Image Optimization de Hobby trae 5.000 transformaciones/mes y no
//  - La galería muestra 12 fotos SORTEADAS de todo el álbum y las renueva
//    cada 2 horas. El sorteo se siembra con la ventana de tiempo, así que es
//    estable (todos ven lo mismo dentro de la ventana) y no necesita cron,
//    ni base de datos, ni guardar estado en ningún lado.
//
// TODO ES DECORATIVO: si Google cambia el HTML, tarda, o bloquea la IP del
// datacenter, esto devuelve [] y la home sigue funcionando igual. Ninguna
// función de este módulo propaga excepciones.

export type FotoDrive = {
  id: string;
  name: string;
};

export type FotoGaleria = {
  id: string;
  name: string;
  alt: string;
  thumbUrl: string;
  url: string;
};

/**
 * Carpeta de Drive del fotógrafo. Es el ÚNICO dato manual de la galería:
 * cambiá este ID cuando las fotos de una fecha nueva vayan a otra carpeta.
 * Se puede pisar sin tocar código con la env var GALERIA_FOLDER_ID.
 */
export const GALERIA_FOLDER_POR_DEFECTO = "1BC3mU3_8do5q8AINhQ015eftZZd0h5P8";

const RE_CARPETA_ID = /^[A-Za-z0-9_-]{10,}$/;
const RE_CARPETA_URL = /\/folders\/([A-Za-z0-9_-]{10,})/;

/**
 * Reads the folder id out of whatever the organizer pastes: the full Drive URL
 * (with or without `/u/0`, with query string) or the bare id. Anything else is
 * rejected instead of silently pointing the gallery at a bogus folder.
 */
export function parseDriveFolderId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (RE_CARPETA_ID.test(trimmed)) return trimmed;
  const match = RE_CARPETA_URL.exec(trimmed);
  return match ? match[1] : null;
}

const ANCHO_MINIATURA = 400;
const LIMITE_POR_DEFECTO = 12;
const TIMEOUT_MS = 4000;
/** La lista de Drive se refresca al mismo ritmo que la rotación. */
const REVALIDATE_SEGUNDOS = 7200;

/**
 * Cada cuánto cambian las fotos que se muestran. El sorteo se siembra con el
 * número de ventana: adentro de las 2 horas todos ven exactamente las mismas
 * 12 fotos, y al cruzar el límite cambian solas.
 */
export const DURACION_VENTANA_MS = 2 * 60 * 60 * 1000;

/** Cada entrada del listado arranca con `id="entry-<ID>"`. */
const RE_ENTRY = /id="entry-/;
/** El link de compartir del archivo es lo que garantiza que es una foto. */
const RE_FILE_ID = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,})/;
const RE_TITULO = /flip-entry-title">([^<]*)</;
/** Los nombres de cámara (IMG_8972.JPG) no aportan nada como alt. */
const RE_NOMBRE_GENERICO = /^img[_-]?\d+$/i;

/**
 * Saca las fotos del HTML de Google. Pura: mismo HTML, mismo resultado.
 * Ignora subcarpetas y cualquier entrada sin link `/file/d/`.
 */
export function extractFotosDrive(html: string, limite?: number): FotoDrive[] {
  if (!html) return [];

  const fotos: FotoDrive[] = [];
  const vistos = new Set<string>();

  for (const bloque of html.split(RE_ENTRY).slice(1)) {
    const matchId = bloque.match(RE_FILE_ID);
    if (!matchId) continue;

    const id = matchId[1];
    if (vistos.has(id)) continue;
    vistos.add(id);

    fotos.push({ id, name: bloque.match(RE_TITULO)?.[1] ?? "" });

    if (limite !== undefined && fotos.length >= limite) break;
  }

  return fotos;
}

/**
 * Número de ventana de rotación. Adentro de la misma ventana el valor no
 * cambia; al cruzar el límite, salta de a uno.
 */
export function ventanaDeTiempo(
  ahora: number,
  duracionMs: number = DURACION_VENTANA_MS,
): number {
  return Math.floor(ahora / duracionMs);
}

/**
 * PRNG determinista (mulberry32): la misma semilla da siempre la misma
 * secuencia. Eso es lo que hace que la galería sea estable durante 2 horas
 * en vez de cambiar en cada visita.
 */
function generadorPseudoaleatorio(semilla: number): () => number {
  let estado = semilla >>> 0 || 1;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Elige `cantidad` elementos al azar, de forma determinista para una semilla.
 * Es un Fisher-Yates parcial: mezcla solo los puestos que va a devolver, así
 * no paga por mezclar las 181 fotos cuando necesita 12.
 */
export function elegirAlAzar<T>(
  items: T[],
  cantidad: number,
  semilla: number,
): T[] {
  if (items.length === 0 || cantidad <= 0) return [];

  const copia = [...items];
  const azar = generadorPseudoaleatorio(semilla);
  const cuantos = Math.min(cantidad, copia.length);

  for (let i = 0; i < cuantos; i++) {
    const j = i + Math.floor(azar() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia.slice(0, cuantos);
}

/** Texto alternativo legible: sirve el nombre solo si dice algo. */
export function altDeFoto(nombre: string, indice: number): string {
  const sinExtension = nombre.replace(/\.[A-Za-z0-9]+$/, "").trim();
  if (sinExtension.length === 0 || RE_NOMBRE_GENERICO.test(sinExtension)) {
    return `Foto del torneo ${indice + 1}`;
  }
  return sinExtension;
}

export function fotoThumbUrl(id: string, ancho = ANCHO_MINIATURA): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${ancho}`;
}

export function urlFotoDrive(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

export function urlAlbumDrive(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/** Deja cada foto con todo lo que necesita el componente para renderizarse. */
export function armarGaleria(fotos: FotoDrive[]): FotoGaleria[] {
  return fotos.map((foto, indice) => ({
    id: foto.id,
    name: foto.name,
    alt: altDeFoto(foto.name, indice),
    thumbUrl: fotoThumbUrl(foto.id),
    url: urlFotoDrive(foto.id),
  }));
}

/**
 * Lista las fotos de la carpeta pública de Drive. Nunca lanza: ante cualquier
 * problema devuelve [] y la galería simplemente no se dibuja.
 */
export async function listarFotosGaleria(
  folderId: string | undefined = GALERIA_FOLDER_POR_DEFECTO,
  limite: number = LIMITE_POR_DEFECTO,
  ahora: number = Date.now(),
): Promise<FotoGaleria[]> {
  if (!folderId) return [];

  try {
    const res = await fetch(
      `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`,
      {
        next: { revalidate: REVALIDATE_SEGUNDOS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!res.ok) return [];

    // Parseamos TODAS las fotos y después sorteamos. Si cortáramos en `limite`,
    // la galería mostraría siempre las primeras del álbum.
    const todas = extractFotosDrive(await res.text());

    return armarGaleria(elegirAlAzar(todas, limite, ventanaDeTiempo(ahora)));
  } catch {
    return [];
  }
}
