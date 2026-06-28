"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRightOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined
} from "@ant-design/icons";
import { App as AntApp, Button, Card, ConfigProvider, Empty, Input, Layout, Select, Skeleton, Space, Statistic, Tag, theme } from "antd";

type PaymentStatus = "paid" | "unpaid" | "overdue";
type User = { id: string; role: "patient" | "doctor" | "admin"; name: string; phone: string; email?: string; status?: string };
type Doctor = {
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
  verificationStatus?: "pending" | "approved" | "rejected";
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  lastPaymentAt?: string;
  approvedAt?: string;
  blockedAt?: string;
  doctorPhone?: string;
  doctorEmail?: string;
  userStatus?: string;
  sessions: Array<{ id: string; sessionName: string; startTime: string; endTime: string; maxPatients: number }>;
};
type Appointment = {
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
};
type NotificationItem = { id: string; title: string; message: string; type: string; createdAt: string };
type PublicBoard = {
  doctorName: string;
  clinicName: string;
  date: string;
  session: string;
  currentQueueNumber: string;
  nextQueueNumber: string;
  totalWaiting: number;
  estimatedDelay: number;
  lastUpdatedAt: string;
  status: string;
};
type AdminPayload = {
  summary?: Record<string, number>;
  doctors?: Doctor[];
  patients?: User[];
  appointments?: Appointment[];
};
type AdminDoctorAction = "approve-payment" | "block-unpaid" | "unblock" | "reject";
type View =
  | "home"
  | "doctors"
  | "profile"
  | "book"
  | "queue"
  | "about"
  | "contact"
  | "patient-login"
  | "patient-register"
  | "doctor-login"
  | "doctor-register"
  | "admin-login"
  | "forgot"
  | "patient-dashboard"
  | "doctor-dashboard"
  | "admin-dashboard";
type Portal = "all" | "patient" | "doctor" | "admin";

const initialViewForPortal = (portal: Portal): View => portal === "doctor" ? "doctor-dashboard" : portal === "admin" ? "admin-dashboard" : portal === "patient" ? "doctors" : "home";
const today = () => new Date().toISOString().slice(0, 10);
const statusClass = (status?: string) => `status status-${(status ?? "confirmed").replace(/\s+/g, "-")}`;
const readable = (value: string) => value.replace(/-/g, " ").replace(/[A-Z]/g, " $&").trim();

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

export default function MediQueueApp({ portal = "all" }: { portal?: Portal }) {
  const [view, setView] = useState<View>(initialViewForPortal(portal));
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [query, setQuery] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [location, setLocation] = useState("all");
  const [specialization, setSpecialization] = useState("all");
  const [availability, setAvailability] = useState("today");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [message, setMessage] = useState("");
  const [doctorQueue, setDoctorQueue] = useState<{ doctor?: Doctor; appointments: Appointment[]; queues: Array<{ sessionId: string; status: string; currentQueueNumber?: string }> }>({ appointments: [], queues: [] });
  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [admin, setAdmin] = useState<AdminPayload | null>(null);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor.id === selectedDoctorId) ?? doctors[0], [doctors, selectedDoctorId]);
  const filteredDoctors = useMemo(() => doctors.filter((doctor) => {
    const matchesLocation = location === "all" || doctor.city === location;
    const matchesSpecialization = specialization === "all" || doctor.specialization === specialization;
    const matchesAvailability = availability === "all" || doctor.sessions.length > 0;
    return matchesLocation && matchesSpecialization && matchesAvailability;
  }), [doctors, location, specialization, availability]);
  const cities = Array.from(new Set(doctors.map((doctor) => doctor.city)));
  const specializations = Array.from(new Set(doctors.map((doctor) => doctor.specialization)));

  async function loadDoctors(search = query) {
    setLoadingDoctors(true);
    try {
      const doctorData = await api<{ doctors: Doctor[] }>("/api/doctors?query=" + encodeURIComponent(search));
      setDoctors(doctorData.doctors);
      setSelectedDoctorId((current) => current || doctorData.doctors[0]?.id || "");
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function refresh() {
    const me = await api<{ user: User | null }>("/api/auth/me");
    setUser(me.user);
    await loadDoctors();
    if (me.user) {
      const [apptData, notificationData] = await Promise.all([
        api<{ appointments: Appointment[] }>("/api/appointments"),
        api<{ notifications: NotificationItem[] }>("/api/notifications")
      ]);
      setAppointments(apptData.appointments);
      setNotifications(notificationData.notifications);
      if (me.user.role === "doctor") {
        setDoctorQueue(await api<typeof doctorQueue>("/api/doctor/queue/status"));
      }
      if (me.user.role === "admin") {
        setAdmin(await api<AdminPayload>("/api/admin/summary"));
      }
    }
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadDoctors(query).catch((error) => setMessage(error.message));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!selectedDoctor?.id) return;
    const loadBoard = () =>
      api<{ board: PublicBoard }>("/api/public/queue?doctorId=" + selectedDoctor.id)
        .then((data) => setBoard(data.board))
        .catch(() => undefined);
    loadBoard();
    const handle = window.setInterval(loadBoard, 3500);
    return () => window.clearInterval(handle);
  }, [selectedDoctor?.id]);

  async function handleLogin(event: FormEvent<HTMLFormElement>, nextView?: View) {
    event.preventDefault();
    await api("/api/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    setMessage("Signed in successfully.");
    await refresh();
    if (nextView) setView(nextView);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>, role: "patient" | "doctor") {
    event.preventDefault();
    await api("/api/auth/register", { method: "POST", body: JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget)), role }) });
    setMessage(role === "doctor" ? "Doctor profile submitted. Admin approval and payment confirmation are required before dashboard access." : "Patient account created. Please sign in.");
    setView(role === "doctor" ? "doctor-login" : "patient-login");
  }

  async function logout() {
    await api("/api/auth/me", { method: "DELETE" });
    setUser(null);
    setAppointments([]);
    setNotifications([]);
    setDoctorQueue({ appointments: [], queues: [] });
    setAdmin(null);
    setView(initialViewForPortal(portal));
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || user.role !== "patient") {
      setMessage("Please log in as a patient before booking.");
      setView("patient-login");
      return;
    }
    const data = await api<{ appointment: Appointment }>("/api/appointments", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    setMessage(`Booked successfully. Your queue number is ${data.appointment.queueNumber}.`);
    await refresh();
    setView("patient-dashboard");
  }

  async function queueAction(action: "start" | "next", sessionId: string) {
    const url = action === "start" ? "/api/doctor/queue/start" : "/api/doctor/queue/next";
    await api(url, { method: "POST", body: JSON.stringify({ sessionId }) });
    setMessage(action === "start" ? "Session started." : "Next patient called and queue updated.");
    await refresh();
  }

  async function queueControl(action: "pause" | "resume" | "end", sessionId: string) {
    await api("/api/doctor/queue/control", { method: "POST", body: JSON.stringify({ sessionId, action }) });
    setMessage(`Queue ${action === "end" ? "ended" : `${action}d`}.`);
    await refresh();
  }

  async function appointmentAction(appointmentId: string, action: "cancel" | "complete" | "no-show") {
    await api("/api/appointments", { method: "PATCH", body: JSON.stringify({ appointmentId, action }) });
    setMessage(action === "cancel" ? "Appointment cancelled." : action === "complete" ? "Appointment completed." : "Appointment marked no-show.");
    await refresh();
  }

  async function addWalkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await api("/api/doctor/walkins", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    event.currentTarget.reset();
    setMessage("Walk-in patient added to today’s queue.");
    await refresh();
  }

  async function adminDoctorAction(doctorId: string, action: AdminDoctorAction) {
    await api("/api/admin/doctors", { method: "PATCH", body: JSON.stringify({ doctorId, action }) });
    setMessage(action === "approve-payment" ? "Doctor payment approved and account activated." : action === "block-unpaid" ? "Doctor blocked for unpaid subscription." : action === "reject" ? "Doctor profile rejected and blocked." : "Doctor account unblocked.");
    await refresh();
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: portal === "doctor" ? "#1f5fbf" : portal === "admin" ? "#4f46a5" : "#0f8c7c",
          colorInfo: "#1f5fbf",
          colorSuccess: "#16845f",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        }
      }}
    >
      <AntApp>
        <Layout className={`app-shell portal-${portal}`}>
          <Header portal={portal} view={view} user={user} setView={setView} logout={logout} />
          {message && <button className="toast" onClick={() => setMessage("")}>{message}</button>}
          <Layout.Content>
            <main>
              {view === "home" && <Home portal={portal} doctors={doctors} loadingDoctors={loadingDoctors} query={query} setQuery={setQuery} setView={setView} selectDoctor={setSelectedDoctorId} board={board} />}
        {view === "doctors" && <FindDoctors doctors={filteredDoctors} loadingDoctors={loadingDoctors} cities={cities} specializations={specializations} query={query} setQuery={setQuery} location={location} setLocation={setLocation} specialization={specialization} setSpecialization={setSpecialization} availability={availability} setAvailability={setAvailability} setView={setView} selectDoctor={setSelectedDoctorId} />}
        {view === "profile" && selectedDoctor && <DoctorProfile doctor={selectedDoctor} setView={setView} />}
        {view === "book" && selectedDoctor && <BookingFlow doctor={selectedDoctor} onBook={book} user={user} setView={setView} />}
        {view === "queue" && <PublicQueue board={board} />}
        {view === "about" && <InfoPage title="About DocBook" text="DocBook helps local dispensaries reduce waiting room crowding while giving patients a simple way to book, receive queue numbers, and track their turn." />}
        {view === "contact" && <InfoPage title="Contact" text="For clinic onboarding, support, and partnerships, contact hello@docbook.test or call 077 000 0000." />}
        {view === "patient-login" && <LoginPage role="patient" heading="Login to track your appointments" defaultPhone="0772000001" onSubmit={(event) => handleLogin(event, "patient-dashboard")} setView={setView} />}
        {view === "doctor-login" && <LoginPage role="doctor" heading="Doctor / Dispensary Login" defaultPhone="0771000001" onSubmit={(event) => handleLogin(event, "doctor-dashboard")} setView={setView} />}
        {view === "admin-login" && <LoginPage role="admin" heading="Admin Login" defaultPhone="0770000000" onSubmit={(event) => handleLogin(event, "admin-dashboard")} setView={setView} />}
        {view === "patient-register" && <PatientRegister onSubmit={(event) => handleRegister(event, "patient")} setView={setView} />}
        {view === "doctor-register" && <DoctorRegister onSubmit={(event) => handleRegister(event, "doctor")} setView={setView} />}
        {view === "forgot" && <InfoPage title="Forgot password" text="Password reset is prepared for future SMS/email integration. Please contact the clinic administrator for this MVP." />}
        {view === "patient-dashboard" && <PatientDashboard user={user} appointments={appointments} notifications={notifications} setView={setView} board={board} onAppointmentAction={appointmentAction} />}
        {view === "doctor-dashboard" && <DoctorDashboard user={user} data={doctorQueue} onAction={queueAction} onControl={queueControl} onAppointmentAction={appointmentAction} onWalkIn={addWalkIn} setView={setView} />}
        {view === "admin-dashboard" && <AdminDashboard user={user} admin={admin} setView={setView} onDoctorAction={adminDoctorAction} />}
            </main>
          </Layout.Content>
          {user?.role === "patient" && portal !== "doctor" && <MobilePatientNav setView={setView} />}
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}

