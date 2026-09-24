/**
 * Creates the organizer account (no public signup exists).
 * Usage: npx tsx scripts/create-organizer.ts email username password
 */
import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [email, username, password] = process.argv.slice(2);
  if (!email || !username || !password) {
    console.error("Usage: npx tsx scripts/create-organizer.ts <email> <username> <password>");
    process.exit(1);
  }
  const normalized = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: { passwordHash: hashPassword(password), username: normalizedUsername },
    create: { email: normalized, username: normalizedUsername, passwordHash: hashPassword(password) },
  });
  console.log(`Organizer ready: ${user.email} (${user.username})`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});