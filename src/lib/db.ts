import bcrypt from "bcryptjs";
import { MongoClient, type Collection } from "mongodb";
import type { Appointment, Database, Notification, QueueSession, User } from "./types";

type StoredDatabase = Database & { _id: "docbook"; schemaVersion: number };

const baseSpecializations = [
  { id: "sp_general_medicine", name: "General Medicine", status: "active" as const },
  { id: "sp_pediatrics", name: "Pediatrics", status: "active" as const },
  { id: "sp_dermatology", name: "Dermatology", status: "active" as const },
  { id: "sp_cardiology", name: "Cardiology", status: "active" as const }
];

const baseLocations = [
  { id: "loc_colombo", city: "Colombo", district: "Colombo", province: "Western" },
  { id: "loc_kandy", city: "Kandy", district: "Kandy", province: "Central" },
  { id: "loc_galle", city: "Galle", district: "Galle", province: "Southern" }
];

let mongoClient: MongoClient | null = null;

async function getMongoClient() {
  if (mongoClient) return mongoClient;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Add it to your local .env and production environment variables.");
  }
  mongoClient = new MongoClient(uri, {
    ignoreUndefined: true,
    maxPoolSize: 100,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000
  });
  await mongoClient.connect();

  process.on('SIGINT', async () => {
    await mongoClient?.close();
    process.exit(0);
  });

  return mongoClient;
}

async function getCollection(): Promise<Collection<StoredDatabase>> {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB ?? "docbook";
  const collectionName = process.env.MONGODB_COLLECTION ?? "app_state";
  return client.db(dbName).collection<StoredDatabase>(collectionName);
}

async function createInitialDb(): Promise<StoredDatabase> {
  const now = new Date().toISOString();
  const users: User[] = [];

  if (process.env.ADMIN_PHONE && process.env.ADMIN_PASSWORD) {
    users.push({
      id: crypto.randomUUID(),
      role: "admin",
      name: process.env.ADMIN_NAME ?? "Platform Admin",
      phone: process.env.ADMIN_PHONE,
      email: process.env.ADMIN_EMAIL || undefined,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }

  return {
    _id: "docbook",
    schemaVersion: 1,
    users,
    doctorProfiles: [],
    doctorSessions: [],
    appointments: [],
    queueSessions: [],
    notifications: [],
    specializations: baseSpecializations,
    locations: baseLocations
  };
}

async function ensureDb(): Promise<StoredDatabase> {
  const collection = await getCollection();
  const existing = await collection.findOne({ _id: "docbook" });
  if (existing) return normalizeDb(existing);

  const initialDb = await createInitialDb();
  await collection.insertOne(initialDb);
  return initialDb;
}

export async function readDb(): Promise<Database> {
  const db = await ensureDb();
  return stripStorageFields(db);
}

function normalizeDb(db: StoredDatabase): StoredDatabase {
  db.schemaVersion ??= 1;
  db.users ??= [];
  db.doctorProfiles ??= [];
  db.doctorSessions ??= [];
  db.appointments ??= [];
  db.queueSessions ??= [];
  db.notifications ??= [];
  db.specializations = db.specializations?.length ? db.specializations : baseSpecializations;
  db.locations = db.locations?.length ? db.locations : baseLocations;
  return db;
}

function stripStorageFields(db: StoredDatabase): Database {
  const { _id, schemaVersion, ...data } = db;
  void _id;
  void schemaVersion;
  return data;
}

function withStorageFields(db: Database): StoredDatabase {
  return { _id: "docbook", schemaVersion: 1, ...db };
}

export async function writeDb(db: Database) {
  const collection = await getCollection();
  await collection.replaceOne({ _id: "docbook" }, normalizeDb(withStorageFields(db)), { upsert: true });
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
  const current = active.find((item) => item.status === "current");
  const currentPosition = current?.queuePosition ?? 0;
  for (const appointment of active) {
    if (appointment.status === "waiting" || appointment.status === "confirmed") {
      const before = active.filter((item) =>
        item.queuePosition < appointment.queuePosition &&
        item.queuePosition > currentPosition &&
        (item.status === "waiting" || item.status === "confirmed")
      ).length;
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
