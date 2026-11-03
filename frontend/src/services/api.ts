import type {
  HealthMetric,
  EmergencyEvent,
  HealthAlert,
  PatientInfo,
  EmergencyContact,
  ReminderItem,
  ConsentItem,
  ConversationMessage,
  AuthSession,
} from '../types/telemetry';

export const API_BASE =
  (import.meta.env.VITE_API_URL as string) ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000/api'
    : '/api');

// Helper Token & Session Storage (Anti-Collision di Lingkungan Multi-User / Hosting)
const STORAGE_KEY = 'eca_auth_session';

export function getSavedSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function getAuthHeaders(): HeadersInit {
  const session = getSavedSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['x-device-token'] = session.token;
  }
  return headers;
}

// -------------------------------------------------------------
// Autentikasi Keluarga, Pairing Token & Pendaftaran ID Jam
// -------------------------------------------------------------
export async function loginAuth(params: {
  username?: string;
  password?: string;
  token?: string;
}): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Autentikasi gagal. Periksa token atau kredensial.');
  }

  saveSession(json);
  return json as AuthSession;
}

export async function pairDevice(token: string): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.trim() }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Pairing token tidak valid.');
  }

  const session: AuthSession = {
    token: token.trim(),
    auth_type: 'DEVICE_TOKEN',
    user: {
      id: 1,
      full_name: `Keluarga (${json.patient_name || 'Pasien'})`,
      role: 'FAMILY_PRIMARY',
    },
    paired_device: json.device,
    patient_id: json.patient_id,
    patient_name: json.patient_name || 'Lansia Terdaftar',
  };

  saveSession(session);
  return session;
}

export async function registerDevice(params: {
  device_token: string;
  patient_name: string;
  room_number?: string;
  age?: number;
}): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/register-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Pendaftaran perangkat gagal.');
  }

  const session: AuthSession = {
    token: json.token,
    auth_type: 'DEVICE_TOKEN',
    user: {
      id: 1,
      full_name: `Keluarga (${json.patient_name})`,
      role: 'FAMILY_PRIMARY',
    },
    paired_device: {
      id: json.devices[0],
      patient_id: json.patient_id,
      device_token: json.token,
      device_type: 'watch',
      model_name: 'Huawei Smart Health Band Pro',
      status: 'ONLINE',
      patient_name: json.patient_name,
    },
    patient_id: json.patient_id,
    patient_name: json.patient_name,
  };

  saveSession(session);
  return session;
}

// -------------------------------------------------------------
// Data Telemetri & Layanan Lansia
// -------------------------------------------------------------
export async function fetchLatestTelemetry(patientId?: number): Promise<HealthMetric[]> {
  try {
    const session = getSavedSession();
    const pid = patientId ?? session?.patient_id ?? 1;
    const res = await fetch(`${API_BASE}/telemetry/latest?patient_id=${pid}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil data telemetri');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Telemetry Error]:', err);
    return [];
  }
}

export async function fetchEmergencyEvents(patientId?: number): Promise<EmergencyEvent[]> {
  try {
    const session = getSavedSession();
    const pid = patientId ?? session?.patient_id ?? 1;
    const res = await fetch(`${API_BASE}/events?patient_id=${pid}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil events darurat');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Events Error]:', err);
    return [];
  }
}

export async function fetchActiveAlerts(): Promise<HealthAlert[]> {
  try {
    const res = await fetch(`${API_BASE}/alerts`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil alerts');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Alerts Error]:', err);
    return [];
  }
}

export async function fetchPatients(): Promise<PatientInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/patients`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil daftar pasien');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Patients Error]:', err);
    return [];
  }
}

export async function fetchEmergencyContacts(patientId?: number): Promise<EmergencyContact[]> {
  try {
    const session = getSavedSession();
    const pid = patientId ?? session?.patient_id ?? 1;
    const res = await fetch(`${API_BASE}/contacts?patient_id=${pid}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil kontak darurat');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Contacts Error]:', err);
    return [];
  }
}

export async function fetchReminders(patientId?: number): Promise<ReminderItem[]> {
  try {
    const session = getSavedSession();
    const pid = patientId ?? session?.patient_id ?? 1;
    const res = await fetch(`${API_BASE}/reminders?patient_id=${pid}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil pengingat obat');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Reminders Error]:', err);
    return [];
  }
}

export async function toggleReminder(reminderId: number, isConfirmed: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/reminders/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reminder_id: reminderId, is_confirmed: isConfirmed }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Toggle Reminder Error]:', err);
    return false;
  }
}

export async function fetchCompanionChat(patientId?: number): Promise<ConversationMessage[]> {
  try {
    const session = getSavedSession();
    const pid = patientId ?? session?.patient_id ?? 1;
    const res = await fetch(`${API_BASE}/companion/chat?patient_id=${pid}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil percakapan AI');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Companion Chat Error]:', err);
    return [];
  }
}

export async function sendCompanionMessage(patientId: number, message: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/companion/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ patient_id: patientId, message }),
    });
    if (!res.ok) throw new Error('Gagal mengirim pesan ke AI');
    const json = await res.json();
    return json.reply || null;
  } catch (err) {
    console.error('[Send Companion Error]:', err);
    return null;
  }
}

export async function fetchConsents(patientId?: number): Promise<ConsentItem[]> {
  try {
    const session = getSavedSession();
    const pid = patientId ?? session?.patient_id ?? 1;
    const res = await fetch(`${API_BASE}/consent?patient_id=${pid}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Gagal mengambil data consent');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Consent Error]:', err);
    return [];
  }
}

export async function toggleConsent(consentId: number, isGranted: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/consent/toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ consent_id: consentId, is_granted: isGranted }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Toggle Consent Error]:', err);
    return false;
  }
}

// Fitur Khusus Demo Juri: Memicu simulasi darurat langsung dari UI (Juknis 10: Skenario Demo)
export async function triggerSimulatedEvent(
  eventType: 'FALL' | 'SOS' | 'SMOKE' | 'HR_ABNORMAL',
  status: 'PENDING' | 'ESCALATED' | 'CANCELLED' | 'RESOLVED' = 'PENDING',
  value = 3.2
): Promise<boolean> {
  try {
    const session = getSavedSession();
    const eventId = `SIM-${eventType}-${Date.now().toString().slice(-4)}`;
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        event_id: eventId,
        device_id: eventType === 'SMOKE' ? 'ECA-HOME-001' : 'HUAWEI-WATCH-001',
        patient_id: session?.patient_id ?? 1,
        event_type: eventType,
        severity: 'CRITICAL',
        status: status,
        value: value,
        sim: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Trigger Sim Event Error]:', err);
    return false;
  }
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const json = await res.json();
    return json.status === 'OK' && json.db === 'CONNECTED';
  } catch {
    return false;
  }
}
