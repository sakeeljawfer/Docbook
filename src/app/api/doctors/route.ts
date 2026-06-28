import { readDb } from "@/lib/db";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "").toLowerCase();
  const db = await readDb();
  const doctors = db.doctorProfiles
    .filter((doctor) => {
      const doctorUser = db.users.find((user) => user.id === doctor.userId);
      return doctor.verificationStatus === "approved" && doctor.paymentStatus === "paid" && doctorUser?.status === "active";
    })
    .map((doctor) => {
      const specialization = db.specializations.find((item) => item.id === doctor.specializationId)?.name ?? "General";
      const sessions = db.doctorSessions.filter((item) => item.doctorId === doctor.id && item.isActive);
      const today = new Date().toISOString().slice(0, 10);
      const queue = db.queueSessions.find((item) => item.doctorId === doctor.id && item.appointmentDate === today);
      const appointments = db.appointments.filter((item) => item.doctorId === doctor.id && item.appointmentDate === today);
      return {
        ...doctor,
        specialization,
        sessions,
        currentQueueNumber: queue?.currentQueueNumber ?? "-",
        queueStatus: queue?.status ?? "not_started",
        totalWaiting: appointments.filter((item) => item.status === "waiting" || item.status === "confirmed").length
      };
    })
    .filter((doctor) =>
      [doctor.doctorName, doctor.clinicName, doctor.city, doctor.specialization]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  return ok({ doctors, specializations: db.specializations, locations: db.locations });
}
