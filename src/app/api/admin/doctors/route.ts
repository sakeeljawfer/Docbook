import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  doctorId: z.string().min(1),
  action: z.enum(["approve-payment", "block-unpaid", "unblock", "reject"])
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser("admin");
  if (!user) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("Doctor and action are required.");

  const result = await mutateDb((db) => {
    const doctor = db.doctorProfiles.find((item) => item.id === parsed.data.doctorId);
    if (!doctor) throw new Error("Doctor profile not found.");
    const doctorUser = db.users.find((item) => item.id === doctor.userId);
    if (!doctorUser) throw new Error("Doctor account not found.");

    const now = new Date().toISOString();
    if (parsed.data.action === "approve-payment") {
      doctor.paymentStatus = "paid";
      doctor.verificationStatus = "approved";
      doctor.paymentReference = doctor.paymentReference ?? `PAY-${now.slice(0, 10).replaceAll("-", "")}`;
      doctor.lastPaymentAt = now;
      doctor.approvedAt = now;
      doctor.blockedAt = undefined;
      doctorUser.status = "active";
    }

    if (parsed.data.action === "block-unpaid") {
      doctor.paymentStatus = "overdue";
      doctor.blockedAt = now;
      doctorUser.status = "blocked";
    }

    if (parsed.data.action === "unblock") {
      doctorUser.status = "active";
      if (doctor.paymentStatus === "overdue") doctor.paymentStatus = "unpaid";
      doctor.blockedAt = undefined;
    }

    if (parsed.data.action === "reject") {
      doctor.verificationStatus = "rejected";
      doctor.paymentStatus = "unpaid";
      doctor.blockedAt = now;
      doctorUser.status = "blocked";
    }

    doctor.updatedAt = now;
    doctorUser.updatedAt = now;

    return {
      ...doctor,
      doctorPhone: doctorUser.phone,
      doctorEmail: doctorUser.email,
      userStatus: doctorUser.status
    };
  }).catch((error: Error) => error);

  if (result instanceof Error) return fail(result.message);
  return ok({ doctor: result });
}
