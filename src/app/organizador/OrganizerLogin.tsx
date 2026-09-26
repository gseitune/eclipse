"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/front/api";
import { ApiError } from "@/lib/front/types";

export function OrganizerLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      await login(username, password);
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-sand-300 bg-sand-50 text-stone-600 hover:bg-sand-100 transition-colors min-w-[44px] min-h-[44px]"
          aria-label="Volver a la página principal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-stone-900">
          Acceso al Organizador
        </h2>
      </div>

      <div>
        <label htmlFor="org-username" className="block text-sm font-medium text-stone-700 mb-1">
          Usuario
        </label>
        <input
          id="org-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
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
        className="w-full rounded-lg bg-amber-600/70 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700/70 disabled:opacity-50 transition-colors min-h-[44px]"
      >
        {pending ? "Iniciando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
