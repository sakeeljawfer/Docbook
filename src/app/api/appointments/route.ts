import { getCurrentUser } from "@/lib/auth";
import { appointmentView, mutateDb, readDb, notify, recalculateQueue } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { rateLimit, createRateLimitError } from "@/lib/rate-limit";

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
  if (!(await rateLimit(30, 60000))) return createRateLimitError();

  const user = await getCurrentUser("patient");
  if (!user) return fail("Please log in as a patient to book.", 401);
  const { doctorId, sessionId, appointmentDate, reason } = await request.json();
  if (!doctorId || !sessionId || !appointmentDate) return fail("Doctor, session, and date are required.");
  if (appointmentDate < new Date().toISOString().slice(0, 10)) return fail("Past dates cannot be booked.");

  const result = await mutateDb((db) => {
    const doctor = db.doctorProfiles.find((item) => item.id === doctorId);
    const doctorUser = doctor ? db.users.find((item) => item.id === doctor.userId) : undefined;
    if (!doctor || doctor.verificationStatus !== "approved" || doctor.paymentStatus !== "paid" || doctorUser?.status !== "active") {
      throw new Error("This doctor is not available for booking.");
    }
    const session = db.doctorSessions.find((item) => item.id === sessionId && item.doctorId === doctorId);
    if (!session) throw new Error("Invalid session.");

    const sameDay = db.appointments.filter((item) => item.doctorId === doctorId && item.sessionId === sessionId && item.appointmentDate === appointmentDate);
    if (sameDay.some((item) => item.patientId === user.id && item.status !== "cancelled")) {
      throw new Error("You already have an appointment for this doctor and session.");
    }

    const activeCount = sameDay.filter((item) => item.status !== "cancelled").length;
    if (activeCount >= session.maxPatients) {
      throw new Error("This session is fully booked.");
    }
    const position = sameDay.length + 1;
    const queueNumber = `${session.sessionName[0].toUpperCase()}${String(position).padStart(3, "0")}`;
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

export async function PATCH(request: Request) {
  const user = await getCurrentUser(["patient", "doctor", "admin"]);
  if (!user) return fail("Unauthorized", 401);
  const { appointmentId, action } = await request.json();
  if (!appointmentId || !action) return fail("Appointment and action are required.");

  const result = await mutateDb((db) => {
    const appointment = db.appointments.find((item) => item.id === appointmentId);
    if (!appointment) throw new Error("Appointment not found.");
    const doctor = db.doctorProfiles.find((item) => item.id === appointment.doctorId);
    const canPatientCancel = user.role === "patient" && appointment.patientId === user.id && ["pending", "confirmed", "waiting"].includes(appointment.status);
    const canDoctorManage = user.role === "doctor" && doctor?.userId === user.id;
    if (!canPatientCancel && !canDoctorManage && user.role !== "admin") throw new Error("You cannot change this appointment.");

    const now = new Date().toISOString();
    if (action === "cancel") appointment.status = "cancelled";
    else if (action === "complete" && canDoctorManage) appointment.status = "completed";
    else if (action === "no-show" && canDoctorManage) appointment.status = "no-show";
    else throw new Error("Unsupported appointment action.");
    appointment.completedAt = ["completed", "no-show"].includes(appointment.status) ? now : appointment.completedAt;
    appointment.updatedAt = now;

    const queue = db.queueSessions.find((item) =>
      item.doctorId === appointment.doctorId &&
      item.sessionId === appointment.sessionId &&
      item.appointmentDate === appointment.appointmentDate
    );
    if (queue) {
      if (queue.currentQueueNumber === appointment.queueNumber) queue.currentQueueNumber = undefined;
      recalculateQueue(db, queue);
    }

    notify(db, {
      userId: appointment.patientId,
      appointmentId: appointment.id,
      title: action === "cancel" ? "Appointment cancelled" : "Appointment updated",
      message: `Queue ${appointment.queueNumber} is now ${appointment.status}.`,
      type: `appointment_${appointment.status}`
    });
    return appointmentView(db, appointment);
  }).catch((error: Error) => error);

  if (result instanceof Error) return fail(result.message);
  return ok({ appointment: result });
}
