import type {
  HealthMetric,
  EmergencyEvent,
  HealthAlert,
  PatientInfo,
  EmergencyContact,
  ReminderItem,
  ConsentItem,
  ConversationMessage,
} from '../types/telemetry';

const API_BASE = 'http://localhost:3000/api';

export async function fetchLatestTelemetry(patientId = 1): Promise<HealthMetric[]> {
  try {
    const res = await fetch(`${API_BASE}/telemetry/latest?patient_id=${patientId}`);
    if (!res.ok) throw new Error('Gagal mengambil data telemetri');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Telemetry Error]:', err);
    return [];
  }
}

export async function fetchEmergencyEvents(patientId = 1): Promise<EmergencyEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/events?patient_id=${patientId}`);
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
    const res = await fetch(`${API_BASE}/alerts`);
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
    const res = await fetch(`${API_BASE}/patients`);
    if (!res.ok) throw new Error('Gagal mengambil daftar pasien');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Patients Error]:', err);
    return [];
  }
}

export async function fetchEmergencyContacts(patientId = 1): Promise<EmergencyContact[]> {
  try {
    const res = await fetch(`${API_BASE}/contacts?patient_id=${patientId}`);
    if (!res.ok) throw new Error('Gagal mengambil kontak darurat');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[API Contacts Error]:', err);
    return [];
  }
}

export async function fetchReminders(patientId = 1): Promise<ReminderItem[]> {
  try {
    const res = await fetch(`${API_BASE}/reminders?patient_id=${patientId}`);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_id: reminderId, is_confirmed: isConfirmed }),
    });
    return res.ok;
  } catch (err) {
    console.error('[Toggle Reminder Error]:', err);
    return false;
  }
}

export async function fetchCompanionChat(patientId = 1): Promise<ConversationMessage[]> {
  try {
    const res = await fetch(`${API_BASE}/companion/chat?patient_id=${patientId}`);
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
      headers: { 'Content-Type': 'application/json' },
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

export async function fetchConsents(patientId = 1): Promise<ConsentItem[]> {
  try {
    const res = await fetch(`${API_BASE}/consent?patient_id=${patientId}`);
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
      headers: { 'Content-Type': 'application/json' },
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
    const eventId = `SIM-${eventType}-${Date.now().toString().slice(-4)}`;
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        device_id: eventType === 'SMOKE' ? 'ECA-HOME-001' : 'HUAWEI-WATCH-001',
        patient_id: 1,
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