function Header({ portal, view, user, setView, logout }: { portal: Portal; view: View; user: User | null; setView: (view: View) => void; logout: () => void }) {
  const dashboardView = user?.role === "doctor" ? "doctor-dashboard" : user?.role === "admin" ? "admin-dashboard" : "patient-dashboard";
  const isDoctorPortal = portal === "doctor";
  const isAdminPortal = portal === "admin";
  const portalLabel = isDoctorPortal ? "Doctor" : isAdminPortal ? "Admin" : portal === "patient" ? "Patient" : "";
  return (
    <Layout.Header className="site-header">
      <div className="header-main">
        <button className="logo" onClick={() => setView(initialViewForPortal(portal))}><LogoMark />DocBook <span>{portalLabel}</span></button>
        <div className="header-actions">
          {user ? (
            <Space size={8}>
              <Button icon={<UserOutlined />} onClick={() => setView(dashboardView)}>{user.name}</Button>
              <Button icon={<LogoutOutlined />} onClick={logout}>Logout</Button>
            </Space>
          ) : (
            <Space size={8}>
              {isAdminPortal ? (
                <Button type="primary" icon={<DashboardOutlined />} onClick={() => setView("admin-login")}>Admin Login</Button>
              ) : isDoctorPortal ? (
                <Button type="primary" icon={<MedicineBoxOutlined />} onClick={() => setView("doctor-login")}>Doctor Login</Button>
              ) : (
                <>
                  <Button icon={<LoginOutlined />} onClick={() => setView("patient-login")}>Patient Login</Button>
                  <Button type="primary" icon={<CalendarOutlined />} onClick={() => setView("patient-register")}>Book</Button>
                </>
              )}
            </Space>
          )}
        </div>
      </div>
      <nav className="public-nav">
        {isAdminPortal ? (
          <>
            <Button type={view === "admin-dashboard" ? "primary" : "text"} icon={<DashboardOutlined />} onClick={() => setView("admin-dashboard")}>Admin Desk</Button>
            <Button type="text" icon={<CreditCardOutlined />} onClick={() => setView(user?.role === "admin" ? "admin-dashboard" : "admin-login")}>Doctor Payments</Button>
            <Button type="text" icon={<UserOutlined />} onClick={() => setView(user?.role === "admin" ? "admin-dashboard" : "admin-login")}>Patients</Button>
            <Button type="text" icon={<MedicineBoxOutlined />} href="/doctors">Doctor Portal</Button>
            <Button type="text" icon={<CalendarOutlined />} href="/patients">Patient App</Button>
          </>
        ) : isDoctorPortal ? (
          <>
            <Button type={view === "doctor-dashboard" ? "primary" : "text"} icon={<TeamOutlined />} onClick={() => setView("doctor-dashboard")}>Queue Desk</Button>
            <Button type={view === "doctor-register" ? "primary" : "text"} icon={<PlusOutlined />} onClick={() => setView("doctor-register")}>Register Clinic</Button>
          </>
        ) : (
          <>
            <Button type={view === "doctors" ? "primary" : "text"} icon={<SearchOutlined />} onClick={() => setView("doctors")}>Find a Doctor</Button>
            <Button type={view === "queue" ? "primary" : "text"} icon={<ClockCircleOutlined />} onClick={() => setView("queue")}>Current Queue</Button>
          </>
        )}
      </nav>
    </Layout.Header>
  );
}

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <span className="logo-book" />
      <span className="logo-pulse" />
      <span className="logo-cross">+</span>
    </span>
  );
}

