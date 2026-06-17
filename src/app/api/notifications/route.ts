import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Unauthorized", 401);
  const db = await readDb();
  return ok({ notifications: db.notifications.filter((item) => item.userId === user.id).slice(0, 20) });
}
