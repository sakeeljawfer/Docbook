import bcrypt from "bcryptjs";
import type { Database } from "./types";

const now = () => new Date().toISOString();
const id = (prefix: string, n: number) => `${prefix}_${String(n).padStart(2, "0")}`;
const today = () => new Date().toISOString().slice(0, 10);

export function createSeedData(): Database {
  const date = today();
  const passwordHash = bcrypt.hashSync("password123", 10);
  const specializations = [
    { id: "sp_01", name: "General Medicine", status: "active" as const },
    { id: "sp_02", name: "Pediatrics", status: "active" as const },
    { id: "sp_03", name: "Dermatology", status: "active" as const },
    { id: "sp_04", name: "Cardiology", status: "active" as const }
  ];
  const locations = [
    { id: "loc_01", city: "Colombo", district: "Colombo", province: "Western" },
    { id: "loc_02", city: "Kandy", district: "Kandy", province: "Central" },
    { id: "loc_03", city: "Galle", district: "Galle", province: "Southern" }
  ];
  const users = [
    { id: "admin_01", role: "admin" as const, name: "Super Admin", phone: "0770000000", email: "admin@mediqueue.test", passwordHash, status: "active" as const, createdAt: now(), updatedAt: now() },
    { id: "doctor_user_01", role: "doctor" as const, name: "Dr. Amara Perera", phone: "0771000001", email: "amara@clinic.test", passwordHash, status: "active" as const, createdAt: now(), updatedAt: now() },
    { id: "doctor_user_02", role: "doctor" as const, name: "Dr. Nimal Silva", phone: "0771000002", email: "nimal@clinic.test", passwordHash, status: "active" as const, createdAt: now(), updatedAt: now() },
    { id: "doctor_user_03", role: "doctor" as const, name: "Dr. Farah Khan", phone: "0771000003", email: "farah@clinic.test", passwordHash, status: "active" as const, createdAt: now(), updatedAt: now() },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: id("patient", i + 1),
      role: "patient" as const,
      name: `Patient ${i + 1}`,
      phone: `07720000${String(i + 1).padStart(2, "0")}`,
      email: undefined,
      passwordHash,
      status: "active" as const,
      createdAt: now(),
      updatedAt: now()
    }))
  ];
  const doctorProfiles = [
    { id: "doc_01", userId: "doctor_user_01", doctorName: "Dr. Amara Perera", clinicName: "Lotus Family Clinic", specializationId: "sp_01", registrationNumber: "SLMC-101", consultationFee: 2500, address: "42 Temple Road", city: "Colombo", latitude: 6.9271, longitude: 79.8612, averageConsultationMinutes: 7, verificationStatus: "approved" as const, createdAt: now(), updatedAt: now() },
    { id: "doc_02", userId: "doctor_user_02", doctorName: "Dr. Nimal Silva", clinicName: "Hill Care Dispensary", specializationId: "sp_02", registrationNumber: "SLMC-102", consultationFee: 2000, address: "18 Lake View", city: "Kandy", latitude: 7.2906, longitude: 80.6337, averageConsultationMinutes: 10, verificationStatus: "approved" as const, createdAt: now(), updatedAt: now() },
    { id: "doc_03", userId: "doctor_user_03", doctorName: "Dr. Farah Khan", clinicName: "Fort Skin & Heart Centre", specializationId: "sp_03", registrationNumber: "SLMC-103", consultationFee: 3000, address: "7 Rampart Street", city: "Galle", latitude: 6.0535, longitude: 80.221, averageConsultationMinutes: 12, verificationStatus: "approved" as const, createdAt: now(), updatedAt: now() }
  ];
  const doctorSessions = doctorProfiles.flatMap((doctor, index) => [
    { id: `${doctor.id}_morning`, doctorId: doctor.id, dayOfWeek: new Date().getDay(), sessionName: "Morning", startTime: "08:00", endTime: "12:00", maxPatients: 20, isActive: true },
    { id: `${doctor.id}_evening`, doctorId: doctor.id, dayOfWeek: new Date().getDay(), sessionName: "Evening", startTime: "16:00", endTime: "20:00", maxPatients: index === 0 ? 25 : 18, isActive: true }
  ]);
  const sessionCounters = new Map<string, number>();
  const appointments = Array.from({ length: 20 }, (_, i) => {
    const doctor = doctorProfiles[i % doctorProfiles.length];
    const session = doctorSessions.find((s) => s.doctorId === doctor.id && s.sessionName === (i % 2 === 0 ? "Morning" : "Evening"))!;
    const key = `${doctor.id}:${session.id}`;
    const position = (sessionCounters.get(key) ?? 0) + 1;
    sessionCounters.set(key, position);
    return {
      id: id("appt", i + 1),
      patientId: id("patient", (i % 10) + 1),
      doctorId: doctor.id,
      sessionId: session.id,
      appointmentDate: date,
      queueNumber: `${session.sessionName[0]}${String(position).padStart(3, "0")}`,
      queuePosition: position,
      status: i < 2 ? "confirmed" as const : "waiting" as const,
      reason: i % 3 === 0 ? "Follow-up consultation" : "General consultation",
      estimatedTime: position * doctor.averageConsultationMinutes,
      createdAt: now(),
      updatedAt: now()
    };
  });
  const queueSessions = doctorSessions.map((session, i) => ({
    id: `queue_${session.id}`,
    doctorId: session.doctorId,
    appointmentDate: date,
    sessionId: session.id,
    currentQueueNumber: undefined,
    status: i === 0 ? "running" as const : "not_started" as const,
    startedAt: i === 0 ? now() : undefined,
    endedAt: undefined,
    lastUpdatedAt: now()
  }));
  return {
    users,
    doctorProfiles,
    doctorSessions,
    appointments,
    queueSessions,
    notifications: [],
    specializations,
    locations
  };
}