function Home({ portal, doctors, loadingDoctors, query, setQuery, setView, selectDoctor, board }: { portal: Portal; doctors: Doctor[]; loadingDoctors: boolean; query: string; setQuery: (query: string) => void; setView: (view: View) => void; selectDoctor: (id: string) => void; board: PublicBoard | null }) {
  if (portal === "all") return <RoleGateway board={board} setView={setView} />;

  return (
    <>
      <section className="clinic-hero">
        <Card className="patient-panel" variant="borderless">
          <span className="eyebrow">Patient web app</span>
          <h1>Book your doctor and see the current queue number.</h1>
          <p>No guessing at the clinic. Choose a local doctor, book a morning or evening session, get your queue number, and track who is being served now.</p>
          <div className="hero-search">
            <Input size="large" prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search doctor, dispensary, city, or specialization" />
            <Button type="primary" size="large" icon={<SearchOutlined />} onClick={() => setView("doctors")}>Find Doctor</Button>
          </div>
          <div className="patient-steps">
            <span><b>1</b>Find doctor</span>
            <span><b>2</b>Book session</span>
            <span><b>3</b>Get queue number</span>
            <span><b>4</b>Track current queue</span>
          </div>
        </Card>
        <Card className="queue-preview" variant="borderless">
          <div className="queue-preview-top">
            <div>
              <p>{board?.clinicName ?? "Lotus Family Clinic"}</p>
              <small>{board?.doctorName ?? "Dr. Amara Perera"}</small>
            </div>
            <Tag color="success">{board?.status?.replace("_", " ") ?? "running"}</Tag>
          </div>
          <div className="queue-preview-current">
            <span>Current queue</span>
            <strong>{board?.currentQueueNumber ?? "M001"}</strong>
          </div>
          <div className="queue-preview-grid">
            <Statistic title="Next" value={board?.nextQueueNumber ?? "M002"} />
            <Statistic title="Waiting" value={board?.totalWaiting ?? 3} />
            <Statistic title="Delay" value={board?.estimatedDelay ?? 14} suffix="m" />
          </div>
          <Button icon={<ClockCircleOutlined />} onClick={() => setView("queue")}>Open Live Queue Board</Button>
        </Card>
      </section>
      <section className="core-actions">
        <Button type="primary" size="large" icon={<CalendarOutlined />} onClick={() => setView("doctors")}>Book Appointment</Button>
        <Button size="large" icon={<BellOutlined />} onClick={() => setView("patient-login")}>Track My Appointment</Button>
        <Button size="large" icon={<MedicineBoxOutlined />} href="/doctors">Doctor Queue Desk</Button>
      </section>
      <section className="section-block">
        <div className="section-title">
          <span className="eyebrow">Available today</span>
          <h2>Local doctors and dispensaries</h2>
        </div>
        <DoctorResults doctors={doctors.slice(0, 3)} loadingDoctors={loadingDoctors} setView={setView} selectDoctor={selectDoctor} emptyDescription="Doctors will appear here as clinics are available." />
      </section>
      <Footer portal={portal} setView={setView} />
    </>
  );
}

function RoleGateway({ board, setView }: { board: PublicBoard | null; setView: (view: View) => void }) {
  return (
    <>
      <section className="role-gateway">
        <div className="role-gateway-copy">
          <span className="eyebrow">DocBook web apps</span>
          <h1>One booking product, two focused workspaces.</h1>
          <p>Patients need fast booking and queue confidence. Doctors need a calm desk for live sessions, walk-ins, and patient flow.</p>
          <div className="gateway-stats">
            <Statistic title="Patient steps" value={4} />
            <Statistic title="Live queue sync" value="3.5s" />
            <Statistic title="Clinic roles" value={2} />
          </div>
        </div>
        <div className="role-card-grid">
          <Card className="role-card" variant="borderless">
            <span className="role-icon patient"><UserOutlined /></span>
            <h2>Patient App</h2>
            <p>Find doctors, book a session, and track the queue number from the same place.</p>
            <div className="role-checks">
              <span><CheckCircleOutlined /> Book appointment</span>
              <span><CheckCircleOutlined /> Track current queue</span>
              <span><CheckCircleOutlined /> Review notifications</span>
            </div>
            <Button type="primary" size="large" href="/patients" icon={<ArrowRightOutlined />}>Open Patient App</Button>
          </Card>
          <Card className="role-card doctor" variant="borderless">
            <span className="role-icon doctor"><MedicineBoxOutlined /></span>
            <h2>Doctor App</h2>
            <p>Run today’s queue, call the next patient, add walk-ins, and keep the board current.</p>
            <div className="role-checks">
              <span><CheckCircleOutlined /> Start session</span>
              <span><CheckCircleOutlined /> Add walk-ins</span>
              <span><CheckCircleOutlined /> Complete visits</span>
            </div>
            <Button type="primary" size="large" href="/doctors" icon={<ArrowRightOutlined />}>Open Doctor App</Button>
          </Card>
        </div>
      </section>
      <section className="gateway-queue-strip">
        <div>
          <span className="eyebrow">Public queue board</span>
          <h2>{board?.clinicName ?? "Live queue preview"}</h2>
          <p>{board?.doctorName ?? "Select any doctor to show the public queue board."}</p>
        </div>
        <div className="gateway-queue-numbers">
          <Statistic title="Now serving" value={board?.currentQueueNumber ?? "M001"} />
          <Statistic title="Next" value={board?.nextQueueNumber ?? "M002"} />
          <Statistic title="Waiting" value={board?.totalWaiting ?? 3} />
        </div>
        <Button icon={<ClockCircleOutlined />} onClick={() => setView("queue")}>View Queue Board</Button>
      </section>
      <Footer portal="all" setView={setView} />
    </>
  );
}

