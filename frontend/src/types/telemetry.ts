export type HealthStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface HealthMetric {
  id: number;
  patient_id: number;
  device_id: string;
  temperature: number;
  humidity: number | null;
  heart_rate: number;
  health_status: HealthStatus;
  recorded_at: string;
  full_name?: string;
  room_number?: string;
}

export interface HealthAlert {
  id: number;
  metric_id: number;
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
}
