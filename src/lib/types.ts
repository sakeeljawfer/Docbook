export type Role = "patient" | "doctor" | "admin";
export type UserStatus = "active" | "blocked" | "pending" | "suspended";
export type PaymentStatus = "paid" | "unpaid" | "overdue";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "waiting"
  | "current"
  | "completed"
  | "cancelled"
  | "no-show"
  | "rescheduled";
export type QueueStatus = "not_started" | "running" | "paused" | "completed";

export type User = {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email?: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

export type DoctorProfile = {
  id: string;
  userId: string;
  doctorName: string;
  clinicName: string;
  specializationId: string;
  registrationNumber?: string;
  consultationFee?: number;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  averageConsultationMinutes: number;
  verificationStatus: "pending" | "approved" | "rejected";
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  lastPaymentAt?: string;
  approvedAt?: string;
  blockedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DoctorSession = {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  sessionName: string;
  startTime: string;
  endTime: string;
  maxPatients: number;
  isActive: boolean;
};

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  sessionId: string;
  appointmentDate: string;
  queueNumber: string;
  queuePosition: number;
  status: AppointmentStatus;
  reason?: string;
  estimatedTime: number;
  calledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type QueueSession = {
  id: string;
  doctorId: string;
  appointmentDate: string;
  sessionId: string;
  currentQueueNumber?: string;
  status: QueueStatus;
  startedAt?: string;
  endedAt?: string;
  lastUpdatedAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  appointmentId?: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export type Specialization = { id: string; name: string; status: "active" | "inactive" };
export type Location = { id: string; city: string; district: string; province: string };

export type Database = {
  users: User[];
  doctorProfiles: DoctorProfile[];
  doctorSessions: DoctorSession[];
  appointments: Appointment[];
  queueSessions: QueueSession[];
  notifications: Notification[];
  specializations: Specialization[];
  locations: Location[];
};
