This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Public beta version badge

The home shows a `BETA TEST 1.<n>` ribbon. The number comes from
`src/lib/beta-commits.ts`, a committed counter that `.githooks/pre-commit` bumps
by one on every commit and stages, so the value ships with the commit it labels.

Counting git history at build time does not work: a Vercel build has no usable
history, so the count collapsed to the `1.1` baseline on every deploy.

Enable the hook once per clone:

```bash
git config core.hooksPath .githooks
```

## One-shot scripts

Scripts under `scripts/` read the same `DATABASE_URL` / `TURSO_DATABASE_URL` the
app uses, so a helper written for a local file database can hit production when
the production credentials happen to be exported in that shell. A loaded
tournament was wiped that way once, so every script under `scripts/` that writes
must clear the guard before its first write:

```ts
assertRemoteWriteAllowed({
  script: "my-script.ts",
  action: "what it is about to write, in one line",
});
```

`scripts/lib/remote-write-guard.ts` lets a local `file:` database pass silently,
refuses an unset URL, and refuses a remote database unless `--allow-remote` (or
`ALLOW_REMOTE_WRITE=1`) is passed explicitly. Tokens and credentials are masked
in every message. Two rules follow:

- One-shot migration/reset helpers do not stay in the repo: they are run once
  and deleted, because a script that wipes data and lives forever in the tree is
  a foot-gun on tournament day, not a tool (`git log -- scripts/<name>` still
  has any deleted one).
- Never export production credentials in a shell that also runs local helpers.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
