"use client";

import { useEffect, useState } from "react";

import { ApiError, fetchGalleryFolder, saveGalleryFolder } from "@/lib/front/api";
import type { Circuit } from "@/lib/front/types";

/**
 * Drive folder that feeds the public gallery of ONE circuit. Mounted with a
 * `key={circuit}` so switching circuit starts from a clean form.
 */
export function GaleriaSection({ circuit }: { readonly circuit: Circuit }) {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGalleryFolder(circuit)
      .then((resp) => {
        if (cancelled) return;
        setSaved(resp.folder);
        setUrl(resp.folder ?? "");
      })
      .catch((err) => {
        if (!cancelled) {
          setMsg(err instanceof ApiError ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [circuit]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const resp = await saveGalleryFolder(circuit, url.trim());
      setSaved(resp.folder);
      setUrl(resp.folder ?? "");
      setMsg(
        resp.folder
          ? "Link guardado. La home lo toma en la próxima carga."
          : "Volviste al álbum por defecto.",
      );
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const circuito = circuit === "INTERMEDIOS" ? "Intermedios" : "Principiantes";
  const ok = msg?.startsWith("Link") || msg?.startsWith("Volviste");

  return (
    <div className="rounded-xl border border-sand-300 bg-sand-50 px-5 py-5 ring-1 ring-inset ring-sand-200">
      <span className="block text-base font-bold text-stone-900">
        Fotos del circuito
      </span>
      <span className="mt-0.5 block text-xs text-stone-500">
        Carpeta de Drive con las fotos de {circuito}
      </span>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="galeria-folder"
            className="block text-xs font-medium text-stone-600 mb-1"
          >
            Link de la carpeta de Drive
          </label>
          <input
            id="galeria-folder"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saving || loading}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
          />
          <p className="mt-1 text-xs text-stone-400">
            Pegá el link de la carpeta compartida. Si lo dejás vacío, la home usa
            el álbum por defecto.
          </p>
        </div>
        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              ok
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
            role="alert"
          >
            {msg}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500">
            {loading
              ? "Leyendo…"
              : saved
                ? "Carpeta propia configurada"
                : "Usando el álbum por defecto"}
          </span>
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {saving ? "Guardando…" : "Guardar link"}
          </button>
        </div>
      </form>
    </div>
  );
}
