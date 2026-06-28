import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser("admin");
  if (!user) return fail("Unauthorized", 401);
  const db = await readDb();
  const today = new Date().toISOString().slice(0, 10);
  const doctors = db.doctorProfiles.map((doctor) => {
    const doctorUser = db.users.find((item) => item.id === doctor.userId);
    return {
      ...doctor,
      specialization: db.specializations.find((item) => item.id === doctor.specializationId)?.name ?? "General",
      doctorPhone: doctorUser?.phone,
      doctorEmail: doctorUser?.email,
      userStatus: doctorUser?.status ?? "unknown"
    };
  });
  const patients = db.users.filter((item) => item.role === "patient");
  const patientViews = patients.map((patient) => ({
    id: patient.id,
    role: patient.role,
    name: patient.name,
    phone: patient.phone,
    email: patient.email,
    status: patient.status,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt
  }));
  return ok({
    summary: {
      totalDoctors: db.doctorProfiles.length,
      totalPatients: patients.length,
      totalAppointments: db.appointments.length,
      activeClinics: doctors.filter((item) => item.verificationStatus === "approved" && item.paymentStatus === "paid" && item.userStatus === "active").length,
      todaysBookings: db.appointments.filter((item) => item.appointmentDate === today).length,
      paidDoctors: db.doctorProfiles.filter((item) => item.paymentStatus === "paid").length,
      unpaidDoctors: db.doctorProfiles.filter((item) => item.paymentStatus === "unpaid" || item.paymentStatus === "overdue").length,
      blockedDoctors: doctors.filter((item) => item.userStatus === "blocked").length,
      pendingApprovals: db.doctorProfiles.filter((item) => item.verificationStatus === "pending").length
    },
    doctors,
    patients: patientViews,
    appointments: db.appointments,
    specializations: db.specializations,
    locations: db.locations
  });
}
