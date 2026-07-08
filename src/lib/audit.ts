export type AuditAction =
  | 'doctor_approved'
  | 'doctor_rejected'
  | 'doctor_blocked'
  | 'doctor_unblocked'
  | 'payment_approved'
  | 'payment_marked_overdue'
  | 'user_status_changed'
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'login_success'
  | 'login_failed'
  | 'patient_data_accessed';

export interface AuditLog {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId: string | null;
  userRole: 'patient' | 'doctor' | 'admin' | null;
  targetUserId?: string;
  resourceType?: 'doctor' | 'appointment' | 'user';
  resourceId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}

const logs: AuditLog[] = [];

export function logAudit(data: Omit<AuditLog, 'id' | 'timestamp'>) {
  const log: AuditLog = {
    ...data,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };

  logs.push(log);

  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(log));
  }

  if (logs.length > 10000) {
    logs.shift();
  }
}

export function getAuditLogs(limit = 100): AuditLog[] {
  return logs.slice(-limit).reverse();
}
