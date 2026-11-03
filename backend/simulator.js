// ==============================================================
// AI-Powered Elderly Care Ecosystem - Dual Device Live Simulator
// Mensimulasikan:
// 1) HUAWEI-WATCH-001 (Smartwatch: HR, Steps, Activity, Accel G)
// 2) ECA-HOME-001  (Home Safety Node: Room Temp, Humidity, MQ-2 Gas)
// Mendukung simulasi kejadian darurat sesuai Juknis 5.5
// ==============================================================
const http = require('http');

const PATIENT_ID = 1;
const WATCH_ID = 'HUAWEI-WATCH-001';
const HOME_ID  = 'ECA-HOME-001';

console.log('=============================================================');
console.log('  ECA Simulator: Dual-Device Telemetry & Emergency Trigger   ');
console.log('  Mensimulasikan Smartwatch Lansia & Node Keamanan Rumah     ');
console.log('=============================================================\n');

let step = 0;
let accumulatedSteps = 1420;

function sendPost(path, payload, label) {
  const data = JSON.stringify(payload);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Authorization': 'Bearer HUAWEI_ECA_TOKEN_2026'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] [${label}] -> HTTP ${res.statusCode}`);
    });
  });

  req.on('error', (err) => {
    console.error(`[Error] [${label}] Gagal: ${err.message}`);
  });

  req.write(data);
  req.end();
}

function runTelemetryLoop() {
  step++;

  // 1. Simulasi Smartwatch Lansia
  const baseHeart = 76;
  const hrWave = Math.sin(step * 0.25) * 8;
  const heartRate = Math.round(baseHeart + hrWave + (Math.random() * 4 - 2));

  // Simulasi langkah & gerak lansia
  const isWalking = step % 6 < 4; // Aktif bergerak bergantian dengan istirahat
  if (isWalking) accumulatedSteps += Math.floor(Math.random() * 4 + 2);

  const watchPayload = {
    device_id: WATCH_ID,
    patient_id: PATIENT_ID,
    device_type: 'watch',
    heart_rate: heartRate,
    activity: isWalking ? 'ACTIVE' : 'REST',
    steps: accumulatedSteps,
    accel_g: parseFloat((1.0 + (isWalking ? Math.random() * 0.25 - 0.12 : 0)).toFixed(2)),
    health_status: heartRate > 100 ? 'WARNING' : 'NORMAL',
    fall_cancelled: 0,
    sensor_ok: true,
    sim: true,
    wifi_rssi: -62
  };
  sendPost('/api/telemetry', watchPayload, `WATCH: HR ${heartRate} BPM | Steps ${accumulatedSteps} (${watchPayload.activity})`);

  // 2. Simulasi Node Keamanan Rumah (Suhu & Asap Gas)
  const roomTemp = parseFloat((26.5 + Math.sin(step * 0.1) * 0.8 + (Math.random() * 0.2 - 0.1)).toFixed(1));
  const humidity = parseFloat((60.0 + Math.random() * 3).toFixed(1));
  const smokeAdc = Math.round(450 + Math.random() * 60);

  const homePayload = {
    device_id: HOME_ID,
    patient_id: PATIENT_ID,
    device_type: 'home',
    room_temp: roomTemp,
    humidity: humidity,
    smoke_adc: smokeAdc,
    smoke_status: 'NORMAL',
    sensor_ok: true,
    sim: true
  };
  sendPost('/api/telemetry', homePayload, `HOME: Temp ${roomTemp}°C | Gas ${smokeAdc} ADC (NORMAL)`);
}

// Jalankan pengiriman berkala tiap 3 detik
setInterval(runTelemetryLoop, 3000);
runTelemetryLoop();
