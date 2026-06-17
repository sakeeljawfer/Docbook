import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Appointment, Database, Notification, QueueSession } from "./types";
import { createSeedData } from "./seed";

const dataDir = path.join(process.cwd(), "src", "data");
const dbPath = path.join(dataDir, "db.json");

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeDb(createSeedData());
  }
}

export async function readDb(): Promise<Database> {
  await ensureDb();
  return JSON.parse(await readFile(dbPath, "utf8")) as Database;
}

export async function writeDb(db: Database) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export async function mutateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await readDb();
  const result = await fn(db);
  await writeDb(db);
  return result;
}

export function publicDoctor(db: Database, doctorId: string) {
  const doctor = db.doctorProfiles.find((item) => item.id === doctorId);
  if (!doctor) return null;
  return {
    ...doctor,
    specialization: db.specializations.find((item) => item.id === doctor.specializationId)?.name ?? "General",
    sessions: db.doctorSessions.filter((item) => item.doctorId === doctor.id && item.isActive)
  };
}

export function appointmentView(db: Database, appointment: Appointment) {
  const doctor = publicDoctor(db, appointment.doctorId);
  const patient = db.users.find((user) => user.id === appointment.patientId);
  const session = db.doctorSessions.find((item) => item.id === appointment.sessionId);
  return { ...appointment, doctor, patientName: patient?.name, patientPhone: patient?.phone, session };
}

export function recalculateQueue(db: Database, queue: QueueSession) {
  const doctor = db.doctorProfiles.find((item) => item.id === queue.doctorId);
  const active = db.appointments
    .filter((item) => item.doctorId === queue.doctorId && item.sessionId === queue.sessionId && item.appointmentDate === queue.appointmentDate)
    .sort((a, b) => a.queuePosition - b.queuePosition);
  const currentIndex = active.findIndex((item) => item.status === "current");
  for (const appointment of active) {
    if (appointment.status === "waiting" || appointment.status === "confirmed") {
      const before = Math.max(0, appointment.queuePosition - (currentIndex >= 0 ? active[currentIndex].queuePosition : 0) - 1);
      appointment.estimatedTime = before * (doctor?.averageConsultationMinutes ?? 10);
      appointment.status = "waiting";
      appointment.updatedAt = new Date().toISOString();
    }
  }
}

export function notify(db: Database, notification: Omit<Notification, "id" | "isRead" | "createdAt">) {
  db.notifications.unshift({
    id: crypto.randomUUID(),
    isRead: false,
    createdAt: new Date().toISOString(),
    ...notification
  });
}
