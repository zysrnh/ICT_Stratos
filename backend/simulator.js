// ==============================================================
// Huawei Health IoT - Telemetry Live Simulator
// Digunakan untuk menguji dashboard dan database RDS secara langsung
// ==============================================================
const http = require('http');

const PATIENT_ID = 1;
const DEVICE_ID = 'HUAWEI-WATCH-001';

console.log('🚀 [Simulator] Memulai Live Telemetry Stream ke Backend Localhost:3000...');
console.log('📡 Data akan dikirim otomatis setiap 3 detik...\n');

let step = 0;

function sendSimulatedData() {
  step++;

  // Simulasi variasi detak jantung realistis (fluktuasi halus 72 - 110 BPM)
  const baseHeart = 75;
  const hrWave = Math.sin(step * 0.2) * 15;
  const heartRate = Math.round(baseHeart + hrWave + (Math.random() * 6 - 3));

  // Simulasi variasi suhu tubuh realistis (36.4 - 37.6 °C)
  const tempWave = Math.sin(step * 0.1) * 0.6;
  const temperature = parseFloat((36.8 + tempWave + (Math.random() * 0.2 - 0.1)).toFixed(1));

  const humidity = parseFloat((55 + Math.random() * 5).toFixed(1));

  // Evaluasi Status EWS
  let healthStatus = 'NORMAL';
  if (temperature >= 38.5 || heartRate >= 120 || heartRate <= 48) {
    healthStatus = 'CRITICAL';
  } else if (temperature >= 37.5 || heartRate > 100 || heartRate < 60) {
    healthStatus = 'WARNING';
  }

  const payload = JSON.stringify({
    device_id: DEVICE_ID,
    patient_id: PATIENT_ID,
    temperature: temperature,
    humidity: humidity,
    heart_rate: heartRate,
    health_status: healthStatus
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/telemetry',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] HR: ${heartRate} BPM | Temp: ${temperature}°C | Status: [${healthStatus}] -> HTTP ${res.statusCode} (Disimpan ke RDS)`);
    });
  });

  req.on('error', (err) => {
    console.error(`[Error] Gagal kirim ke backend: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

// Kirim tiap 3 detik
setInterval(sendSimulatedData, 3000);
sendSimulatedData();
