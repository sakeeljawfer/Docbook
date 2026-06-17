import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return ok({ user: user ? { id: user.id, role: user.role, name: user.name, phone: user.phone, email: user.email } : null });
}

export async function DELETE() {
  await clearSessionCookie();
  return ok({ success: true });
}
