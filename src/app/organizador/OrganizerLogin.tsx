"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/front/api";
import { ApiError } from "@/lib/front/types";

export function OrganizerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      await login(email, password);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Credenciales incorrectas");
      } else {
        setError("Error al iniciar sesión. Intentá de nuevo.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold text-stone-900">Acceso al Organizador</h2>

      <div>
        <label htmlFor="org-email" className="block text-sm font-medium text-stone-700 mb-1">
          Email
        </label>
        <input
          id="org-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
        />
      </div>

      <div>
        <label htmlFor="org-password" className="block text-sm font-medium text-stone-700 mb-1">
          Contraseña
        </label>
        <input
          id="org-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-inset ring-sand-300 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[44px]"
      >
        {pending ? "Iniciando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
