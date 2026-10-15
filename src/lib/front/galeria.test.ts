import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DURACION_VENTANA_MS,
  altDeFoto,
  armarGaleria,
  elegirAlAzar,
  extractFotosDrive,
  fotoThumbUrl,
  urlAlbumDrive,
  urlFotoDrive,
  ventanaDeTiempo,
} from "./galeria";

// Fragmento fiel del HTML que devuelve Google en
// https://drive.google.com/embeddedfolderview?id=<CARPETA>#grid
// Incluye una subcarpeta a propósito: NO debe listarse como foto.
const HTML_FIXTURE = `<!DOCTYPE html><html><head><title>Carpeta</title></head><body>
<div class="flip-view">
<div class="flip-entry" id="entry-1AbCdEfGhIjKlMnOpQrStUvWxYz012345" tabindex="0" role="link">
<div class="flip-entry-info">
<a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=drive_web" target="_blank" class="flip-entry-link">
<div class="flip-entry-visual"><img src="https://lh3.googleusercontent.com/drive-storage/AJQabc=s190" alt=""/></div>
</a>
</div>
<div class="flip-entry-title">IMG_8972.JPG</div>
</div>
<div class="flip-entry" id="entry-9ZyXwVuTsRqPoNmLkJiHgFeDcBa98765" tabindex="0" role="link">
<div class="flip-entry-info">
<a href="https://drive.google.com/file/d/9ZyXwVuTsRqPoNmLkJiHgFeDcBa98765/view?usp=drive_web" target="_blank" class="flip-entry-link">
<div class="flip-entry-visual"><img src="https://lh3.googleusercontent.com/drive-storage/AJQdef=s190" alt=""/></div>
</a>
</div>
<div class="flip-entry-title">Premiación final.jpg</div>
</div>
<div class="flip-entry" id="entry-1FolderBcDeFgHiJkLmNoPqRsTuVwXy" tabindex="0" role="link">
<div class="flip-entry-info">
<a href="https://drive.google.com/drive/folders/1FolderBcDeFgHiJkLmNoPqRsTuVwXy" target="_blank" class="flip-entry-link">
<div class="flip-entry-visual"><img src="https://lh3.googleusercontent.com/drive-storage/AJQghi=s190" alt=""/></div>
</a>
</div>
<div class="flip-entry-title">Subcarpeta 2026</div>
</div>
</div>
</body></html>`;

