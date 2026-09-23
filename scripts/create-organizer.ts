/**
 * Creates the organizer account (no public signup exists).
 * Usage: npx tsx scripts/create-organizer.ts email password
 */
import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-organizer.ts <email> <password>");
    process.exit(1);
  }
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: { passwordHash: hashPassword(password) },
    create: { email: normalized, passwordHash: hashPassword(password) },
  });
  console.log(`Organizer ready: ${user.email}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});