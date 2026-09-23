import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

const ZONE_STYLES = {
  A: {
    label: "Zona A",
    badge: "bg-amber-100 text-amber-800 ring-amber-600/30",
    accent: "border-l-amber-400",
  },
  B: {
    label: "Zona B",
    badge: "bg-teal-100 text-teal-800 ring-teal-600/30",
    accent: "border-l-teal-400",
  },
} as const;

const STATUS_LABELS = {
  PENDING: { label: "Pending", classes: "bg-stone-200/70 text-stone-600 ring-stone-500/20" },
  WINNER_ONLY: { label: "Winner only", classes: "bg-amber-100 text-amber-800 ring-amber-600/30" },
  COMPLETE: { label: "Complete", classes: "bg-emerald-100 text-emerald-800 ring-emerald-600/30" },
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
    <main className="relative mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/jungle-bg.jpg"
          alt=""
          className="h-full w-full object-cover opacity-70"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sand-50/50 via-sand-100/30 to-sand-200/50" />
      </div>

      <div className="relative z-10">
      <header className="mb-12 text-center">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div className="absolute left-1/2 top-1/2 h-[243px] w-[243px] -translate-x-1/2 -translate-y-1/2 rounded-full -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sun-transparent.png"
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
          <div className="absolute -right-2 -bottom-2 h-16 w-16 animate-spin-slow overflow-hidden rounded-full ring-2 ring-amber-100 drop-shadow-[0_6px_10px_rgba(28,25,23,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ball-mikasa.jpg"
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        </div>

        <h1 className="bg-gradient-to-r from-emerald-950 via-emerald-700 to-green-600 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
          SELVARENA
        </h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          Circuito Mixto Principiantes 2026
        </p>
        <p className="mt-2 text-2xl font-bold text-black">ETAPA 5</p>

        <div className="mt-6 flex justify-center gap-3">
          <span className="rounded-full bg-sand-100 px-3 py-1 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-sand-300">
            {teams.length} equipos
          </span>
          <span className="rounded-full bg-sand-100 px-3 py-1 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-sand-300">
            {matches.length} partidos
          </span>
        </div>
      </header>

      <section className="mb-10 grid gap-5 sm:grid-cols-2">
        {(["A", "B"] as const).map((zone) => {
          const zoneTeams = zone === "A" ? zoneA : zoneB;
          const style = ZONE_STYLES[zone];
          return (
            <div
              key={zone}
              className={`rounded-2xl border border-l-4 border-sand-200 bg-white/70 p-5 shadow-sm backdrop-blur ${style.accent}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-stone-900">
                  {style.label}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}
                >
                  {zoneTeams.length} equipos
                </span>
              </div>
              {zoneTeams.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Sin equipos cargados todavía.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {zoneTeams.map((team) => (
                    <li
                      key={team.id}
                      className="rounded-lg bg-sand-50 px-3 py-2 text-sm font-medium text-stone-800"
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
        <h2 className="mb-2 text-xl font-bold tracking-tight text-stone-900">
          Partidos
        </h2>
        <p className="mb-6 text-sm text-stone-500">
          Una sola cancha, partidos de 20 minutos desde las 10:00.
        </p>

        <div className="space-y-8">
          {[
            { zone: "A" as const, list: groupA, style: ZONE_STYLES.A },
            { zone: "B" as const, list: groupB, style: ZONE_STYLES.B },
          ].map(({ zone, list, style }) => (
            <div key={zone}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Fase de grupos · {style.label}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.badge}`}
                >
                  {list.length} partidos
                </span>
              </div>
              <ul className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white/70 backdrop-blur">
                {list.map((match) => (
                  <li
                    key={match.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-sand-50"
                  >
                    <span className="w-24 shrink-0 font-mono text-sm tabular-nums text-stone-500">
                      {match.timeLabel}
                    </span>
                    <span className="flex-1 text-sm font-medium text-stone-900">
                      {match.teamA?.name ?? "—"} vs {match.teamB?.name ?? "—"}
                    </span>
                    <StatusBadge status={match.resultStatus} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Eliminatorias
            </h3>
            <ul className="divide-y divide-sand-200 overflow-hidden rounded-2xl border border-sand-200 bg-white/70 backdrop-blur">
              {bracket.map((match) => {
                const label =
                  BRACKET_LABELS[match.stage as BracketStage];
                return (
                  <li
                    key={match.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-sand-50"
                  >
                    <span className="w-24 shrink-0 font-mono text-sm tabular-nums text-stone-500">
                      {match.timeLabel}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-amber-700">
                        {label.title}
                      </span>
                      <span className="text-sm font-medium text-stone-900">
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

      <footer className="mt-10 border-t border-sand-200 pt-5 text-sm text-stone-500">
        Base de datos conectada · {teams.length} equipos · {matches.length}
        partidos cargados.
      </footer>
      </div>
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