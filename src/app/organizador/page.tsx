import { cookies } from "next/headers";
import { verifySessionToken, sessionCookieName } from "@/lib/auth";
import { OrganizerPanel } from "./OrganizerPanel";
import { OrganizerLogin } from "./OrganizerLogin";

export default async function OrganizadorPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySessionToken(token);

  if (session) {
    return (
      <main className="min-h-screen">
        <OrganizerPanel email={session.email} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <OrganizerLogin />
      </div>
    </main>
  );
}
