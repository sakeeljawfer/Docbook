import { create } from 'zustand';

export type Role = 'patient' | 'doctor' | 'admin';
export type View = 'home' | 'doctors' | 'profile' | 'book' | 'queue' | 'patient-login' | 'patient-register' | 'doctor-login' | 'doctor-register' | 'admin-login' | 'patient-dashboard' | 'doctor-dashboard' | 'admin-dashboard';
export type Portal = 'all' | 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email?: string;
}

export interface Doctor {
  id: string;
  userId?: string;
  doctorName: string;
  clinicName: string;
  specialization: string;
  specializationId: string;
  city: string;
  address: string;
  consultationFee?: number;
  averageConsultationMinutes: number;
  currentQueueNumber: string;
  queueStatus: string;
  totalWaiting: number;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  paymentStatus?: 'paid' | 'unpaid' | 'overdue';
  sessions: Array<{ id: string; sessionName: string; startTime: string; endTime: string; maxPatients: number }>;
}

export interface Appointment {
  id: string;
  doctorId: string;
  sessionId: string;
  appointmentDate: string;
  queueNumber: string;
  queuePosition: number;
  status: string;
  estimatedTime: number;
  reason?: string;
  patientName?: string;
  patientPhone?: string;
  doctor?: Doctor;
  session?: { id: string; sessionName: string; startTime: string; endTime: string };
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

interface AppStore {
  user: User | null;
  view: View;
  portal: Portal;
  doctors: Doctor[];
  appointments: Appointment[];
  notifications: Notification[];
  loading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setView: (view: View) => void;
  setPortal: (portal: Portal) => void;
  setDoctors: (doctors: Doctor[]) => void;
  setAppointments: (appointments: Appointment[]) => void;
  setNotifications: (notifications: Notification[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useStore = create<AppStore>((set) => ({
  user: null,
  view: 'home',
  portal: 'all',
  doctors: [],
  appointments: [],
  notifications: [],
  loading: true,
  error: null,

  setUser: (user) => set({ user }),
  setView: (view) => set({ view }),
  setPortal: (portal) => set({ portal }),
  setDoctors: (doctors) => set({ doctors }),
  setAppointments: (appointments) => set({ appointments }),
  setNotifications: (notifications) => set({ notifications }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  logout: () => set({ user: null, view: 'home', appointments: [], notifications: [], error: null })
}));
