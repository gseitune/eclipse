import { connection } from "next/server";
import { headers } from "next/headers";
import { AgendaView } from "@/components/public/AgendaView";
import type { StateSnapshot } from "@/lib/front/types";

export default async function AgendaPage() {
  await connection();

  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost:3000";

  let initial: StateSnapshot | null = null;

  try {
    const res = await fetch(`${proto}://${host}/api/state`, { cache: "no-store" });
    if (res.ok) {
      initial = await res.json();
    }
  } catch {
    // Silently fall back to client-side fetch in AgendaView
  }

  return <AgendaView initial={initial} />;
}
