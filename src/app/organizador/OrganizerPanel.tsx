"use client";

import { logout } from "@/lib/front/api";
import { useState } from "react";

export function OrganizerPanel({ email }: { email: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Silently proceed — clear cookie via hard nav fallback
    } finally {
      setLoggingOut(false);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/organizador";
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/90 backdrop-blur ring-1 ring-inset ring-sand-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold text-stone-900">Panel organizador</h1>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-sm text-stone-500">
          Bienvenido, {email}
        </p>
        <p className="mt-2 text-sm text-stone-400">
          Próximamente
        </p>
      </main>
    </div>
  );
}
