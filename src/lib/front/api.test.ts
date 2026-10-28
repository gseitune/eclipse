import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { ApiError } from "./types";
import { fetchScheduleBoard, fetchState, zonificationGenerate } from "./api";

/**
 * The panel and the agenda read every API response through handleResponse,
 * which used to call res.json() directly. A route that throws without a
 * try/catch answers 500 with an EMPTY body, so res.json() blew up with
 * "SyntaxError: Unexpected end of JSON input" and the user never saw what
 * actually failed. These tests pin the contract: a failed request always
 * rejects with ApiError and a readable message.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(make: () => Response) {
  globalThis.fetch = (async () => make()) as typeof fetch;
}

describe("handleResponse", () => {
  it("rejects with ApiError when a failing route answers with an empty body", async () => {
    stubFetch(() => new Response("", { status: 500 }));

    await assert.rejects(fetchScheduleBoard, (error: unknown) => {
      assert.ok(error instanceof ApiError, "expected ApiError, got " + String(error));
      assert.equal(error.status, 500);
      assert.ok(error.message.length > 0);
      assert.ok(!(error instanceof SyntaxError));
      return true;
    });
  });

  it("rejects with ApiError when a failing route answers with non-JSON", async () => {
    stubFetch(
      () =>
        new Response("<html>Internal Server Error</html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
    );

    await assert.rejects(fetchState, (error: unknown) => {
      assert.ok(error instanceof ApiError, "expected ApiError, got " + String(error));
      assert.equal(error.status, 500);
      return true;
    });
  });

  it("keeps the server error message when the body is JSON", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: "SERVER_ERROR: 401" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );

    await assert.rejects(fetchState, (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, "SERVER_ERROR: 401");
      return true;
    });
  });

  it("returns the parsed body when the request succeeds", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ schedule: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    assert.deepEqual(await fetchScheduleBoard(), { schedule: [] });
  });
});

describe("fetchState query", () => {
  function capture(): string[] {
    const seen: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ etapaId: "e3" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    return seen;
  }

  it("pins the stage next to the circuit, so an older fecha is reachable", async () => {
    const seen = capture();
    await fetchState("INTERMEDIOS", "e3");

    assert.equal(seen.length, 1);
    const url = new URL(seen[0]!, "http://localhost");
    assert.equal(url.pathname, "/api/state");
    assert.equal(url.searchParams.get("circuit"), "INTERMEDIOS");
    assert.equal(url.searchParams.get("etapa"), "e3");
  });

  it("omits the etapa param when the panel follows the newest stage", async () => {
    const seen = capture();
    await fetchState("INTERMEDIOS", null);

    const url = new URL(seen[0]!, "http://localhost");
    assert.equal(url.searchParams.get("circuit"), "INTERMEDIOS");
    assert.equal(url.searchParams.get("etapa"), null);
  });
});

describe("zonification actions", () => {
  it("send the etapaId, so the re-arm lands on the pinned stage", async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ mapping: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await zonificationGenerate("e3");

    // Without the id the server resolves the stage with the NEWEST date, so a
    // pinned older stage would be re-armed behind the organizer's back.
    assert.deepEqual(bodies[0], { action: "generate", etapaId: "e3" });
  });
});
