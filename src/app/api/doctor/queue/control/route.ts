import { getCurrentUser } from "@/lib/auth";
import { mutateDb, notify, recalculateQueue } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser("doctor");
  if (!user) return fail("Unauthorized", 401);
  const { sessionId, action } = await request.json();
  if (!sessionId || !["pause", "resume", "end"].includes(action)) return fail("Valid session and action are required.");

  const result = await mutateDb((db) => {
    const doctor = db.doctorProfiles.find((item) => item.userId === user.id);
    if (!doctor) throw new Error("Doctor profile not found.");
    const today = new Date().toISOString().slice(0, 10);
    const queue = db.queueSessions.find((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today);
    if (!queue) throw new Error("Queue session not found.");
    const now = new Date().toISOString();

    if (action === "pause") {
      if (queue.status === "completed") throw new Error("Completed sessions cannot be paused.");
      queue.status = "paused";
      queue.endedAt = undefined;
    }
    if (action === "resume") {
      queue.status = "running";
      queue.endedAt = undefined;
    }
    if (action === "end") {
      queue.status = "completed";
      queue.endedAt = now;
    }
    queue.lastUpdatedAt = now;
    recalculateQueue(db, queue);

    for (const appointment of db.appointments.filter((item) =>
      item.doctorId === doctor.id &&
      item.sessionId === sessionId &&
      item.appointmentDate === today &&
      (item.status === "waiting" || item.status === "confirmed")
    )) {
      notify(db, {
        userId: appointment.patientId,
        appointmentId: appointment.id,
        title: action === "pause" ? "Queue paused" : action === "resume" ? "Queue resumed" : "Session ended",
        message: `${doctor.clinicName} queue is now ${queue.status.replace("_", " ")}.`,
        type: `queue_${queue.status}`
      });
    }

    return queue;
  }).catch((error: Error) => error);

  if (result instanceof Error) return fail(result.message);
  return ok({ queue: result });
}
