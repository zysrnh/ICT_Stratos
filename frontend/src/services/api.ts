import type { HealthMetric, HealthAlert } from '../types/telemetry';

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
