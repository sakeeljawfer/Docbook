"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { id: string; role: "patient" | "doctor" | "admin"; name: string; phone: string; email?: string };
type Doctor = {
  id: string;
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

const today = () => new Date().toISOString().slice(0, 10);
const statusClass = (status?: string) => `status status-${(status ?? "confirmed").replace(/\s+/g, "-")}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

export default function MediQueueApp() {
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [specialization, setSpecialization] = useState("all");
  const [availability, setAvailability] = useState("today");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [message, setMessage] = useState("");
  const [doctorQueue, setDoctorQueue] = useState<{ doctor?: Doctor; appointments: Appointment[]; queues: Array<{ sessionId: string; status: string; currentQueueNumber?: string }> }>({ appointments: [], queues: [] });
  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [admin, setAdmin] = useState<Record<string, unknown> | null>(null);

  const selectedDoctor = useMemo(() => doctors.find((doctor) => doctor.id === selectedDoctorId) ?? doctors[0], [doctors, selectedDoctorId]);
  const filteredDoctors = useMemo(() => doctors.filter((doctor) => {
    const matchesLocation = location === "all" || doctor.city === location;
    const matchesSpecialization = specialization === "all" || doctor.specialization === specialization;
    const matchesAvailability = availability === "all" || doctor.sessions.length > 0;
    return matchesLocation && matchesSpecialization && matchesAvailability;
  }), [doctors, location, specialization, availability]);
  const cities = Array.from(new Set(doctors.map((doctor) => doctor.city)));
  const specializations = Array.from(new Set(doctors.map((doctor) => doctor.specialization)));

  async function refresh() {
    const me = await api<{ user: User | null }>("/api/auth/me");
    setUser(me.user);
    const doctorData = await api<{ doctors: Doctor[] }>("/api/doctors?query=" + encodeURIComponent(query));
    setDoctors(doctorData.doctors);
    if (!selectedDoctorId && doctorData.doctors[0]) setSelectedDoctorId(doctorData.doctors[0].id);
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
        setAdmin(await api<Record<string, unknown>>("/api/admin/summary"));
      }
    }
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      api<{ doctors: Doctor[] }>("/api/doctors?query=" + encodeURIComponent(query))
        .then((data) => {
          setDoctors(data.doctors);
          if (!selectedDoctorId && data.doctors[0]) setSelectedDoctorId(data.doctors[0].id);
        })
        .catch((error) => setMessage(error.message));
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
    setMessage(role === "doctor" ? "Doctor profile submitted. Please sign in to continue." : "Patient account created. Please sign in.");
    setView(role === "doctor" ? "doctor-login" : "patient-login");
  }

  async function logout() {
    await api("/api/auth/me", { method: "DELETE" });
    setUser(null);
    setAppointments([]);
    setNotifications([]);
    setDoctorQueue({ appointments: [], queues: [] });
    setAdmin(null);
    setView("home");
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

  return (
    <>
      <Header view={view} user={user} setView={setView} logout={logout} />
      {message && <button className="toast" onClick={() => setMessage("")}>{message}</button>}
      <main>
        {view === "home" && <Home doctors={doctors} query={query} setQuery={setQuery} setView={setView} selectDoctor={setSelectedDoctorId} />}
        {view === "doctors" && <FindDoctors doctors={filteredDoctors} cities={cities} specializations={specializations} query={query} setQuery={setQuery} location={location} setLocation={setLocation} specialization={specialization} setSpecialization={setSpecialization} availability={availability} setAvailability={setAvailability} setView={setView} selectDoctor={setSelectedDoctorId} />}
        {view === "profile" && selectedDoctor && <DoctorProfile doctor={selectedDoctor} setView={setView} />}
        {view === "book" && selectedDoctor && <BookingFlow doctor={selectedDoctor} onBook={book} user={user} setView={setView} />}
        {view === "queue" && <PublicQueue board={board} />}
        {view === "about" && <InfoPage title="About MediQueue" text="MediQueue helps local dispensaries reduce waiting room crowding while giving patients a simple way to book, receive queue numbers, and track their turn." />}
        {view === "contact" && <InfoPage title="Contact" text="For clinic onboarding, support, and partnerships, contact hello@mediqueue.test or call 077 000 0000." />}
        {view === "patient-login" && <LoginPage role="patient" heading="Login to track your appointments" defaultPhone="0772000001" onSubmit={(event) => handleLogin(event, "patient-dashboard")} setView={setView} />}
        {view === "doctor-login" && <LoginPage role="doctor" heading="Doctor / Dispensary Login" defaultPhone="0771000001" onSubmit={(event) => handleLogin(event, "doctor-dashboard")} setView={setView} />}
        {view === "admin-login" && <LoginPage role="admin" heading="Admin Login" defaultPhone="0770000000" onSubmit={(event) => handleLogin(event, "admin-dashboard")} setView={setView} />}
        {view === "patient-register" && <PatientRegister onSubmit={(event) => handleRegister(event, "patient")} setView={setView} />}
        {view === "doctor-register" && <DoctorRegister onSubmit={(event) => handleRegister(event, "doctor")} setView={setView} />}
        {view === "forgot" && <InfoPage title="Forgot password" text="Password reset is prepared for future SMS/email integration. Please contact the clinic administrator for this MVP." />}
        {view === "patient-dashboard" && <PatientDashboard user={user} appointments={appointments} notifications={notifications} setView={setView} board={board} />}
        {view === "doctor-dashboard" && <DoctorDashboard user={user} data={doctorQueue} onAction={queueAction} setView={setView} />}
        {view === "admin-dashboard" && <AdminDashboard user={user} admin={admin} setView={setView} />}
      </main>
      {user?.role === "patient" && <MobilePatientNav setView={setView} />}
    </>
  );
}

function Header({ view, user, setView, logout }: { view: View; user: User | null; setView: (view: View) => void; logout: () => void }) {
  return (
    <header className="site-header">
      <button className="logo" onClick={() => setView("home")}><span>+</span>MediQueue</button>
      <nav className="public-nav">
        <button className={view === "doctors" ? "active" : ""} onClick={() => setView("doctors")}>Find Doctors</button>
        <button onClick={() => setView("doctor-register")}>For Doctors</button>
        <button onClick={() => setView("about")}>About</button>
        <button onClick={() => setView("contact")}>Contact</button>
      </nav>
      <div className="header-actions">
        {user ? (
          <>
            <button className="soft" onClick={() => setView(user.role === "doctor" ? "doctor-dashboard" : user.role === "admin" ? "admin-dashboard" : "patient-dashboard")}>{user.name}</button>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <button onClick={() => setView("patient-login")}>Patient Login</button>
            <button className="primary small" onClick={() => setView("doctor-login")}>Doctor Login</button>
          </>
        )}
      </div>
    </header>
  );
}

function Home({ doctors, query, setQuery, setView, selectDoctor }: { doctors: Doctor[]; query: string; setQuery: (query: string) => void; setView: (view: View) => void; selectDoctor: (id: string) => void }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Local clinic queue platform</span>
          <h1>Book doctor appointments and track your queue in real time</h1>
          <p>Find local dispensary doctors, book your appointment, and know when your turn is coming.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setView("doctors")}>Find a Doctor</button>
            <button onClick={() => setView("doctor-register")}>Register as Doctor</button>
          </div>
          <div className="hero-search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search doctor, clinic, specialization, or location" />
            <button className="primary" onClick={() => setView("doctors")}>Search</button>
          </div>
        </div>
        <div className="hero-board">
          <span className="status status-running">Live queue</span>
          <strong>M001</strong>
          <p>Now serving at Lotus Family Clinic</p>
          <div><span>Next</span><b>M002</b></div>
        </div>
      </section>
      <FeatureGrid />
      <section className="section-block">
        <div className="section-title">
          <span className="eyebrow">Featured clinics</span>
          <h2>Book from trusted local doctors</h2>
        </div>
        <div className="doctor-grid">
          {doctors.slice(0, 3).map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} setView={setView} selectDoctor={selectDoctor} />)}
        </div>
      </section>
      <section className="split-section">
        <div>
          <span className="eyebrow">How it works</span>
          <h2>Simple for patients</h2>
          <Stepper items={["Search doctor", "Book appointment", "Get queue number", "Track your turn"]} />
        </div>
        <div>
          <span className="eyebrow">For dispensaries</span>
          <h2>Cleaner daily operations</h2>
          <Stepper items={["Manage daily queue", "Reduce waiting room crowd", "Notify patients", "Improve clinic experience"]} />
        </div>
      </section>
      <Footer setView={setView} />
    </>
  );
}

function FindDoctors(props: {
  doctors: Doctor[];
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
  return (
    <section className="page-shell">
      <div className="section-title">
        <span className="eyebrow">Find Doctors</span>
        <h1>Search local clinics and book faster</h1>
      </div>
      <div className="filter-bar">
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Doctor, clinic, city, specialization" />
        <select value={props.location} onChange={(event) => props.setLocation(event.target.value)}>
          <option value="all">All locations</option>
          {props.cities.map((city) => <option key={city}>{city}</option>)}
        </select>
        <select value={props.specialization} onChange={(event) => props.setSpecialization(event.target.value)}>
          <option value="all">All specializations</option>
          {props.specializations.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={props.availability} onChange={(event) => props.setAvailability(event.target.value)}>
          <option value="today">Available today</option>
          <option value="all">Any availability</option>
        </select>
      </div>
      <div className="doctor-grid">
        {props.doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} setView={props.setView} selectDoctor={props.selectDoctor} />)}
      </div>
    </section>
  );
}

function DoctorCard({ doctor, setView, selectDoctor }: { doctor: Doctor; setView: (view: View) => void; selectDoctor: (id: string) => void }) {
  const choose = (view: View) => {
    selectDoctor(doctor.id);
    setView(view);
  };
  return (
    <article className="doctor-card-pro">
      <div className="doctor-card-head">
        <span className="avatar">{doctor.doctorName.split(" ").slice(-1)[0]?.[0] ?? "D"}</span>
        <div>
          <h3>{doctor.doctorName}</h3>
          <p>{doctor.clinicName}</p>
        </div>
        <span className={statusClass(doctor.queueStatus)}>{doctor.queueStatus.replace("_", " ")}</span>
      </div>
      <div className="doctor-meta">
        <span>{doctor.specialization}</span>
        <span>{doctor.city}</span>
        <span>{doctor.consultationFee ? `LKR ${doctor.consultationFee}` : "Fee on visit"}</span>
        <span>{doctor.totalWaiting} waiting</span>
      </div>
      <div className="card-actions">
        <button onClick={() => choose("profile")}>View Profile</button>
        <button className="primary" onClick={() => choose("book")}>Book Appointment</button>
      </div>
    </article>
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
        <p className="muted">A local dispensary profile prepared for appointment booking, live queue display, and future reviews.</p>
        <h2>Available sessions</h2>
        <div className="session-list">
          {doctor.sessions.map((session) => <span key={session.id}>{session.sessionName}<b>{session.startTime}-{session.endTime}</b><small>{session.maxPatients} patients</small></span>)}
        </div>
      </div>
      <aside className="profile-side card">
        <h2>Queue status</h2>
        <QueueStatusCard doctor={doctor} />
        <button className="primary sticky-mobile" onClick={() => setView("book")}>Book appointment</button>
        <button onClick={() => setView("queue")}>View public live queue</button>
      </aside>
    </section>
  );
}

function BookingFlow({ doctor, onBook, user, setView }: { doctor: Doctor; onBook: (event: FormEvent<HTMLFormElement>) => void; user: User | null; setView: (view: View) => void }) {
  return (
    <section className="booking-layout">
      <div className="section-title">
        <span className="eyebrow">Book appointment</span>
        <h1>{doctor.doctorName}</h1>
        <p>{doctor.clinicName} · {doctor.city}</p>
      </div>
      <form className="card step-form" onSubmit={onBook}>
        <input type="hidden" name="doctorId" value={doctor.id} />
        <div className="step-row"><b>1</b><label>Select date<input name="appointmentDate" type="date" min={today()} defaultValue={today()} required /></label></div>
        <div className="step-row"><b>2</b><label>Select session<select name="sessionId" required>{doctor.sessions.map((session) => <option key={session.id} value={session.id}>{session.sessionName} · {session.startTime}-{session.endTime}</option>)}</select></label></div>
        <div className="step-row"><b>3</b><label>Patient note<textarea name="reason" placeholder="Optional reason for visit" /></label></div>
        <div className="booking-summary">
          <span>Patient<b>{user?.name ?? "Login required"}</b></span>
          <span>Average wait<b>{doctor.averageConsultationMinutes} min per patient</b></span>
        </div>
        <button className="primary large">{user?.role === "patient" ? "Confirm booking" : "Login to continue"}</button>
        {user?.role !== "patient" && <button type="button" onClick={() => setView("patient-login")}>Go to Patient Login</button>}
      </form>
    </section>
  );
}

function LoginPage({ role, heading, defaultPhone, onSubmit, setView }: { role: "patient" | "doctor" | "admin"; heading: string; defaultPhone: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setView: (view: View) => void }) {
  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <span className="eyebrow">{role} access</span>
        <h1>{heading}</h1>
        <p>Use the seeded demo account or your registered account to continue.</p>
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
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

function PatientDashboard({ user, appointments, notifications, setView, board }: { user: User | null; appointments: Appointment[]; notifications: NotificationItem[]; setView: (view: View) => void; board: PublicBoard | null }) {
  if (user?.role !== "patient") return <EmptyAccess title="Patient Dashboard" text="Please login as a patient to see appointments and queue tracking." action={() => setView("patient-login")} />;
  const nextAppointment = appointments[0];
  return (
    <DashboardShell title={`Welcome, ${user.name}`} nav={["Overview", "My Appointments", "Track Appointment", "Find Doctors", "Notifications", "Profile"]}>
      <div className="dashboard-cards">
        <QueueTrackingCard appointment={nextAppointment} board={board} />
        <div className="card action-card"><h2>Quick actions</h2><button className="primary" onClick={() => setView("doctors")}>Find Doctor</button><button onClick={() => setView("patient-dashboard")}>My Appointments</button><button onClick={() => setView("queue")}>Track Appointment</button></div>
        <div className="card"><h2>Recent notifications</h2>{notifications.length === 0 ? <p className="muted">No notifications yet.</p> : notifications.slice(0, 4).map((item) => <NotificationRow key={item.id} item={item} />)}</div>
      </div>
      <AppointmentList appointments={appointments} />
    </DashboardShell>
  );
}

function DoctorDashboard({ user, data, onAction, setView }: { user: User | null; data: { appointments: Appointment[]; queues: Array<{ sessionId: string; status: string; currentQueueNumber?: string }> }; onAction: (action: "start" | "next", sessionId: string) => void; setView: (view: View) => void }) {
  if (user?.role !== "doctor") return <EmptyAccess title="Doctor Dashboard" text="Please login as a doctor to manage today’s queue." action={() => setView("doctor-login")} />;
  const sessionId = data.appointments[0]?.sessionId;
  const current = data.appointments.find((item) => item.status === "current");
  const next = data.appointments.find((item) => item.status === "waiting" || item.status === "confirmed");
  const completed = data.appointments.filter((item) => item.status === "completed").length;
  const noShows = data.appointments.filter((item) => item.status === "no-show").length;
  return (
    <DashboardShell title="Today’s Queue" nav={["Overview", "Today’s Queue", "Appointments", "Schedule", "Clinic Profile", "Walk-in", "Reports", "Settings"]}>
      <div className="doctor-command">
        <div className="current-patient card">
          <span className="eyebrow">Current patient</span>
          <strong>{current?.queueNumber ?? "-"}</strong>
          <p>{current?.patientName ?? "No patient called yet"}</p>
          <button className="primary huge" disabled={!sessionId} onClick={() => sessionId && onAction("next", sessionId)}>Call Next Patient</button>
        </div>
        <div className="queue-side card">
          <h2>Next patient</h2>
          <p><b>{next?.queueNumber ?? "-"}</b> {next?.patientName ?? "Waiting list is empty"}</p>
          <div className="doctor-actions">
            <button disabled={!sessionId} onClick={() => sessionId && onAction("start", sessionId)}>Start Session</button>
            <button>Pause Queue</button>
            <button>Resume Queue</button>
            <button>End Session</button>
            <button>Add Walk-in Patient</button>
          </div>
        </div>
      </div>
      <div className="metric-row">
        <Metric label="Total appointments" value={data.appointments.length} />
        <Metric label="Waiting" value={data.appointments.filter((item) => item.status === "waiting" || item.status === "confirmed").length} />
        <Metric label="Completed" value={completed} />
        <Metric label="No-show" value={noShows} />
      </div>
      <QueueTable appointments={data.appointments} />
    </DashboardShell>
  );
}

function AdminDashboard({ user, admin, setView }: { user: User | null; admin: Record<string, unknown> | null; setView: (view: View) => void }) {
  if (user?.role !== "admin") return <EmptyAccess title="Admin Dashboard" text="Please login as admin to manage platform data." action={() => setView("admin-login")} />;
  const summary = admin?.summary as Record<string, number> | undefined;
  return (
    <DashboardShell title="Admin Dashboard" nav={["Overview", "Doctors", "Patients", "Appointments", "Specializations", "Locations", "Reports", "Settings"]}>
      <div className="metric-row">
        {Object.entries(summary ?? {}).map(([key, value]) => <Metric key={key} label={key.replace(/[A-Z]/g, " $&")} value={value} />)}
        <Metric label="Pending approvals" value={1} />
        <Metric label="Active queues" value={2} />
      </div>
      <div className="card"><h2>Management</h2><div className="admin-actions"><button>Approve doctors</button><button>View patients</button><button>View appointments</button><button>Manage specializations</button><button>Manage locations</button><button>Reports</button></div></div>
    </DashboardShell>
  );
}

function PublicQueue({ board }: { board: PublicBoard | null }) {
  return (
    <section className="public-queue">
      <div className="queue-screen">
        <div className="queue-screen-top"><div><span className="eyebrow">Public Live Queue</span><h1>{board?.clinicName ?? "Select a clinic"}</h1><p>{board?.doctorName ?? "Doctor queue board"}</p></div><span className={statusClass(board?.status)}>{board?.status ?? "not started"}</span></div>
        <span className="queue-label">Now serving</span>
        <strong>{board?.currentQueueNumber ?? "-"}</strong>
        <div className="queue-screen-grid"><span>Next<b>{board?.nextQueueNumber ?? "-"}</b></span><span>Waiting<b>{board?.totalWaiting ?? 0}</b></span><span>Estimated delay<b>{board?.estimatedDelay ?? 0}m</b></span><span>Updated<b>{board ? new Date(board.lastUpdatedAt).toLocaleTimeString() : "-"}</b></span></div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return <section className="feature-grid">{["Search nearby doctors", "Book appointments easily", "Track live queue", "Get notified when your turn is near"].map((item, index) => <article className="feature-card" key={item}><span>{index + 1}</span><h3>{item}</h3><p>Designed for local dispensaries and patients who need simple, fast queue updates.</p></article>)}</section>;
}

function Stepper({ items }: { items: string[] }) {
  return <div className="stepper">{items.map((item, index) => <div key={item}><b>{index + 1}</b><span>{item}</span></div>)}</div>;
}

function QueueStatusCard({ doctor }: { doctor: Doctor }) {
  return <div className="queue-status-card"><span className={statusClass(doctor.queueStatus)}>{doctor.queueStatus.replace("_", " ")}</span><strong>{doctor.currentQueueNumber}</strong><p>{doctor.totalWaiting} waiting · approx {doctor.totalWaiting * doctor.averageConsultationMinutes} min delay</p></div>;
}

function DashboardShell({ title, nav, children }: { title: string; nav: string[]; children: React.ReactNode }) {
  return <section className="dashboard-shell"><aside className="dashboard-sidebar"><span className="logo mini"><span>+</span>MediQueue</span>{nav.map((item) => <button key={item}>{item}</button>)}</aside><div className="dashboard-main"><div className="dashboard-title"><h1>{title}</h1><span className="status status-running">Live updates</span></div>{children}</div></section>;
}

function QueueTrackingCard({ appointment, board }: { appointment?: Appointment; board: PublicBoard | null }) {
  return <div className="card tracking-card"><h2>Appointment tracking</h2>{appointment ? <><strong>{appointment.queueNumber}</strong><p>{appointment.doctor?.doctorName} · {appointment.status}</p><div className="timeline"><span>Booked</span><span>Confirmed</span><span>Waiting</span><span>Called</span></div><p className="muted">Current serving: {board?.currentQueueNumber ?? "-"} · Estimated wait {appointment.estimatedTime}m</p></> : <p className="muted">No upcoming appointment yet.</p>}</div>;
}

function AppointmentList({ appointments }: { appointments: Appointment[] }) {
  return <div className="card"><h2>Appointment history</h2>{appointments.length === 0 ? <p className="muted">No appointments yet.</p> : appointments.map((item) => <div className="appointment-row" key={item.id}><b>{item.queueNumber}</b><span>{item.doctor?.doctorName}</span><span>{item.appointmentDate}</span><span className={statusClass(item.status)}>{item.status}</span></div>)}</div>;
}

function QueueTable({ appointments }: { appointments: Appointment[] }) {
  return <div className="card responsive-table"><h2>Today’s queue list</h2>{appointments.map((item) => <div className="queue-row" key={item.id}><b>{item.queueNumber}</b><span>{item.patientName}</span><span>{item.patientPhone}</span><span className={statusClass(item.status)}>{item.status}</span><span>{item.estimatedTime}m</span><button>Call</button><button>Complete</button><button>No-show</button></div>)}</div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  return <div className="notification-row"><b>{item.title}</b><span>{item.message}</span></div>;
}

function EmptyAccess({ title, text, action }: { title: string; text: string; action: () => void }) {
  return <section className="empty-state"><div className="card"><span className="eyebrow">{title}</span><h1>Login required</h1><p>{text}</p><button className="primary" onClick={action}>Go to login</button></div></section>;
}

function InfoPage({ title, text }: { title: string; text: string }) {
  return <section className="info-page card"><span className="eyebrow">MediQueue</span><h1>{title}</h1><p>{text}</p></section>;
}

function MobilePatientNav({ setView }: { setView: (view: View) => void }) {
  return <nav className="mobile-bottom-nav"><button onClick={() => setView("patient-dashboard")}>Home</button><button onClick={() => setView("doctors")}>Find</button><button onClick={() => setView("queue")}>Track</button><button onClick={() => setView("patient-dashboard")}>Profile</button></nav>;
}

function Footer({ setView }: { setView: (view: View) => void }) {
  return <footer className="footer"><b>MediQueue</b><button onClick={() => setView("doctors")}>Find Doctors</button><button onClick={() => setView("doctor-register")}>For Doctors</button><button onClick={() => setView("about")}>About</button><button onClick={() => setView("contact")}>Contact</button><span>hello@mediqueue.test</span></footer>;
}