function FindDoctors(props: {
  doctors: Doctor[];
  loadingDoctors: boolean;
  cities: string[];
  specializations: string[];
  query: string;
  setQuery: (query: string) => void;
  location: string;
  setLocation: (location: string) => void;
  specialization: string;
  setSpecialization: (specialization: string) => void;
  availability: string;
  setAvailability: (availability: string) => void;
  setView: (view: View) => void;
  selectDoctor: (id: string) => void;
}) {
  const hasFilters = props.query || props.location !== "all" || props.specialization !== "all" || props.availability !== "today";
  const clearFilters = () => {
    props.setQuery("");
    props.setLocation("all");
    props.setSpecialization("all");
    props.setAvailability("today");
  };

  return (
    <section className="page-shell">
      <div className="section-title patient-launch-title">
        <span className="eyebrow">Patient booking portal</span>
        <h1>Book a doctor, then login to track your queue.</h1>
        <p>Patients can search clinics, choose a session, create an account, and follow their current queue number.</p>
        <div className="patient-launch-actions">
          <Button type="primary" icon={<SearchOutlined />} onClick={() => props.setQuery("")}>Find available doctors</Button>
          <Button icon={<LoginOutlined />} onClick={() => props.setView("patient-login")}>Patient Login</Button>
          <Button icon={<PlusOutlined />} onClick={() => props.setView("patient-register")}>Create Account</Button>
        </div>
      </div>
      <div className="filter-bar">
        <Input size="large" prefix={<SearchOutlined />} value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Doctor, clinic, city, specialization" />
        <Select size="large" value={props.location} onChange={props.setLocation} options={[{ value: "all", label: "All locations" }, ...props.cities.map((city) => ({ value: city, label: city }))]} />
        <Select size="large" value={props.specialization} onChange={props.setSpecialization} options={[{ value: "all", label: "All specializations" }, ...props.specializations.map((item) => ({ value: item, label: item }))]} />
        <Select size="large" value={props.availability} onChange={props.setAvailability} options={[{ value: "today", label: "Has sessions today" }, { value: "all", label: "Any availability" }]} />
      </div>
      <DoctorResults
        doctors={props.doctors}
        loadingDoctors={props.loadingDoctors}
        setView={props.setView}
        selectDoctor={props.selectDoctor}
        emptyDescription={hasFilters ? "No doctors match these filters yet." : "No doctors are available yet."}
        emptyAction={hasFilters ? clearFilters : undefined}
        emptyActionText="Clear filters"
      />
    </section>
  );
}

function DoctorResults({ doctors, loadingDoctors, setView, selectDoctor, emptyDescription, emptyAction, emptyActionText }: { doctors: Doctor[]; loadingDoctors: boolean; setView: (view: View) => void; selectDoctor: (id: string) => void; emptyDescription: string; emptyAction?: () => void; emptyActionText?: string }) {
  if (loadingDoctors) {
    return (
      <div className="doctor-grid">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="doctor-card-pro doctor-card-skeleton" variant="borderless">
            <Skeleton active avatar paragraph={{ rows: 4 }} />
          </Card>
        ))}
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <Card className="empty-results" variant="borderless">
        <Empty description={emptyDescription} />
        {emptyAction && <Button type="primary" onClick={emptyAction}>{emptyActionText ?? "Reset"}</Button>}
      </Card>
    );
  }

  return (
    <div className="doctor-grid">
      {doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} setView={setView} selectDoctor={selectDoctor} />)}
    </div>
  );
}

function DoctorCard({ doctor, setView, selectDoctor }: { doctor: Doctor; setView: (view: View) => void; selectDoctor: (id: string) => void }) {
  const choose = (view: View) => {
    selectDoctor(doctor.id);
    setView(view);
  };
  const nextSession = doctor.sessions[0];
  const estimatedDelay = doctor.totalWaiting * doctor.averageConsultationMinutes;

  return (
    <Card className="doctor-card-pro" variant="borderless">
      <div className="doctor-card-head">
        <span className="avatar">{doctor.doctorName.split(" ").slice(-1)[0]?.[0] ?? "D"}</span>
        <div>
          <h3>{doctor.doctorName}</h3>
          <p>{doctor.clinicName}</p>
        </div>
        <Tag color={doctor.queueStatus === "running" ? "success" : doctor.queueStatus === "paused" ? "purple" : "blue"}>{doctor.queueStatus.replace("_", " ")}</Tag>
      </div>
      <div className="doctor-meta">
        <span><b>{doctor.specialization}</b>Specialization</span>
        <span><b>{doctor.city}</b>Location</span>
        <span><b>{doctor.consultationFee ? `LKR ${doctor.consultationFee}` : "On visit"}</b>Fee</span>
        <span><b>{doctor.totalWaiting}</b>Patients waiting</span>
      </div>
      <div className="doctor-card-schedule">
        <span><ClockCircleOutlined /> {nextSession ? `${nextSession.sessionName} ${nextSession.startTime}-${nextSession.endTime}` : "Sessions updating"}</span>
        <span>Approx delay <b>{estimatedDelay} min</b></span>
      </div>
      <div className="card-actions">
        <Button onClick={() => choose("profile")}>View Profile</Button>
        <Button type="primary" icon={<CalendarOutlined />} onClick={() => choose("book")}>Book Queue Number</Button>
      </div>
    </Card>
  );
}

function DoctorProfile({ doctor, setView }: { doctor: Doctor; setView: (view: View) => void }) {
  return (
    <section className="profile-layout">
      <div className="profile-main card">
        <span className="status status-confirmed">Verified clinic</span>
        <h1>{doctor.doctorName}</h1>
        <p>{doctor.clinicName} · {doctor.specialization}</p>
        <div className="map-box">Google Map location · {doctor.city}</div>
        <h2>About clinic</h2>
        <p className="muted">Book this doctor’s dispensary session and use the live queue board to know when your turn is near.</p>
        <h2>Available sessions</h2>
        <div className="session-list">
          {doctor.sessions.map((session) => <span key={session.id}>{session.sessionName}<b>{session.startTime}-{session.endTime}</b><small>{session.maxPatients} patients</small></span>)}
        </div>
      </div>
      <aside className="profile-side card">
        <h2>Queue status</h2>
        <QueueStatusCard doctor={doctor} />
        <button className="primary sticky-mobile" onClick={() => setView("book")}>Book queue number</button>
        <button onClick={() => setView("queue")}>View public live queue</button>
      </aside>
    </section>
  );
}

