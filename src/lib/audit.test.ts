import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { auditWrite } from "./audit";

/** Runs `fn` with console.log captured, returning the lines it wrote. */
function captureLog(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = ((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  }) as typeof console.log;
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

function payloadOf(line: string): Record<string, unknown> {
  return JSON.parse(line.slice("[AUDIT] ".length)) as Record<string, unknown>;
}

describe("auditWrite", () => {
  it("emits one greppable line carrying the operation, the ids and a timestamp", () => {
    const lines = captureLog(() =>
      auditWrite({
        op: "clearCascadeResults",
        etapaId: "etapa-1",
        matchId: "match-1",
        stage: "GROUPS",
        count: 10,
      }),
    );

    assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith("[AUDIT] "), `missing prefix: ${lines[0]}`);

    const payload = payloadOf(lines[0]);
    assert.equal(payload.op, "clearCascadeResults");
    assert.equal(payload.etapaId, "etapa-1");
    assert.equal(payload.matchId, "match-1");
    assert.equal(payload.stage, "GROUPS");
    assert.equal(payload.count, 10);
    assert.match(
      String(payload.at),
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("keeps an event that carries only an operation", () => {
    const lines = captureLog(() => auditWrite({ op: "finalizeBrackets" }));

    assert.equal(lines.length, 1);
    const payload = payloadOf(lines[0]);
    assert.equal(payload.op, "finalizeBrackets");
    assert.equal(payload.etapaId, undefined);
    assert.equal(payload.count, undefined);
  });

  it("never throws, and stays silent, when the payload cannot be serialised", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const lines = captureLog(() => {
      assert.doesNotThrow(() => auditWrite({ op: "boom", detail: circular }));
    });

    assert.deepEqual(lines, []);
  });
});
