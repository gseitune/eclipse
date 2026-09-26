import { connection } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import type { StateSnapshot } from "@/lib/front/types";
import { PublicHome } from "@/components/public/PublicHome";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  await connection();

  const params = await searchParams;
  const isPreview = params.preview === "1";

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
    <>
      <PublicHome initial={initial} isPreview={isPreview} />
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
    </>
  );
}
