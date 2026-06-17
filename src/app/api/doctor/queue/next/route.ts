import { getCurrentUser } from "@/lib/auth";
import { mutateDb, notify, recalculateQueue } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser("doctor");
  if (!user) return fail("Unauthorized", 401);
  const { sessionId, action = "complete" } = await request.json();
  const result = await mutateDb((db) => {
    const doctor = db.doctorProfiles.find((item) => item.userId === user.id);
    if (!doctor) throw new Error("Doctor profile not found.");
    const today = new Date().toISOString().slice(0, 10);
    const queue = db.queueSessions.find((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today);
    if (!queue || queue.status !== "running") throw new Error("Start the queue before calling patients.");
    const rows = db.appointments
      .filter((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today)
      .sort((a, b) => a.queuePosition - b.queuePosition);
    const now = new Date().toISOString();
    const current = rows.find((item) => item.status === "current");
    if (current) {
      current.status = action === "no-show" ? "no-show" : "completed";
      current.completedAt = now;
      current.updatedAt = now;
    }
    const next = rows.find((item) => item.status === "waiting" || item.status === "confirmed");
    if (!next) {
      queue.currentQueueNumber = undefined;
      queue.status = "completed";
      queue.endedAt = now;
      queue.lastUpdatedAt = now;
      return { queue, current: null };
    }
    next.status = "current";
    next.calledAt = now;
    next.estimatedTime = 0;
    next.updatedAt = now;
    queue.currentQueueNumber = next.queueNumber;
    queue.lastUpdatedAt = now;
    notify(db, {
      userId: next.patientId,
      appointmentId: next.id,
      title: "You are being called",
      message: `Please proceed now. Queue ${next.queueNumber} is current.`,
      type: "patient_called"
    });
    const closePatients = rows.filter((item) => item.status === "waiting" && item.queuePosition > next.queuePosition && item.queuePosition <= next.queuePosition + 3);
    for (const item of closePatients) {
      notify(db, {
        userId: item.patientId,
        appointmentId: item.id,
        title: "Your turn is close",
        message: `Only ${item.queuePosition - next.queuePosition} patient(s) before you.`,
        type: "queue_close"
      });
    }
    recalculateQueue(db, queue);
    return { queue, current: next };
  }).catch((error: Error) => error);
  if (result instanceof Error) return fail(result.message);
  return ok(result);
}