describe("extractFotosDrive", () => {
  it("extrae el id y el nombre de cada archivo de la carpeta", () => {
    assert.deepEqual(extractFotosDrive(HTML_FIXTURE), [
      { id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345", name: "IMG_8972.JPG" },
      { id: "9ZyXwVuTsRqPoNmLkJiHgFeDcBa98765", name: "Premiación final.jpg" },
    ]);
  });

  it("ignora las subcarpetas: solo lista links /file/d/", () => {
    const fotos = extractFotosDrive(HTML_FIXTURE);
    assert.equal(fotos.some((f) => f.name.includes("Subcarpeta")), false);
    assert.equal(fotos.length, 2);
  });

  it("respeta el límite pedido", () => {
    assert.equal(extractFotosDrive(HTML_FIXTURE, 1).length, 1);
    assert.equal(extractFotosDrive(HTML_FIXTURE, 1)[0].name, "IMG_8972.JPG");
  });

  it("no repite el mismo id dos veces", () => {
    assert.equal(extractFotosDrive(HTML_FIXTURE.repeat(2)).length, 2);
  });

  it("devuelve [] con html vacío, basura o una pantalla de login", () => {
    assert.deepEqual(extractFotosDrive(""), []);
    assert.deepEqual(extractFotosDrive("<html><body>ingresá a tu cuenta</body></html>"), []);
  });
});

describe("altDeFoto", () => {
  it("usa el nombre del archivo cuando es descriptivo", () => {
    assert.equal(altDeFoto("Premiación final.jpg", 1), "Premiación final");
  });

  it("genera un alt genérico con nombres de cámara", () => {
    assert.equal(altDeFoto("IMG_8972.JPG", 0), "Foto del torneo 1");
    assert.equal(altDeFoto("img-0142.jpg", 4), "Foto del torneo 5");
  });

  it("cae al alt genérico si no hay nombre", () => {
    assert.equal(altDeFoto("", 2), "Foto del torneo 3");
  });
});

describe("fotoThumbUrl", () => {
  it("usa el ancho por defecto de 400", () => {
    assert.equal(
      fotoThumbUrl("ID123"),
      "https://drive.google.com/thumbnail?id=ID123&sz=w400",
    );
  });

  it("respeta el ancho pedido", () => {
    assert.equal(
      fotoThumbUrl("ID123", 1600),
      "https://drive.google.com/thumbnail?id=ID123&sz=w1600",
    );
  });
});

describe("urlFotoDrive", () => {
  it("apunta a la vista individual del archivo en Drive", () => {
    assert.equal(urlFotoDrive("ID123"), "https://drive.google.com/file/d/ID123/view");
  });
});

describe("urlAlbumDrive", () => {
  it("apunta a la carpeta completa en Drive", () => {
    assert.equal(
      urlAlbumDrive("CARPETA"),
      "https://drive.google.com/drive/folders/CARPETA",
    );
  });
});

describe("armarGaleria", () => {
  it("arma el alt, la miniatura y el link de Drive de cada foto", () => {
    assert.deepEqual(armarGaleria([{ id: "ABC", name: "IMG_1.JPG" }]), [
      {
        id: "ABC",
        name: "IMG_1.JPG",
        alt: "Foto del torneo 1",
        thumbUrl: "https://drive.google.com/thumbnail?id=ABC&sz=w400",
        url: "https://drive.google.com/file/d/ABC/view",
      },
    ]);
  });

  it("devuelve [] si no hay fotos", () => {
    assert.deepEqual(armarGaleria([]), []);
  });
});

// --- Rotación aleatoria cada 2 horas -----------------------------------------

/** Límite exacto de una ventana, para no depender del reloj real. */
const INICIO_VENTANA = DURACION_VENTANA_MS * 100;

const POOL = Array.from({ length: 40 }, (_, i) => `id-${i}`);

describe("ventanaDeTiempo", () => {
  it("dura 2 horas", () => {
    assert.equal(DURACION_VENTANA_MS, 7_200_000);
  });

  it("mantiene la misma ventana dentro de las 2 horas", () => {
    assert.equal(
      ventanaDeTiempo(INICIO_VENTANA),
      ventanaDeTiempo(INICIO_VENTANA + DURACION_VENTANA_MS - 1),
    );
  });

  it("cambia de ventana justo al cruzar las 2 horas", () => {
    assert.notEqual(
      ventanaDeTiempo(INICIO_VENTANA),
      ventanaDeTiempo(INICIO_VENTANA + DURACION_VENTANA_MS),
    );
  });
});

describe("elegirAlAzar", () => {
  it("es determinista: la misma semilla da la misma selección", () => {
    assert.deepEqual(elegirAlAzar(POOL, 12, 7), elegirAlAzar(POOL, 12, 7));
  });

  it("devuelve exactamente la cantidad pedida, sin repetir", () => {
    const seleccion = elegirAlAzar(POOL, 12, 7);
    assert.equal(seleccion.length, 12);
    assert.equal(new Set(seleccion).size, 12);
  });

  it("solo devuelve fotos que existen en el pool", () => {
    for (const id of elegirAlAzar(POOL, 12, 7)) {
      assert.ok(POOL.includes(id), `${id} no está en el pool`);
    }
  });

  it("no siempre agarra las primeras del álbum", () => {
    assert.notDeepEqual(elegirAlAzar(POOL, 12, 7), POOL.slice(0, 12));
  });

  it("ventanas distintas eligen fotos distintas", () => {
    const primera = elegirAlAzar(POOL, 12, ventanaDeTiempo(INICIO_VENTANA));
    const segunda = elegirAlAzar(
      POOL,
      12,
      ventanaDeTiempo(INICIO_VENTANA + DURACION_VENTANA_MS),
    );
    assert.notDeepEqual(primera, segunda);
  });

  it("a lo largo de varias ventanas va cubriendo todo el álbum", () => {
    const vistas = new Set<string>();
    for (let ventana = 0; ventana < 10; ventana++) {
      for (const id of elegirAlAzar(POOL, 12, ventana)) vistas.add(id);
    }
    assert.ok(
      vistas.size > 12,
      `esperaba más de 12 fotos distintas, hubo ${vistas.size}`,
    );
  });

  it("no se rompe si piden más fotos de las que hay", () => {
    assert.equal(elegirAlAzar(POOL, 999, 3).length, POOL.length);
  });

  it("devuelve [] con pool vacío o cantidad 0", () => {
    assert.deepEqual(elegirAlAzar([], 12, 1), []);
    assert.deepEqual(elegirAlAzar(POOL, 0, 1), []);
  });
});