function BookingFlow({ doctor, onBook, user, setView }: { doctor: Doctor; onBook: (event: FormEvent<HTMLFormElement>) => void; user: User | null; setView: (view: View) => void }) {
  return (
    <section className="booking-layout">
      <div className="section-title">
        <span className="eyebrow">Book queue number</span>
        <h1>{doctor.doctorName}</h1>
        <p>{doctor.clinicName} · {doctor.city}</p>
      </div>
      <form className="card step-form" onSubmit={onBook}>
        <input type="hidden" name="doctorId" value={doctor.id} />
        <div className="step-row"><b>1</b><label>Select date<input name="appointmentDate" type="date" min={today()} defaultValue={today()} required /></label></div>
        <div className="step-row"><b>2</b><label>Select session<select name="sessionId" required>{doctor.sessions.map((session) => <option key={session.id} value={session.id}>{session.sessionName} · {session.startTime}-{session.endTime}</option>)}</select></label></div>
        <div className="step-row"><b>3</b><label>Reason for visit<textarea name="reason" placeholder="Optional note for the doctor" /></label></div>
        <div className="booking-summary">
          <span>Patient<b>{user?.name ?? "Login required"}</b></span>
          <span>Average wait<b>{doctor.averageConsultationMinutes} min per patient</b></span>
        </div>
        <button className="primary large">{user?.role === "patient" ? "Confirm and get queue number" : "Login to continue"}</button>
        {user?.role !== "patient" && <button type="button" onClick={() => setView("patient-login")}>Go to Patient Login</button>}
      </form>
    </section>
  );
}

function LoginPage({ role, heading, defaultPhone, onSubmit, setView }: { role: "patient" | "doctor" | "admin"; heading: string; defaultPhone: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setView: (view: View) => void }) {
  const points = role === "doctor"
    ? ["Call the next patient", "Pause or resume sessions", "Add walk-ins quickly"]
    : role === "patient"
      ? ["See booking status", "Track current queue", "Get appointment updates"]
      : ["Review platform activity", "Manage clinic approvals", "Monitor active queues"];

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <span className="eyebrow">{role} access</span>
        <h1>{heading}</h1>
        <p>{role === "doctor" ? "Manage today’s appointments from one focused queue desk." : role === "patient" ? "Continue to your bookings, queue status, and notifications." : "Access platform operations and clinic management."}</p>
        <div className="auth-points">
          {points.map((point) => <span key={point}><CheckCircleOutlined /> {point}</span>)}
        </div>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="demo-access">
          <span>Demo account</span>
          <b>{defaultPhone}</b>
          <small>Password: password123</small>
        </div>
        <label>{role === "admin" ? "Email or phone" : role === "doctor" ? "Phone or email" : "Phone number"}<input name="phone" defaultValue={defaultPhone} required /></label>
        <label>Password<input name="password" type="password" defaultValue="password123" minLength={6} required /></label>
        <button className="primary large">Login</button>
        <button type="button" className="link-button" onClick={() => setView("forgot")}>Forgot password?</button>
        {role === "patient" && <button type="button" onClick={() => setView("patient-register")}>Create patient account</button>}
        {role === "doctor" && <button type="button" onClick={() => setView("doctor-register")}>Register doctor clinic</button>}
        {role !== "patient" && <button type="button" onClick={() => setView("patient-login")}>Patient Login</button>}
        {role !== "doctor" && <button type="button" onClick={() => setView("doctor-login")}>Doctor Login</button>}
      </form>
    </section>
  );
}

function PatientRegister({ onSubmit, setView }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; setView: (view: View) => void }) {
  return (
    <section className="auth-layout">
      <div className="auth-copy"><span className="eyebrow">Patient register</span><h1>Create your patient account</h1><p>Book appointments and track your live queue number from your phone.</p></div>
      <form className="auth-card" onSubmit={onSubmit}>
        <label>Full name<input name="name" required /></label>
        <label>Phone number<input name="phone" required /></label>
        <label>Password<input name="password" type="password" minLength={6} required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" minLength={6} required /></label>
        <button className="primary large">Register</button>
        <button type="button" onClick={() => setView("patient-login")}>Already have an account?</button>
      </form>
    </section>
  );
}

function DoctorRegister({ onSubmit, setView }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; setView: (view: View) => void }) {
  return (
    <section className="register-page">
      <div className="section-title"><span className="eyebrow">Doctor register</span><h1>Submit your clinic for approval</h1></div>
      <form className="card doctor-register-form" onSubmit={onSubmit}>
        <fieldset><legend>1. Doctor Account</legend><label>Doctor full name<input name="name" required /></label><label>Phone number<input name="phone" required /></label><label>Email, optional<input name="email" type="email" /></label><label>Password<input name="password" type="password" minLength={6} required /></label><label>Confirm password<input name="confirmPassword" type="password" minLength={6} required /></label></fieldset>
        <fieldset><legend>2. Clinic Details</legend><label>Clinic / dispensary name<input name="clinicName" required /></label><label>Specialization<select name="specializationId"><option value="sp_01">General Medicine</option><option value="sp_02">Pediatrics</option><option value="sp_03">Dermatology</option><option value="sp_04">Cardiology</option></select></label><label>Consultation fee<input name="consultationFee" type="number" /></label><label>Average consultation time<input name="averageConsultationMinutes" type="number" defaultValue="10" /></label><label>Clinic address<input name="address" required /></label><label>City / district<input name="city" required /></label></fieldset>
        <fieldset><legend>3. Availability</legend><label>Available days<input value="Monday to Saturday" readOnly /></label><label>Morning session<input value="08:00 - 12:00" readOnly /></label><label>Evening session<input value="16:00 - 20:00" readOnly /></label><label>Maximum patients<input value="20 per session" readOnly /></label></fieldset>
        <fieldset><legend>4. Review and Submit</legend><p className="muted">Your clinic profile will be prepared for admin approval. You can edit sessions and profile details from the doctor dashboard later.</p><button className="primary large">Submit for approval</button><button type="button" onClick={() => setView("doctor-login")}>Back to Doctor Login</button></fieldset>
      </form>
    </section>
  );
}

function PatientDashboard({ user, appointments, notifications, setView, board, onAppointmentAction }: { user: User | null; appointments: Appointment[]; notifications: NotificationItem[]; setView: (view: View) => void; board: PublicBoard | null; onAppointmentAction: (appointmentId: string, action: "cancel") => void }) {
  if (user?.role !== "patient") return <EmptyAccess title="Patient Dashboard" text="Please login as a patient to see appointments and queue tracking." action={() => setView("patient-login")} />;
  const nextAppointment = appointments[0];
  return (
    <DashboardShell title={`Welcome, ${user.name}`} nav={["My Booking", "Current Queue", "Find Doctor", "Notifications"]}>
      <div className="dashboard-cards">
        <QueueTrackingCard appointment={nextAppointment} board={board} />
        <div className="card action-card"><h2>What do you need?</h2><button className="primary" onClick={() => setView("doctors")}>Book another queue number</button><button onClick={() => setView("queue")}>See current queue</button><button onClick={() => setView("patient-dashboard")}>My booking</button></div>
        <div className="card"><h2>Recent notifications</h2>{notifications.length === 0 ? <p className="muted">No notifications yet.</p> : notifications.slice(0, 4).map((item) => <NotificationRow key={item.id} item={item} />)}</div>
      </div>
      <AppointmentList appointments={appointments} onAppointmentAction={onAppointmentAction} />
    </DashboardShell>
  );
}

