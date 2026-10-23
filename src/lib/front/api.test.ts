import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { ApiError } from "./types";
import { fetchScheduleBoard, fetchState } from "./api";

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
