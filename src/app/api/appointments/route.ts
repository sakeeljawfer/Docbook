import { getCurrentUser } from "@/lib/auth";
import { appointmentView, mutateDb, readDb, notify } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Unauthorized", 401);
  const db = await readDb();
  const doctor = db.doctorProfiles.find((item) => item.userId === user.id);
  const rows = db.appointments.filter((item) => {
    if (user.role === "admin") return true;
    if (user.role === "doctor") return item.doctorId === doctor?.id;
    return item.patientId === user.id;
  });
  return ok({ appointments: rows.map((item) => appointmentView(db, item)) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser("patient");
  if (!user) return fail("Please log in as a patient to book.", 401);
  const { doctorId, sessionId, appointmentDate, reason } = await request.json();
  if (!doctorId || !sessionId || !appointmentDate) return fail("Doctor, session, and date are required.");
  if (appointmentDate < new Date().toISOString().slice(0, 10)) return fail("Past dates cannot be booked.");

  const result = await mutateDb((db) => {
    const session = db.doctorSessions.find((item) => item.id === sessionId && item.doctorId === doctorId);
    if (!session) throw new Error("Invalid session.");
    const sameDay = db.appointments.filter((item) => item.doctorId === doctorId && item.sessionId === sessionId && item.appointmentDate === appointmentDate);
    if (sameDay.some((item) => item.patientId === user.id && item.status !== "cancelled")) {
      throw new Error("You already have an appointment for this doctor and session.");
    }
    if (sameDay.filter((item) => item.status !== "cancelled").length >= session.maxPatients) {
      throw new Error("This session is fully booked.");
    }
    const position = sameDay.length + 1;
    const queueNumber = `${session.sessionName[0].toUpperCase()}${String(position).padStart(3, "0")}`;
    const doctor = db.doctorProfiles.find((item) => item.id === doctorId);
    const now = new Date().toISOString();
    const appointment = {
      id: crypto.randomUUID(),
      patientId: user.id,
      doctorId,
      sessionId,
      appointmentDate,
      queueNumber,
      queuePosition: position,
      status: "confirmed" as const,
      reason,
      estimatedTime: Math.max(0, position - 1) * (doctor?.averageConsultationMinutes ?? 10),
      createdAt: now,
      updatedAt: now
    };
    db.appointments.push(appointment);
    if (!db.queueSessions.some((item) => item.doctorId === doctorId && item.sessionId === sessionId && item.appointmentDate === appointmentDate)) {
      db.queueSessions.push({
        id: crypto.randomUUID(),
        doctorId,
        sessionId,
        appointmentDate,
        status: "not_started",
        lastUpdatedAt: now
      });
    }
    notify(db, {
      userId: user.id,
      appointmentId: appointment.id,
      title: "Appointment confirmed",
      message: `Your queue number is ${queueNumber}.`,
      type: "appointment_confirmed"
    });
    return appointmentView(db, appointment);
  }).catch((error: Error) => error);

  if (result instanceof Error) return fail(result.message);
  return ok({ appointment: result });
}