function DoctorDashboard({ user, data, onAction, onControl, onAppointmentAction, onWalkIn, setView }: { user: User | null; data: { appointments: Appointment[]; queues: Array<{ sessionId: string; status: string; currentQueueNumber?: string }> }; onAction: (action: "start" | "next", sessionId: string) => void; onControl: (action: "pause" | "resume" | "end", sessionId: string) => void; onAppointmentAction: (appointmentId: string, action: "complete" | "no-show") => void; onWalkIn: (event: FormEvent<HTMLFormElement>) => void; setView: (view: View) => void }) {
  if (user?.role !== "doctor") return <DoctorPortalAccess setView={setView} />;
  const sessionId = data.appointments[0]?.sessionId;
  const current = data.appointments.find((item) => item.status === "current");
  const next = data.appointments.find((item) => item.status === "waiting" || item.status === "confirmed");
  const completed = data.appointments.filter((item) => item.status === "completed").length;
  const noShows = data.appointments.filter((item) => item.status === "no-show").length;
  const currentQueue = data.queues.find((item) => item.sessionId === sessionId);
  const waiting = data.appointments.filter((item) => item.status === "waiting" || item.status === "confirmed").length;
  return (
    <DashboardShell title="Clinic Dashboard" nav={["Overview", "Today’s Queue", "Patients", "Walk-in", "Sessions"]}>
      <section className="doctor-portal-brief">
        <div>
          <span className="eyebrow">Doctor workspace</span>
          <h2>Maintain patients, bookings, and the live queue from one place.</h2>
          <p className="muted">This is the operational dashboard we can give each clinic after onboarding.</p>
        </div>
        <div className="doctor-portal-actions">
          <Button icon={<FileTextOutlined />}>Patient records</Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!sessionId}>Add patient</Button>
        </div>
      </section>
      <div className="doctor-command">
        <div className="current-patient card">
          <span className="eyebrow">Current patient</span>
          <strong>{current?.queueNumber ?? "-"}</strong>
          <p>{current?.patientName ?? "No patient called yet"}</p>
          <button className="primary huge" disabled={!sessionId} onClick={() => sessionId && onAction("next", sessionId)}>Next Patient</button>
        </div>
        <div className="queue-side card">
          <h2>Waiting list</h2>
          <p><b>{next?.queueNumber ?? "-"}</b> {next?.patientName ?? "Waiting list is empty"}</p>
          <div className="doctor-actions">
            <button disabled={!sessionId} onClick={() => sessionId && onAction("start", sessionId)}>Start Session</button>
            <button disabled={!sessionId || currentQueue?.status !== "running"} onClick={() => sessionId && onControl("pause", sessionId)}>Pause Queue</button>
            <button disabled={!sessionId || currentQueue?.status !== "paused"} onClick={() => sessionId && onControl("resume", sessionId)}>Resume Queue</button>
            <button disabled={!sessionId} onClick={() => sessionId && onControl("end", sessionId)}>End Session</button>
          </div>
        </div>
      </div>
      <div className="metric-row">
        <Metric label="Total appointments" value={data.appointments.length} />
        <Metric label="Waiting" value={waiting} />
        <Metric label="Completed" value={completed} />
        <Metric label="No-show" value={noShows} />
      </div>
      <DoctorPatientPanel appointments={data.appointments} />
      <WalkInForm sessionId={sessionId} onWalkIn={onWalkIn} />
      <QueueTable appointments={data.appointments} onAppointmentAction={onAppointmentAction} />
    </DashboardShell>
  );
}

function DoctorPortalAccess({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="doctor-access-shell">
      <aside className="doctor-access-sidebar">
        <span className="logo mini"><LogoMark />DocBook Doctor</span>
        {["Overview", "Patient bookings", "Live queue", "Walk-ins", "Clinic settings"].map((item) => (
          <Button key={item} type={item === "Overview" ? "primary" : "text"} icon={item.includes("queue") ? <TeamOutlined /> : item.includes("booking") ? <CalendarOutlined /> : <DashboardOutlined />}>{item}</Button>
        ))}
      </aside>
      <div className="doctor-access-main">
        <section className="doctor-access-hero">
          <div>
            <span className="eyebrow">Clinic onboarding portal</span>
            <h1>Give every doctor a private dashboard to maintain patients.</h1>
            <p>Doctors can manage bookings, call the next patient, add walk-ins, and keep the public queue board accurate after signing in.</p>
            <div className="doctor-access-actions">
              <Button type="primary" size="large" icon={<LoginOutlined />} onClick={() => setView("doctor-login")}>Doctor Login</Button>
              <Button size="large" icon={<PlusOutlined />} onClick={() => setView("doctor-register")}>Register Clinic</Button>
            </div>
          </div>
          <div className="doctor-access-card">
            <span>Demo doctor access</span>
            <b>0771000001</b>
            <small>Password: password123</small>
          </div>
        </section>
        <div className="metric-row">
          <Metric label="Queue control" value={4} />
          <Metric label="Patient actions" value={5} />
          <Metric label="Clinic sessions" value={2} />
          <Metric label="Live board" value={1} />
        </div>
        <section className="doctor-access-preview">
          <Card variant="borderless">
            <h2>Patient maintenance</h2>
            <p className="muted">View booked patients, walk-ins, phone numbers, status, and visit reason.</p>
            <div className="role-checks">
              <span><CheckCircleOutlined /> Track waiting patients</span>
              <span><CheckCircleOutlined /> Mark complete or no-show</span>
              <span><CheckCircleOutlined /> Add walk-ins to today’s session</span>
            </div>
          </Card>
          <Card variant="borderless">
            <h2>Operational queue desk</h2>
            <p className="muted">Start, pause, resume, or end a clinic session without leaving the dashboard.</p>
            <div className="role-checks">
              <span><CheckCircleOutlined /> Call the next queue number</span>
              <span><CheckCircleOutlined /> Sync public queue board</span>
              <span><CheckCircleOutlined /> Review daily appointment metrics</span>
            </div>
          </Card>
        </section>
      </div>
    </section>
  );
}

function DoctorPatientPanel({ appointments }: { appointments: Appointment[] }) {
  const activePatients = appointments.filter((item) => ["current", "waiting", "confirmed"].includes(item.status)).slice(0, 4);
  return (
    <div className="card doctor-patient-panel">
      <div>
        <h2>Patient maintenance</h2>
        <p className="muted">Active patients from today’s bookings and walk-ins.</p>
      </div>
      {activePatients.length === 0 ? <p className="muted">No active patients yet.</p> : activePatients.map((item) => (
        <div className="patient-maintenance-row" key={item.id}>
          <b>{item.queueNumber}</b>
          <span>{item.patientName ?? "Patient"}</span>
          <span>{item.patientPhone ?? "-"}</span>
          <span className={statusClass(item.status)}>{item.status}</span>
        </div>
      ))}
    </div>
  );
}

