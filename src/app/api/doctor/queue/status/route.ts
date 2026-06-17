import { getCurrentUser } from "@/lib/auth";
import { appointmentView, readDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser("doctor");
  if (!user) return fail("Unauthorized", 401);
  const db = await readDb();
  const doctor = db.doctorProfiles.find((item) => item.userId === user.id);
  if (!doctor) return fail("Doctor profile not found.", 404);
  const today = new Date().toISOString().slice(0, 10);
  const appointments = db.appointments
    .filter((item) => item.doctorId === doctor.id && item.appointmentDate === today)
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((item) => appointmentView(db, item));
  const queues = db.queueSessions.filter((item) => item.doctorId === doctor.id && item.appointmentDate === today);
  return ok({ doctor, appointments, queues });
}
