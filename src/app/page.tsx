import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

const ZONE_STYLES = {
  A: {
    label: "Zona A",
    badge: "bg-sky-100 text-sky-800 ring-sky-600/20",
  },
  B: {
    label: "Zona B",
    badge: "bg-rose-100 text-rose-800 ring-rose-600/20",
  },
} as const;

export default async function Home() {
  await connection(); // keep DB reads out of prerendering

  const teams = await prisma.team.findMany({
    orderBy: [{ zone: "asc" }, { name: "asc" }],
  });

  const zoneA = teams.filter((team) => team.zone === "A");
  const zoneB = teams.filter((team) => team.zone === "B");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Circuito Mixto Principiantes 2026 · Etapa 5
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
          Eclipse
        </h1>
        <p className="mt-3 text-lg text-zinc-600">
          Torneo de beach vóley — una cancha, dos zonas, la final a la tarde.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        {(["A", "B"] as const).map((zone) => {
          const zoneTeams = zone === "A" ? zoneA : zoneB;
          const style = ZONE_STYLES[zone];
          return (
            <div
              key={zone}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {style.label}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
                >
                  {zoneTeams.length} equipos
                </span>
              </div>
              {zoneTeams.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Sin equipos cargados todavía.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {zoneTeams.map((team) => (
                    <li
                      key={team.id}
                      className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                    >
                      {team.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <footer className="mt-10 border-t border-zinc-200 pt-5 text-sm text-zinc-500">
        Base de datos conectada · {teams.length} equipos en total.
      </footer>
    </main>
  );
}