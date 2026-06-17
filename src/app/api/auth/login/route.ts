import bcrypt from "bcryptjs";
import { readDb } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { phone, password } = await request.json();
  if (!phone || !password) return fail("Phone and password are required.");
  const db = await readDb();
  const user = db.users.find((item) => item.phone === phone);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return fail("Invalid login details.", 401);
  if (user.status !== "active") return fail("This account is not active.", 403);
  await setSessionCookie(await signSession(user));
  return ok({ user: { id: user.id, role: user.role, name: user.name, phone: user.phone, email: user.email } });
}
