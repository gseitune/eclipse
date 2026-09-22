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

const STATUS_LABELS = {
  PENDING: { label: "Pending", classes: "bg-zinc-100 text-zinc-600 ring-zinc-500/20" },
  WINNER_ONLY: { label: "Winner only", classes: "bg-amber-100 text-amber-800 ring-amber-600/20" },
  COMPLETE: { label: "Complete", classes: "bg-emerald-100 text-emerald-800 ring-emerald-600/20" },
} as const;

type BracketStage = "SEMIFINAL_1" | "SEMIFINAL_2" | "FINAL";

const BRACKET_LABELS: Record<BracketStage, { title: string; match: string }> = {
  SEMIFINAL_1: { title: "Semifinal 1", match: "1° Zona A (A1) vs 2° Zona B (B2)" },
  SEMIFINAL_2: { title: "Semifinal 2", match: "1° Zona B (B1) vs 2° Zona A (A2)" },
  FINAL: { title: "Grand Final", match: "Ganador Semifinal 1 vs Ganador Semifinal 2" },
} as const;

export default async function Home() {
  await connection(); // keep DB reads out of prerendering

  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ zone: "asc" }, { name: "asc" }],
    }),
    prisma.match.findMany({
      include: { teamA: true, teamB: true },
      orderBy: { slot: "asc" },
    }),
  ]);

  const zoneA = teams.filter((team) => team.zone === "A");
  const zoneB = teams.filter((team) => team.zone === "B");
  const groupA = matches.filter(
    (match) => match.stage === "GROUPS" && match.zone === "A",
  );
  const groupB = matches.filter(
    (match) => match.stage === "GROUPS" && match.zone === "B",
  );
  const bracket = matches.filter((match) => match.stage !== "GROUPS");

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

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
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

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900">
          Partidos
        </h2>

        <div className="space-y-8">
          {[
            { zone: "A" as const, list: groupA, style: ZONE_STYLES.A },
            { zone: "B" as const, list: groupB, style: ZONE_STYLES.B },
          ].map(({ zone, list, style }) => (
            <div key={zone}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Fase de grupos · {style.label}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.badge}`}
                >
                  {list.length} partidos
                </span>
              </div>
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {list.map((match) => (
                  <li
                    key={match.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="w-24 shrink-0 text-sm tabular-nums text-zinc-500">
                      {match.timeLabel}
                    </span>
                    <span className="flex-1 text-sm font-medium text-zinc-900">
                      {match.teamA?.name ?? "—"} vs {match.teamB?.name ?? "—"}
                    </span>
                    <StatusBadge status={match.resultStatus} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Eliminatorias
            </h3>
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              {bracket.map((match) => {
                const label =
                  BRACKET_LABELS[match.stage as BracketStage];
                return (
                  <li
                    key={match.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="w-24 shrink-0 text-sm tabular-nums text-zinc-500">
                      {match.timeLabel}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-semibold text-zinc-400">
                        {label.title}
                      </span>
                      <span className="text-sm font-medium text-zinc-900">
                        {match.teamA?.name ? `${match.teamA.name} vs ${match.teamB?.name}` : label.match}
                      </span>
                    </span>
                    <StatusBadge status={match.resultStatus} />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-zinc-200 pt-5 text-sm text-zinc-500">
        Base de datos conectada · {teams.length} equipos · {matches.length}
        partidos cargados.
      </footer>
    </main>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  const current = STATUS_LABELS[status];
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${current.classes}`}
    >
      {current.label}
    </span>
  );
}