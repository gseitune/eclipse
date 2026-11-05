import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

/** Returns the YAML block of a step, from "- name: X" to the next step. */
function stepBlock(name) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.ok(start !== -1, `workflow step "${name}" is missing`);
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {0,6}- /.test(lines[i]) || /^\S/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

test("ci: generate step provides every env var prisma.config.ts requires", () => {
  const config = readFileSync(join(root, "prisma.config.ts"), "utf8");
  const required = [...config.matchAll(/env\(\s*["']([A-Z0-9_]+)["']\s*\)/g)].map((m) => m[1]);
  assert.ok(required.length > 0, "expected prisma.config.ts to declare env() vars");
  const block = stepBlock("Generate Prisma client");
  for (const name of required) {
    assert.match(block, new RegExp(`^\\s+${name}:`, "m"), `prisma generate step must set ${name}`);
  }
});

test("ci: README badge points at a workflow file that exists", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const match = readme.match(/actions\/workflows\/([^/)\s]+)\/badge\.svg/);
  assert.ok(match, "README must embed a GitHub Actions badge");
  assert.ok(
    existsSync(join(root, ".github/workflows", match[1])),
    `.github/workflows/${match[1]} must exist`,
  );
});

test("ci: runs on pushes to main and on pull requests", () => {
  assert.match(workflow, /\n\s+push:\s*\n\s+branches:\s*\[main\]/);
  assert.match(workflow, /\n\s+pull_request:/);
});

test("ci: installs deps and runs the typecheck and test scripts", () => {
  assert.match(workflow, /run:\s*npm ci\b/);
  assert.match(workflow, /run:\s*npm run typecheck\b/);
  assert.match(workflow, /run:\s*npm test\b/);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts.typecheck, "package.json must define a typecheck script");
  assert.ok(pkg.scripts.test, "package.json must define a test script");
});