function AdminDashboard({ user, admin, setView, onDoctorAction }: { user: User | null; admin: AdminPayload | null; setView: (view: View) => void; onDoctorAction: (doctorId: string, action: AdminDoctorAction) => void }) {
  if (user?.role !== "admin") return <AdminPortalAccess setView={setView} />;
  const summary = admin?.summary ?? {};
  const doctors = admin?.doctors ?? [];
  const patients = admin?.patients ?? [];
  const paymentColor = (status?: string) => status === "paid" ? "success" : status === "overdue" ? "error" : "warning";
  const accountColor = (status?: string) => status === "active" ? "success" : status === "blocked" ? "error" : "processing";
  return (
    <DashboardShell title="Admin Control Center" nav={["Overview", "Doctor Payments", "Patients", "Approvals", "Reports", "Settings"]}>
      <section className="admin-command-panel">
        <div>
          <span className="eyebrow">Admin operations</span>
          <h2>Approve paid doctors and block unpaid clinics before patients can book them.</h2>
          <p className="muted">Patient search only shows doctors who are approved, paid, and active. This dashboard controls those gates.</p>
        </div>
        <div className="admin-command-actions">
          <Button type="primary" icon={<CreditCardOutlined />}>Payment review</Button>
          <Button icon={<UserOutlined />}>Patient records</Button>
        </div>
      </section>
      <div className="metric-row">
        <Metric label="Total doctors" value={summary.totalDoctors ?? 0} />
        <Metric label="Paid doctors" value={summary.paidDoctors ?? 0} />
        <Metric label="Unpaid doctors" value={summary.unpaidDoctors ?? 0} />
        <Metric label="Blocked doctors" value={summary.blockedDoctors ?? 0} />
      </div>
      <section className="admin-management-grid">
        <div className="card admin-table-card">
          <div className="admin-table-title">
            <div>
              <h2>Doctor payment approvals</h2>
              <p className="muted">Control which doctors can operate and appear in patient booking.</p>
            </div>
            <Tag color="blue">{summary.pendingApprovals ?? 0} pending</Tag>
          </div>
          <div className="admin-doctor-list">
            {doctors.map((doctor) => (
              <div className="admin-doctor-row" key={doctor.id}>
                <div>
                  <b>{doctor.doctorName}</b>
                  <span>{doctor.clinicName} · {doctor.specialization ?? doctor.city}</span>
                  <small>{doctor.doctorPhone ?? "No phone"} · {doctor.doctorEmail ?? "No email"}</small>
                </div>
                <div className="admin-status-stack">
                  <Tag color={paymentColor(doctor.paymentStatus)}>{readable(doctor.paymentStatus ?? "unpaid")}</Tag>
                  <Tag color={accountColor(doctor.userStatus)}>{readable(doctor.userStatus ?? "pending")}</Tag>
                  <Tag>{readable(doctor.verificationStatus ?? "pending")}</Tag>
                </div>
                <div className="admin-payment-note">
                  <span>{doctor.paymentReference ?? "No reference"}</span>
                  <small>{doctor.lastPaymentAt ? new Date(doctor.lastPaymentAt).toLocaleDateString() : "Payment not confirmed"}</small>
                </div>
                <div className="admin-action-row">
                  <Button size="small" type="primary" icon={<CreditCardOutlined />} onClick={() => onDoctorAction(doctor.id, "approve-payment")}>Approve payment</Button>
                  <Button size="small" danger icon={<StopOutlined />} disabled={doctor.paymentStatus === "paid" || doctor.userStatus === "blocked"} onClick={() => onDoctorAction(doctor.id, "block-unpaid")}>Block unpaid</Button>
                  <Button size="small" icon={<UnlockOutlined />} disabled={doctor.userStatus !== "blocked"} onClick={() => onDoctorAction(doctor.id, "unblock")}>Unblock</Button>
                  <Button size="small" danger disabled={doctor.verificationStatus === "rejected"} onClick={() => onDoctorAction(doctor.id, "reject")}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card admin-table-card">
          <div className="admin-table-title">
            <div>
              <h2>Patients</h2>
              <p className="muted">Patients who can book, login, and track queues.</p>
            </div>
            <Tag color="success">{summary.totalPatients ?? patients.length} total</Tag>
          </div>
          <div className="admin-patient-list">
            {patients.slice(0, 8).map((patient) => (
              <div className="admin-patient-row" key={patient.id}>
                <span className="avatar">{patient.name.slice(0, 1)}</span>
                <div>
                  <b>{patient.name}</b>
                  <small>{patient.phone}</small>
                </div>
                <Tag color={accountColor(patient.status)}>{readable(patient.status ?? "active")}</Tag>
              </div>
            ))}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

function AdminPortalAccess({ setView }: { setView: (view: View) => void }) {
  return (
    <section className="doctor-access-shell admin-access-shell">
      <aside className="doctor-access-sidebar">
        <span className="logo mini"><LogoMark />DocBook Admin</span>
        {["Overview", "Doctor payments", "Patients", "Approvals", "Reports"].map((item) => (
          <Button key={item} type={item === "Overview" ? "primary" : "text"} icon={item.includes("payment") ? <CreditCardOutlined /> : item.includes("Patient") ? <UserOutlined /> : <DashboardOutlined />}>{item}</Button>
        ))}
      </aside>
      <div className="doctor-access-main">
        <section className="doctor-access-hero admin-access-hero">
          <div>
            <span className="eyebrow">Platform admin portal</span>
            <h1>Manage doctors, patients, payments, and clinic access.</h1>
            <p>Admins approve doctors after payment, block unpaid clinics, and keep the patient booking marketplace clean.</p>
            <div className="doctor-access-actions">
              <Button type="primary" size="large" icon={<LoginOutlined />} onClick={() => setView("admin-login")}>Admin Login</Button>
              <Button size="large" icon={<MedicineBoxOutlined />} href="/doctors">Doctor Portal</Button>
              <Button size="large" icon={<CalendarOutlined />} href="/patients">Patient App</Button>
            </div>
          </div>
          <div className="doctor-access-card">
            <span>Demo admin access</span>
            <b>0770000000</b>
            <small>Password: password123</small>
          </div>
        </section>
        <section className="doctor-access-preview">
          <Card variant="borderless">
            <h2>Doctor approval desk</h2>
            <p className="muted">Approve paid doctors, block unpaid clinics, and reject profiles that should not go live.</p>
            <div className="role-checks">
              <span><CheckCircleOutlined /> Payment approval</span>
              <span><CheckCircleOutlined /> Account blocking</span>
              <span><CheckCircleOutlined /> Patient booking visibility</span>
            </div>
          </Card>
          <Card variant="borderless">
            <h2>Patient oversight</h2>
            <p className="muted">Review active patient accounts and bookings as the platform grows.</p>
            <div className="role-checks">
              <span><CheckCircleOutlined /> Patient records</span>
              <span><CheckCircleOutlined /> Appointment volume</span>
              <span><CheckCircleOutlined /> Queue health</span>
            </div>
          </Card>
        </section>
      </div>
    </section>
  );
}

function PublicQueue({ board }: { board: PublicBoard | null }) {
  return (
    <section className="public-queue">
      <Card className="queue-screen" variant="borderless">
        <div className="queue-screen-top"><div><span className="eyebrow">Public Live Queue</span><h1>{board?.clinicName ?? "Select a clinic"}</h1><p>{board?.doctorName ?? "Doctor queue board"}</p></div><Tag color={board?.status === "running" ? "success" : "blue"}>{board?.status ?? "not started"}</Tag></div>
        <span className="queue-label">Now serving</span>
        <strong>{board?.currentQueueNumber ?? "-"}</strong>
        <div className="queue-screen-grid">
          <Statistic title="Next" value={board?.nextQueueNumber ?? "-"} />
          <Statistic title="Waiting" value={board?.totalWaiting ?? 0} />
          <Statistic title="Estimated delay" value={board?.estimatedDelay ?? 0} suffix="m" />
          <Statistic title="Updated" value={board ? new Date(board.lastUpdatedAt).toLocaleTimeString() : "-"} />
        </div>
      </Card>
    </section>
  );
}

function QueueStatusCard({ doctor }: { doctor: Doctor }) {
  return <div className="queue-status-card"><span className={statusClass(doctor.queueStatus)}>{doctor.queueStatus.replace("_", " ")}</span><strong>{doctor.currentQueueNumber}</strong><p>{doctor.totalWaiting} waiting · approx {doctor.totalWaiting * doctor.averageConsultationMinutes} min delay</p></div>;
}

function DashboardShell({ title, nav, children }: { title: string; nav: string[]; children: React.ReactNode }) {
  return <section className="dashboard-shell"><aside className="dashboard-sidebar"><span className="logo mini"><LogoMark />DocBook</span>{nav.map((item) => <Button key={item} type="text" icon={item.includes("Queue") ? <TeamOutlined /> : item.includes("Notification") ? <BellOutlined /> : <HomeOutlined />}>{item}</Button>)}</aside><div className="dashboard-main"><div className="dashboard-title"><h1>{title}</h1><Tag color="success">Live updates</Tag></div>{children}</div></section>;
}

function QueueTrackingCard({ appointment, board }: { appointment?: Appointment; board: PublicBoard | null }) {
  return <div className="card tracking-card"><h2>Your queue number</h2>{appointment ? <><strong>{appointment.queueNumber}</strong><p>{appointment.doctor?.doctorName} · {appointment.status}</p><div className="timeline"><span>Booked</span><span>Waiting</span><span>Next</span><span>Called</span></div><p className="muted">Current serving: {board?.currentQueueNumber ?? "-"} · Estimated wait {appointment.estimatedTime}m</p></> : <p className="muted">No booking yet. Find a doctor to get your queue number.</p>}</div>;
}

function AppointmentList({ appointments, onAppointmentAction }: { appointments: Appointment[]; onAppointmentAction: (appointmentId: string, action: "cancel") => void }) {
  return (
    <div className="card">
      <h2>My bookings</h2>
      {appointments.length === 0 ? <p className="muted">No bookings yet.</p> : appointments.map((item) => (
        <div className="appointment-row" key={item.id}>
          <b>{item.queueNumber}</b>
          <span>{item.doctor?.doctorName}</span>
          <span>{item.appointmentDate}</span>
          <span className={statusClass(item.status)}>{item.status}</span>
          <button disabled={!["pending", "confirmed", "waiting"].includes(item.status)} onClick={() => onAppointmentAction(item.id, "cancel")}>Cancel</button>
        </div>
      ))}
    </div>
  );
}

function WalkInForm({ sessionId, onWalkIn }: { sessionId?: string; onWalkIn: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="card walkin-form" onSubmit={onWalkIn}>
      <div>
        <h2>Add walk-in patient</h2>
        <p className="muted">Use this when someone arrives directly at the dispensary.</p>
      </div>
      <input type="hidden" name="sessionId" value={sessionId ?? ""} />
      <label>Patient name<input name="name" placeholder="Patient name" required /></label>
      <label>Phone<input name="phone" placeholder="Phone number" required /></label>
      <label>Reason<input name="reason" placeholder="Optional reason" /></label>
      <button className="primary" disabled={!sessionId}>Add to queue</button>
    </form>
  );
}

function QueueTable({ appointments, onAppointmentAction }: { appointments: Appointment[]; onAppointmentAction: (appointmentId: string, action: "complete" | "no-show") => void }) {
  return (
    <div className="card responsive-table">
      <h2>Today’s queue list</h2>
      {appointments.length === 0 ? <p className="muted">No patients booked for today.</p> : appointments.map((item) => (
        <div className="queue-row" key={item.id}>
          <b>{item.queueNumber}</b>
          <span>{item.patientName}</span>
          <span>{item.patientPhone}</span>
          <span className={statusClass(item.status)}>{item.status}</span>
          <span>{item.estimatedTime}m</span>
          <button disabled={item.status !== "current"} onClick={() => onAppointmentAction(item.id, "complete")}>Complete</button>
          <button disabled={!["current", "waiting", "confirmed"].includes(item.status)} onClick={() => onAppointmentAction(item.id, "no-show")}>No-show</button>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card className="metric-card" variant="borderless"><Statistic title={label} value={value} /></Card>;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  return <div className="notification-row"><b>{item.title}</b><span>{item.message}</span></div>;
}

function EmptyAccess({ title, text, action }: { title: string; text: string; action: () => void }) {
  return <section className="empty-state"><div className="card"><span className="eyebrow">{title}</span><h1>Login required</h1><p>{text}</p><button className="primary" onClick={action}>Go to login</button></div></section>;
}

function InfoPage({ title, text }: { title: string; text: string }) {
  return <section className="info-page card"><span className="eyebrow">DocBook</span><h1>{title}</h1><p>{text}</p></section>;
}

function MobilePatientNav({ setView }: { setView: (view: View) => void }) {
  return <nav className="mobile-bottom-nav"><button onClick={() => setView("patient-dashboard")}>Home</button><button onClick={() => setView("doctors")}>Find</button><button onClick={() => setView("queue")}>Track</button><button onClick={() => setView("patient-dashboard")}>Profile</button></nav>;
}

function Footer({ portal, setView }: { portal: Portal; setView: (view: View) => void }) {
  return (
    <footer className="footer">
      <b>DocBook</b>
      {portal === "patient" && <button onClick={() => setView("doctors")}>Find Doctor</button>}
      {portal === "patient" && <button onClick={() => setView("queue")}>Current Queue</button>}
      {portal === "doctor" && <button onClick={() => setView("doctor-login")}>Queue Desk</button>}
      {portal === "admin" && <button onClick={() => setView("admin-login")}>Admin Desk</button>}
      {portal === "all" && <a href="/patients">Patient App</a>}
      {portal === "all" && <a href="/doctors">Doctor App</a>}
      {portal === "all" && <a href="/admin">Admin</a>}
      <span>Built for local dispensaries</span>
    </footer>
  );
}
