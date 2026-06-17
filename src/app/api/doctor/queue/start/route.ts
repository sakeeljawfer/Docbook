import { getCurrentUser } from "@/lib/auth";
import { mutateDb, notify, recalculateQueue } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser("doctor");
  if (!user) return fail("Unauthorized", 401);
  const { sessionId } = await request.json();
  const result = await mutateDb((db) => {
    const doctor = db.doctorProfiles.find((item) => item.userId === user.id);
    if (!doctor) throw new Error("Doctor profile not found.");
    const today = new Date().toISOString().slice(0, 10);
    let queue = db.queueSessions.find((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today);
    const now = new Date().toISOString();
    if (!queue) {
      queue = { id: crypto.randomUUID(), doctorId: doctor.id, sessionId, appointmentDate: today, status: "not_started", lastUpdatedAt: now };
      db.queueSessions.push(queue);
    }
    queue.status = "running";
    queue.startedAt = queue.startedAt ?? now;
    queue.lastUpdatedAt = now;
    for (const appointment of db.appointments.filter((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today)) {
      if (appointment.status === "confirmed") {
        appointment.status = "waiting";
        notify(db, {
          userId: appointment.patientId,
          appointmentId: appointment.id,
          title: "Doctor session started",
          message: `${doctor.doctorName} has started the session.`,
          type: "session_started"
        });
      }
    }
    recalculateQueue(db, queue);
    return queue;
  }).catch((error: Error) => error);
  if (result instanceof Error) return fail(result.message);
  return ok({ queue: result });
}
