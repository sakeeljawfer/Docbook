import { readDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) return fail("doctorId is required.");
  const db = await readDb();
  const doctor = db.doctorProfiles.find((item) => item.id === doctorId);
  if (!doctor) return fail("Doctor not found.", 404);
  const today = new Date().toISOString().slice(0, 10);
  const queues = db.queueSessions.filter((item) => item.doctorId === doctorId && item.appointmentDate === today);
  const queue = queues.find((item) => item.status === "running") ?? queues[0];
  const rows = db.appointments.filter((item) => item.doctorId === doctorId && item.appointmentDate === today && (!queue || item.sessionId === queue.sessionId));
  const next = rows.filter((item) => item.status === "waiting" || item.status === "confirmed").sort((a, b) => a.queuePosition - b.queuePosition)[0];
  return ok({
    board: {
      doctorName: doctor.doctorName,
      clinicName: doctor.clinicName,
      date: today,
      session: db.doctorSessions.find((item) => item.id === queue?.sessionId)?.sessionName ?? "Today",
      currentQueueNumber: queue?.currentQueueNumber ?? "-",
      nextQueueNumber: next?.queueNumber ?? "-",
      totalWaiting: rows.filter((item) => item.status === "waiting" || item.status === "confirmed").length,
      estimatedDelay: rows.reduce((max, item) => Math.max(max, item.estimatedTime), 0),
      lastUpdatedAt: queue?.lastUpdatedAt ?? new Date().toISOString(),
      status: queue?.status ?? "not_started"
    }
  });
}
