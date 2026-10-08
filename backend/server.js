require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Konfigurasi Koneksi Database Huawei Cloud RDS (MySQL)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'huawei_health_iot',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// -------------------------------------------------------------
// Endpoint 1: Health Check Service
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as is_connected');
    res.json({
      status: 'OK',
      message: 'Backend API & Huawei Cloud RDS terhubung normal',
      db: rows[0].is_connected === 1 ? 'CONNECTED' : 'DISCONNECTED'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Gagal terhubung ke database RDS',
      error: error.message
    });
  }
});

// -------------------------------------------------------------
// Endpoint 2: Menerima Telemetri dari ESP32 (Wokwi)
// -------------------------------------------------------------
app.post('/api/telemetry', async (req, res) => {
  try {
    const { device_id, patient_id, temperature, humidity, heart_rate, health_status } = req.body;

    if (!device_id || !patient_id || temperature === undefined || heart_rate === undefined) {
      return res.status(400).json({ error: 'Payload tidak lengkap.' });
    }

    // Simpan data telemetri ke RDS
    const insertMetricQuery = `
      INSERT INTO health_metrics (device_id, patient_id, temperature, humidity, heart_rate, health_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(insertMetricQuery, [
      device_id,
      patient_id,
      temperature,
      humidity || null,
      heart_rate,
      health_status || 'NORMAL'
    ]);

    const metricId = result.insertId;

    // Trigger Otomatis Alert jika terdeteksi anomali
    if (health_status === 'WARNING' || health_status === 'CRITICAL') {
      let alertType = 'ANOMALY_DETECTED';
      let message = `Anomali terdeteksi: Suhu ${temperature}°C, Detak Jantung ${heart_rate} BPM`;

      if (heart_rate > 100) alertType = 'TACHYCARDIA';
      else if (heart_rate < 60) alertType = 'BRADYCARDIA';
      else if (temperature > 37.5) alertType = 'HYPERTHERMIA';

      const insertAlertQuery = `
        INSERT INTO health_alerts (metric_id, patient_id, alert_type, severity, message)
        VALUES (?, ?, ?, ?, ?)
      `;
      await pool.execute(insertAlertQuery, [
        metricId,
        patient_id,
        alertType,
        health_status,
        message
      ]);
    }

    console.log(`[Telemetry Saved] Pasien #${patient_id} | Suhu: ${temperature}°C | HR: ${heart_rate} BPM | Status: ${health_status}`);

    res.status(201).json({
      success: true,
      message: 'Telemetri berhasil disimpan ke Huawei Cloud RDS',
      metric_id: metricId
    });
  } catch (error) {
    console.error('[Error Simpan Telemetri]:', error);
    res.status(500).json({ error: 'Gagal menyimpan telemetri', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 3: Ambil Data Telemetri Terbaru (untuk Dashboard Demo)
// -------------------------------------------------------------
app.get('/api/telemetry/latest', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;
    const query = `
      SELECT m.*, p.full_name, p.room_number
      FROM health_metrics m
      JOIN patients p ON m.patient_id = p.id
      WHERE m.patient_id = ?
      ORDER BY m.recorded_at DESC
      LIMIT 20
    `;
    const [rows] = await pool.query(query, [patientId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 4: Ambil Alert Aktif (untuk Visual Alert Demo)
// -------------------------------------------------------------
app.get('/api/alerts', async (req, res) => {
  try {
    const query = `
      SELECT a.*, p.full_name, p.room_number
      FROM health_alerts a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.is_resolved = FALSE
      ORDER BY a.created_at DESC
      LIMIT 10
    `;
    const [rows] = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 5: Ambil Daftar Master Pasien (untuk Switcher Pasien)
// -------------------------------------------------------------
app.get('/api/patients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API berjalan di http://localhost:${port}`);
  console.log(`Target database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
});
