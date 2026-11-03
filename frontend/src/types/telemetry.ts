export type HealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface HealthMetric {
  id: number;
  patient_id: number;
  device_id: string;
  device_type?: 'watch' | 'home';
  
  // Pilar 1: Smartwatch Lansia
  heart_rate?: number | null;
  activity?: 'ACTIVE' | 'REST' | string;
  steps?: number;
  accel_g?: number;
  health_status: HealthStatus;
  fall_cancelled?: number;
  
  // Pilar 2: Home Safety Node
  temperature?: number | null;
  room_temp?: number | null;
  humidity?: number | null;
  smoke_adc?: number | null;
  smoke_status?: 'NORMAL' | 'ALERT' | string;
  
  // Metadata
  sim?: boolean;
  wifi_rssi?: number | null;
  recorded_at: string;
  full_name?: string;
  room_number?: string;
}

export interface EmergencyEvent {
  id: number;
  event_id: string;
  patient_id: number;
  device_id: string;
  event_type: 'FALL' | 'HR_ABNORMAL' | 'SOS' | 'SMOKE' | string;
  severity: 'WARNING' | 'CRITICAL';
  status: 'PENDING' | 'ESCALATED' | 'CANCELLED' | 'RESOLVED';
  value: number;
  sim: boolean;
  escalation_level: number;
  escalated_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  full_name?: string;
  room_number?: string;
}

export interface HealthAlert {
  id: number;
  metric_id?: number | null;
  patient_id: number;
  alert_type: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  is_resolved: boolean;
  created_at: string;
  full_name?: string;
  room_number?: string;
}

export interface PatientInfo {
  id: number;
  patient_code: string;
  full_name: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  room_number: string;
  condition_summary?: string;
  active_alerts?: number;
}

export interface EmergencyContact {
  id: number;
  patient_id: number;
  name: string;
  relationship: string;
  phone_number: string;
  priority_order: number;
  is_primary: boolean;
}

export interface ReminderItem {
  id: number;
  patient_id: number;
  reminder_type: 'MEDICINE' | 'ACTIVITY' | 'CHECKIN';
  title: string;
  time_scheduled: string;
  is_confirmed: boolean;
  confirmed_at: string | null;
}

export interface ConsentItem {
  id: number;
  patient_id: number;
  data_type: string;
  description: string;
  is_granted: boolean;
  granted_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  patient_id: number;
  sender: 'ELDER' | 'AI';
  message: string;
  sentiment: string;
  created_at: string;
}

export interface AuthUser {
  id: number;
  username?: string;
  full_name: string;
  role: string;
}

export interface PairedDevice {
  id: string;
  patient_id: number;
  device_token: string;
  device_type: string;
  model_name: string;
  status: string;
  last_seen?: string;
  patient_name?: string;
  room_number?: string;
  age?: number;
}

export interface AuthSession {
  token: string;
  auth_type: 'CREDENTIAL' | 'DEVICE_TOKEN';
  user: AuthUser;
  paired_device: PairedDevice | null;
  patient_id: number;
  patient_name: string;
}
