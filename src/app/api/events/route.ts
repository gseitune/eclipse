import { NextRequest } from "next/server";

import { subscribeSse } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // client gone; cleanup path handles removal
        }
      };

      send("ready", { ok: true });

      const unsubscribe = subscribeSse((event) =>
        send(event.type, event.data),
      );
      const heartbeat = setInterval(
        () => send("heartbeat", { t: Date.now() }),
        25_000,
      );

      const cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}