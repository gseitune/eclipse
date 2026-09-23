import { connection } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import type { StateSnapshot } from "@/lib/front/types";
import { PublicHome } from "@/components/public/PublicHome";

export default async function Home() {
  await connection();

  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost:3000";

  let initial: StateSnapshot | null = null;
  let fetchError = false;

  try {
    const res = await fetch(`${proto}://${host}/api/state`, { cache: "no-store" });
    if (!res.ok) {
      fetchError = true;
    } else {
      initial = await res.json();
    }
  } catch {
    fetchError = true;
  }

  return (
    <main className="relative mx-auto w-full min-h-screen">
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
        <PublicHome initial={initial} />
        {fetchError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <Link
              href="/"
              className="rounded-xl bg-red-950/90 px-4 py-2 text-sm text-red-100 ring-1 ring-red-700/50 backdrop-blur hover:bg-red-900 transition-colors"
            >
              No se pudo conectar. Recargá.
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
