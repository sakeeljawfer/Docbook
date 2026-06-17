import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser("admin");
  if (!user) return fail("Unauthorized", 401);
  const db = await readDb();
  const today = new Date().toISOString().slice(0, 10);
  return ok({
    summary: {
      totalDoctors: db.doctorProfiles.length,
      totalPatients: db.users.filter((item) => item.role === "patient").length,
      totalAppointments: db.appointments.length,
      activeClinics: db.doctorProfiles.filter((item) => item.verificationStatus === "approved").length,
      todaysBookings: db.appointments.filter((item) => item.appointmentDate === today).length
    },
    doctors: db.doctorProfiles,
    patients: db.users.filter((item) => item.role === "patient"),
    appointments: db.appointments,
    specializations: db.specializations,
    locations: db.locations
  });
}
