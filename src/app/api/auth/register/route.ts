import bcrypt from "bcryptjs";
import { z } from "zod";
import { mutateDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["patient", "doctor"]),
  name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
  clinicName: z.string().optional(),
  specializationId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  consultationFee: z.coerce.number().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("Please check the required fields.");
  const input = parsed.data;
  if (input.password !== input.confirmPassword) return fail("Passwords do not match.");
  if (input.role === "doctor" && (!input.clinicName || !input.address || !input.city || !input.specializationId)) {
    return fail("Doctor registration requires clinic, specialization, and location.");
  }

  const user = await mutateDb(async (db) => {
    if (db.users.some((item) => item.phone === input.phone)) throw new Error("Phone number already exists.");
    const now = new Date().toISOString();
    const newUser = {
      id: crypto.randomUUID(),
      role: input.role as Role,
      name: input.name,
      phone: input.phone,
      email: input.email || undefined,
      passwordHash: await bcrypt.hash(input.password, 10),
      status: "active" as const,
      createdAt: now,
      updatedAt: now
    };
    db.users.push(newUser);
    if (input.role === "doctor") {
      const doctorId = crypto.randomUUID();
      db.doctorProfiles.push({
        id: doctorId,
        userId: newUser.id,
        doctorName: input.name,
        clinicName: input.clinicName!,
        specializationId: input.specializationId!,
        consultationFee: input.consultationFee,
        address: input.address!,
        city: input.city!,
        averageConsultationMinutes: 10,
        verificationStatus: "pending",
        createdAt: now,
        updatedAt: now
      });
      db.doctorSessions.push({
        id: crypto.randomUUID(),
        doctorId,
        dayOfWeek: new Date().getDay(),
        sessionName: "Evening",
        startTime: "16:00",
        endTime: "20:00",
        maxPatients: 20,
        isActive: true
      });
    }
    return { id: newUser.id, role: newUser.role, name: newUser.name, phone: newUser.phone };
  }).catch((error: Error) => error);

  if (user instanceof Error) return fail(user.message);
  return ok({ user });
}
