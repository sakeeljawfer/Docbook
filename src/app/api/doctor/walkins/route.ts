import { getCurrentUser } from "@/lib/auth";
import { appointmentView, mutateDb, notify, recalculateQueue } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser("doctor");
  if (!user) return fail("Unauthorized", 401);
  const { sessionId, name, phone, reason } = await request.json();
  if (!sessionId || !name || !phone) return fail("Session, patient name, and phone are required.");

  const result = await mutateDb((db) => {
    const doctor = db.doctorProfiles.find((item) => item.userId === user.id);
    if (!doctor) throw new Error("Doctor profile not found.");
    const session = db.doctorSessions.find((item) => item.id === sessionId && item.doctorId === doctor.id);
    if (!session) throw new Error("Session not found.");
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    let patient = db.users.find((item) => item.phone === phone && item.role === "patient");
    if (!patient) {
      patient = {
        id: crypto.randomUUID(),
        role: "patient",
        name,
        phone,
        passwordHash: "walk-in-no-login",
        status: "active",
        createdAt: now,
        updatedAt: now
      };
      db.users.push(patient);
    }

    const sameDay = db.appointments.filter((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today);
    if (sameDay.filter((item) => item.status !== "cancelled").length >= session.maxPatients) throw new Error("This session is fully booked.");
    const position = sameDay.length + 1;
    const queueNumber = `${session.sessionName[0].toUpperCase()}${String(position).padStart(3, "0")}`;
    const appointment = {
      id: crypto.randomUUID(),
      patientId: patient.id,
      doctorId: doctor.id,
      sessionId,
      appointmentDate: today,
      queueNumber,
      queuePosition: position,
      status: "waiting" as const,
      reason: reason || "Walk-in patient",
      estimatedTime: Math.max(0, position - 1) * doctor.averageConsultationMinutes,
      createdAt: now,
      updatedAt: now
    };
    db.appointments.push(appointment);

    let queue = db.queueSessions.find((item) => item.doctorId === doctor.id && item.sessionId === sessionId && item.appointmentDate === today);
    if (!queue) {
      queue = { id: crypto.randomUUID(), doctorId: doctor.id, sessionId, appointmentDate: today, status: "not_started", lastUpdatedAt: now };
      db.queueSessions.push(queue);
    }
    recalculateQueue(db, queue);
    notify(db, {
      userId: patient.id,
      appointmentId: appointment.id,
      title: "Walk-in queue number created",
      message: `Your queue number is ${queueNumber}.`,
      type: "walkin_created"
    });
    return appointmentView(db, appointment);
  }).catch((error: Error) => error);

  if (result instanceof Error) return fail(result.message);
  return ok({ appointment: result });
}
