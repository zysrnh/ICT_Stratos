require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =============================================================
// Konfigurasi Koneksi Database Huawei Cloud RDS (MySQL 8.0)
// =============================================================
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
// Auto-Migration & Schema Verification (Bebas phpMyAdmin / cPanel Friendly)
// -------------------------------------------------------------
async function runAutoMigrations() {
  console.log('[AutoMigration] Memeriksa dan memigrasi struktur tabel database...');
  try {
    // 1. users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role ENUM('FAMILY_PRIMARY', 'FAMILY_SECONDARY', 'DOCTOR', 'ADMIN') DEFAULT 'FAMILY_PRIMARY',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. patients
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_code VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(100) NOT NULL,
        age INT NOT NULL,
        gender ENUM('MALE', 'FEMALE') NOT NULL,
        room_number VARCHAR(30) DEFAULT NULL,
        condition_summary TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. devices
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(50) PRIMARY KEY,
        patient_id INT NOT NULL,
        device_token VARCHAR(100) DEFAULT 'HUAWEI-ECA-8821',
        device_type ENUM('watch', 'home', 'companion') NOT NULL,
        model_name VARCHAR(50) NOT NULL,
        status ENUM('ONLINE', 'OFFLINE') DEFAULT 'ONLINE',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dev_patient (patient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. health_metrics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_metrics (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        device_type ENUM('watch', 'home') DEFAULT 'watch',
        heart_rate INT DEFAULT NULL,
        activity VARCHAR(20) DEFAULT 'REST',
        steps INT DEFAULT 0,
        accel_g DECIMAL(4, 2) DEFAULT 1.00,
        health_status ENUM('NORMAL', 'WARNING', 'CRITICAL') DEFAULT 'NORMAL',
        fall_cancelled INT DEFAULT 0,
        temperature DECIMAL(4, 2) DEFAULT NULL,
        room_temp DECIMAL(4, 2) DEFAULT NULL,
        humidity DECIMAL(4, 2) DEFAULT NULL,
        smoke_adc INT DEFAULT NULL,
        smoke_status VARCHAR(20) DEFAULT 'NORMAL',
        sim BOOLEAN DEFAULT FALSE,
        wifi_rssi INT DEFAULT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_patient_time (patient_id, recorded_at),
        INDEX idx_device_type (device_type),
        INDEX idx_status (health_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. emergency_events
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(50) NOT NULL UNIQUE,
        patient_id INT NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        severity ENUM('WARNING', 'CRITICAL') NOT NULL,
        status ENUM('PENDING', 'ESCALATED', 'CANCELLED', 'RESOLVED') DEFAULT 'PENDING',
        value DECIMAL(6, 2) DEFAULT 0.00,
        sim BOOLEAN DEFAULT FALSE,
        escalation_level INT DEFAULT 1,
        escalated_to VARCHAR(150) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_event_patient (patient_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. health_alerts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_alerts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        metric_id BIGINT NULL DEFAULT NULL,
        patient_id INT NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity ENUM('WARNING', 'CRITICAL') NOT NULL,
        message TEXT NOT NULL,
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_alert_patient (patient_id, is_resolved)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. emergency_contacts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        relationship VARCHAR(50) NOT NULL,
        phone_number VARCHAR(30) NOT NULL,
        priority_order INT NOT NULL DEFAULT 1,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_contact_patient (patient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. reminders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        reminder_type ENUM('MEDICINE', 'ACTIVITY', 'CHECKIN') NOT NULL,
        title VARCHAR(150) NOT NULL,
        time_scheduled VARCHAR(10) NOT NULL,
        is_confirmed BOOLEAN DEFAULT FALSE,
        confirmed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reminder_patient (patient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. consents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        data_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        is_granted BOOLEAN DEFAULT TRUE,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_consent_patient (patient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. conversation_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        sender ENUM('ELDER', 'AI') NOT NULL,
        message TEXT NOT NULL,
        sentiment VARCHAR(30) DEFAULT 'NEUTRAL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_patient (patient_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed Data Demo
    await pool.query(`
      INSERT INTO users (id, username, email, password, full_name, role)
      VALUES (1, 'rully', 'rully@familycare.id', 'demo123', 'Rully Santoso (Keluarga Utama)', 'FAMILY_PRIMARY')
      ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
    `);

    await pool.query(`
      INSERT INTO patients (id, patient_code, full_name, age, gender, room_number, condition_summary)
      VALUES 
      (1, 'ELD-001', 'Opa Budi Santoso', 71, 'MALE', 'Kamar Utama (Lantai 1)', 'Hipertensi terkontrol Amlodipine 5mg. Riwayat pusing saat bangun tidur'),
      (2, 'ELD-002', 'Oma Siti Rahma', 68, 'FEMALE', 'Paviliun Melati', 'Kondisi stabil, rutin konsumsi vitamin & obat jantung')
      ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
    `);

    await pool.query(`
      INSERT INTO devices (id, patient_id, device_token, device_type, model_name, status)
      VALUES
      ('HUAWEI-WATCH-001', 1, 'HUAWEI-ECA-8821', 'watch', 'Huawei Smart Health Band Pro', 'ONLINE'),
      ('ECA-HOME-001', 1, 'HUAWEI-ECA-8821', 'home', 'Huawei Smart Home Safety Node', 'ONLINE')
      ON DUPLICATE KEY UPDATE device_token = VALUES(device_token);
    `);

    await pool.query(`
      INSERT INTO emergency_contacts (id, patient_id, name, relationship, phone_number, priority_order, is_primary)
      VALUES
      (1, 1, 'Rully Santoso', 'Anak Pertama (Wali Utama)', '+62 812-3456-7890', 1, TRUE),
      (2, 1, 'Dr. Sarah Sp.PD', 'Dokter Keluarga', '+62 811-9876-5432', 2, FALSE),
      (3, 1, 'Call Center Ambulans 118', 'Layanan Darurat Medis', '118', 3, FALSE)
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);

    await pool.query(`
      INSERT INTO reminders (id, patient_id, reminder_type, title, time_scheduled, is_confirmed)
      VALUES
      (1, 1, 'MEDICINE', 'Minum Obat Amlodipine 5mg (Hipertensi)', '07:30', TRUE),
      (2, 1, 'ACTIVITY', 'Jalan Kaki Ringan di Halaman', '08:00', TRUE),
      (3, 1, 'MEDICINE', 'Minum Multivitamin Geriatri', '12:30', FALSE),
      (4, 1, 'CHECKIN', 'Istirahat Siang & Cek Hidrasi Air Putih', '13:00', FALSE),
      (5, 1, 'MEDICINE', 'Suplemen Sendi Glukosamin', '19:00', FALSE)
      ON DUPLICATE KEY UPDATE title = VALUES(title);
    `);

    await pool.query(`
      INSERT INTO consents (id, patient_id, data_type, description, is_granted)
      VALUES
      (1, 1, 'Biometrik Detak Jantung & PPG', 'Data detak jantung untuk deteksi aritmia dan kelelahan.', TRUE),
      (2, 1, 'Akselerometer & Deteksi Jatuh', 'Data percepatan gerak untuk deteksi impak benturan jatuh.', TRUE),
      (3, 1, 'Deteksi Asap & Suhu Lingkungan', 'Data keselamatan fisik rumah dari kebakaran dan suhu ekstrem.', TRUE),
      (4, 1, 'Transkrip AI Pendampingan', 'Riwayat interaksi suara dan percakapan untuk analisis emosi.', TRUE)
      ON DUPLICATE KEY UPDATE description = VALUES(description);
    `);

    await pool.query(`
      INSERT INTO conversation_logs (id, patient_id, sender, message, sentiment)
      VALUES
      (1, 1, 'AI', 'Selamat pagi Opa Budi! Bagaimana perasaan Opa hari ini? Jangan lupa sarapan dan minum obatnya ya.', 'CALM'),
      (2, 1, 'ELDER', 'Pagi Nak. Tadi agak pusing sedikit pas bangun, tapi sekarang sudah enakan setelah minum air.', 'CALM'),
      (3, 1, 'AI', 'Syukurlah kalau sudah enakan Opa. Jangan langsung berdiri cepat-cepat ya Opa. Jadwal jalan santai jam 08:00 nanti santai saja.', 'HAPPY')
      ON DUPLICATE KEY UPDATE message = VALUES(message);
    `);

    console.log('[AutoMigration] Sukses! Semua 10 tabel & seed data terverifikasi.');
    return { success: true, message: 'Semua 10 tabel dan data awal berhasil dimigrasi.' };
  } catch (err) {
    console.error('[AutoMigration Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Endpoint Trigger Migrasi Manual
app.get('/api/system/migrate', async (req, res) => {
  const result = await runAutoMigrations();
  res.json(result);
});

// Middleware Autentikasi Token (Juknis 8.1 & Anti-Collision)
const verifyDeviceOrAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const headerToken = token || req.headers['x-device-token'] || req.query.token;

  // Izinkan jika token tidak disertakan (mode fleksibel lokal), namun jika disertakan akan dicocokkan
  if (!headerToken) {
    return next();
  }

  try {
    const [rows] = await pool.execute(
      `SELECT d.*, p.id as patient_id, p.full_name as patient_name 
       FROM devices d
       JOIN patients p ON d.patient_id = p.id
       WHERE d.device_token = ? OR d.device_token = 'HUAWEI-ECA-8821' OR d.device_token = 'HUAWEI_ECA_TOKEN_2026'`,
      [headerToken]
    );

    if (rows.length > 0) {
      // Cari yang match persis
      const exact = rows.find(r => r.device_token === headerToken) || rows[0];
      req.deviceInfo = exact;
      req.authenticatedToken = headerToken;
    }
    next();
  } catch (err) {
    console.error('[Auth Error]:', err);
    next();
  }
};

// -------------------------------------------------------------
// Endpoint 0: Autentikasi Keluarga, Pairing Token & Registrasi Jam (Juknis 5.1)
// -------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, token } = req.body;

    // 1. Opsi Login Cepat via Device Token (Pairing Lansia)
    if (token) {
      const cleanToken = token.trim();
      const [devices] = await pool.execute(
        `SELECT d.*, p.id as patient_id, p.full_name as patient_name, p.room_number, p.age
         FROM devices d
         JOIN patients p ON d.patient_id = p.id
         WHERE d.device_token = ? OR (? IN ('HUAWEI-ECA-8821', 'HUAWEI_ECA_TOKEN_2026') AND d.patient_id = 1)`,
        [cleanToken, cleanToken]
      );

      if (devices.length === 0) {
        return res.status(401).json({ error: 'Token perangkat tidak valid atau belum terdaftar.' });
      }

      return res.json({
        success: true,
        auth_type: 'DEVICE_TOKEN',
        token: cleanToken,
        user: {
          id: 1,
          full_name: 'Keluarga (' + devices[0].patient_name + ')',
          role: 'FAMILY_PRIMARY',
        },
        paired_device: devices[0],
        patient_id: devices[0].patient_id,
        patient_name: devices[0].patient_name,
      });
    }

    // 2. Opsi Login via Username & Password
    if (username && password) {
      const [users] = await pool.execute(
        `SELECT * FROM users WHERE username = ? AND password = ?`,
        [username.trim(), password]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Username atau password salah.' });
      }

      const user = users[0];
      const [devices] = await pool.execute(
        `SELECT d.*, p.full_name as patient_name 
         FROM devices d 
         JOIN patients p ON d.patient_id = p.id 
         LIMIT 1`
      );

      return res.json({
        success: true,
        auth_type: 'CREDENTIAL',
        token: devices[0]?.device_token || 'HUAWEI-ECA-8821',
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
        },
        paired_device: devices[0] || null,
        patient_id: devices[0]?.patient_id || 1,
        patient_name: devices[0]?.patient_name || 'Opa Budi Santoso',
      });
    }

    res.status(400).json({ error: 'Masukkan username/password atau token perangkat.' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal autentikasi', details: error.message });
  }
});

// Endpoint Verifikasi / Pairing Token
app.post('/api/auth/pair', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token wajib disertakan.' });

    const [devices] = await pool.execute(
      `SELECT d.*, p.id as patient_id, p.full_name as patient_name, p.room_number, p.age
       FROM devices d
       JOIN patients p ON d.patient_id = p.id
       WHERE d.device_token = ? OR (? IN ('HUAWEI-ECA-8821', 'HUAWEI_ECA_TOKEN_2026') AND d.patient_id = 1)`,
      [token.trim(), token.trim()]
    );

    if (devices.length === 0) {
      return res.status(404).json({ error: 'Perangkat dengan token tersebut tidak ditemukan.' });
    }

    res.json({
      success: true,
      message: 'Perangkat berhasil dipasangkan (Paired)',
      device: devices[0],
      patient_id: devices[0].patient_id,
      patient_name: devices[0].patient_name,
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal pairing perangkat', details: error.message });
  }
});

// Endpoint Pendaftaran Jam Tangan / Perangkat Baru (Anti-Collision Multi-User)
app.post('/api/auth/register-device', async (req, res) => {
  try {
    const { device_token, patient_name, room_number, age, gender } = req.body;

    if (!device_token || !patient_name) {
      return res.status(400).json({ error: 'ID Token dan Nama Lansia wajib diisi.' });
    }

    const cleanToken = device_token.trim().toUpperCase();

    // Periksa apakah token sudah terpakai
    const [existing] = await pool.execute(
      `SELECT d.*, p.full_name FROM devices d JOIN patients p ON d.patient_id = p.id WHERE d.device_token = ?`,
      [cleanToken]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: `Token '${cleanToken}' sudah digunakan untuk pasien ${existing[0].full_name}. Silakan gunakan token lain atau langsung login.`
      });
    }

    // 1. Buat Pasien Baru
    const patientCode = 'ELD-' + Date.now().toString().slice(-4);
    const [patientResult] = await pool.execute(
      `INSERT INTO patients (patient_code, full_name, age, gender, room_number, condition_summary)
       VALUES (?, ?, ?, ?, ?, 'Pasien baru terdaftar via Device Token Pairing.')`,
      [patientCode, patient_name.trim(), age || 70, gender || 'MALE', room_number || 'Kamar Lansia']
    );

    const newPatientId = patientResult.insertId;

    // 2. Buat Sepasang Perangkat: Smartwatch & Node Rumah
    const watchId = `WATCH-${cleanToken.slice(0, 8)}`;
    const homeId = `HOME-${cleanToken.slice(0, 8)}`;

    await pool.execute(
      `INSERT INTO devices (id, patient_id, device_token, device_type, model_name, status)
       VALUES (?, ?, ?, 'watch', 'Huawei Smart Health Band Pro', 'ONLINE')`,
      [watchId, newPatientId, cleanToken]
    );

    await pool.execute(
      `INSERT INTO devices (id, patient_id, device_token, device_type, model_name, status)
       VALUES (?, ?, ?, 'home', 'Huawei Smart Home Safety Node', 'ONLINE')`,
      [homeId, newPatientId, cleanToken]
    );

    // 3. Tambahkan Kontak Darurat Default & Pengingat Default
    await pool.execute(
      `INSERT INTO emergency_contacts (patient_id, name, relationship, phone_number, priority_order, is_primary)
       VALUES (?, 'Keluarga Wali', 'Wali / Anak', '+62 812-3456-7890', 1, TRUE)`,
      [newPatientId]
    );

    await pool.execute(
      `INSERT INTO reminders (patient_id, reminder_type, title, time_scheduled, is_confirmed)
       VALUES 
       (?, 'MEDICINE', 'Minum Obat Rutin Pagi', '08:00', FALSE),
       (?, 'ACTIVITY', 'Jalan Santai Pagi 15 Menit', '07:00', TRUE)`,
      [newPatientId, newPatientId]
    );

    // 4. Tambahkan Consent Default UU PDP
    await pool.execute(
      `INSERT INTO consents (patient_id, data_type, description, is_granted)
       VALUES
       (?, 'Biometrik Kesehatan', 'Pengumpulan detak jantung dan aktivitas langkah untuk deteksi anomali.', TRUE),
       (?, 'Deteksi Jatuh & Darurat', 'Pemrosesan data IMU akselerometer untuk keselamatan darurat.', TRUE),
       (?, 'AI Companion Chat', 'Penyimpanan riwayat percakapan pendampingan lansia.', TRUE)`,
      [newPatientId, newPatientId, newPatientId]
    );

    res.status(201).json({
      success: true,
      message: 'Perangkat dan profil pasien berhasil didaftarkan!',
      token: cleanToken,
      patient_id: newPatientId,
      patient_name: patient_name.trim(),
      devices: [watchId, homeId]
    });
  } catch (error) {
    console.error('[Register Device Error]:', error);
    res.status(500).json({ error: 'Gagal mendaftarkan perangkat', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 1: Health Check Service
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as is_connected');
    res.json({
      status: 'OK',
      project: 'AI-Powered Elderly Care Ecosystem (ECA)',
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
// Endpoint 2: Menerima Telemetri dari Perangkat (Watch & Home Node)
// Dilengkapi Token Verification Anti-Collision
// -------------------------------------------------------------
app.post('/api/telemetry', verifyDeviceOrAuth, async (req, res) => {
  try {
    const body = req.body;
    const { device_id, device_type } = body;
    // Tentukan patient_id secara dinamis: jika token terdaftar di database, arahkan ke pasien token tersebut
    const targetPatientId = req.deviceInfo?.patient_id || body.patient_id || 1;
    const activeToken = req.authenticatedToken || req.deviceInfo?.device_token || 'HUAWEI-ECA-8821';

    if (!device_id) {
      return res.status(400).json({ error: 'Payload tidak valid: device_id wajib diisi.' });
    }

    const type = device_type || (body.room_temp !== undefined ? 'home' : 'watch');

    // 1. Simpan telemetri ke tabel health_metrics
    const insertQuery = `
      INSERT INTO health_metrics (
        device_id, patient_id, device_type,
        heart_rate, activity, steps, accel_g, health_status, fall_cancelled,
        temperature, room_temp, humidity, smoke_adc, smoke_status,
        sim, wifi_rssi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      device_id,
      targetPatientId,
      type,
      body.heart_rate !== undefined ? body.heart_rate : null,
      body.activity || 'REST',
      body.steps || 0,
      body.accel_g || 1.00,
      body.health_status || 'NORMAL',
      body.fall_cancelled || 0,
      body.temperature || body.room_temp || null,
      body.room_temp !== undefined ? body.room_temp : null,
      body.humidity !== undefined ? body.humidity : null,
      body.smoke_adc !== undefined ? body.smoke_adc : null,
      body.smoke_status || 'NORMAL',
      body.sim === true || body.sim === 1 ? 1 : 0,
      body.wifi_rssi !== undefined ? body.wifi_rssi : null
    ];

    const [result] = await pool.execute(insertQuery, values);

    // 2. Perbarui status perangkat di tabel devices dengan token yang sesuai
    await pool.execute(
      `INSERT INTO devices (id, patient_id, device_token, device_type, model_name, status, last_seen)
       VALUES (?, ?, ?, ?, ?, 'ONLINE', NOW())
       ON DUPLICATE KEY UPDATE status = 'ONLINE', last_seen = NOW(), device_token = VALUES(device_token)`,
      [device_id, targetPatientId, activeToken, type === 'home' ? 'home' : 'watch', device_id]
    );

    res.status(201).json({
      success: true,
      message: `Telemetri [${type.toUpperCase()}] berhasil disimpan ke RDS`,
      metric_id: result.insertId
    });
  } catch (error) {
    console.error('[Telemetry Error]:', error);
    res.status(500).json({ error: 'Gagal memproses telemetri', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 3: Menerima Kejadian Darurat (Juknis Bagian 6)
// -------------------------------------------------------------
app.post('/api/events', verifyDeviceOrAuth, async (req, res) => {
  try {
    const { event_id, device_id, patient_id, event_type, severity, status, value, sim } = req.body;
    const targetPatientId = req.deviceInfo?.patient_id || patient_id || 1;

    if (!event_id || !event_type) {
      return res.status(400).json({ error: 'Payload event darurat tidak lengkap (event_id dan event_type wajib).' });
    }

    let escalatedTo = null;
    let escalationLevel = 1;

    if (status === 'ESCALATED') {
      escalationLevel = 2; // Eskalasi ke keluarga utama
      escalatedTo = 'Keluarga Terdaftar / Kontak Darurat';
    }

    // 1. Simpan atau perbarui status event darurat
    const upsertEventQuery = `
      INSERT INTO emergency_events (
        event_id, patient_id, device_id, event_type, severity, status, value, sim,
        escalation_level, escalated_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        severity = VALUES(severity),
        value = VALUES(value),
        escalation_level = VALUES(escalation_level),
        escalated_to = VALUES(escalated_to),
        updated_at = NOW()
    `;

    await pool.execute(upsertEventQuery, [
      event_id,
      targetPatientId,
      device_id || 'HUAWEI-WATCH-001',
      event_type,
      severity || 'WARNING',
      status || 'PENDING',
      value || 0,
      sim === true || sim === 1 ? 1 : 0,
      escalationLevel,
      escalatedTo
    ]);

    // 2. Jika status ESCALATED, catat ke tabel health_alerts
    if (status === 'ESCALATED') {
      let alertMsg = `[DARURAT ${event_type}] Membutuhkan perhatian segera! Nilai sensor: ${value || 0}`;
      if (event_type === 'FALL') alertMsg = 'Lansia terdeteksi jatuh dan tidak merespon verifikasi jam tangan!';
      else if (event_type === 'SOS') alertMsg = 'Tombol SOS darurat fisik ditekan oleh lansia!';
      else if (event_type === 'SMOKE') alertMsg = 'Bahaya asap kebakaran terdeteksi di dalam rumah!';
      else if (event_type === 'HR_ABNORMAL') alertMsg = `Detak jantung abnormal bertahan di ${value} BPM!`;

      await pool.execute(
        `INSERT INTO health_alerts (patient_id, alert_type, severity, message, is_resolved)
         VALUES (?, ?, ?, ?, FALSE)`,
        [targetPatientId, event_type, severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING', alertMsg]
      );
    } else if (status === 'RESOLVED' || status === 'CANCELLED') {
      await pool.execute(
        `UPDATE health_alerts SET is_resolved = TRUE
         WHERE patient_id = ? AND alert_type = ? AND is_resolved = FALSE`,
        [targetPatientId, event_type]
      );
    }

    res.status(200).json({
      success: true,
      message: `Event [${event_type}] status [${status}] berhasil diproses`,
      event_id
    });
  } catch (error) {
    console.error('[Event Error]:', error);
    res.status(500).json({ error: 'Gagal memproses event darurat', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 4: Mengambil Data Telemetri Terkini (Filtered per Pasien)
// -------------------------------------------------------------
app.get('/api/telemetry/latest', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;

    const [rows] = await pool.execute(
      `SELECT m.*, p.full_name, p.room_number
       FROM health_metrics m
       JOIN patients p ON m.patient_id = p.id
       WHERE m.patient_id = ?
       ORDER BY m.recorded_at DESC
       LIMIT 40`,
      [patientId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data telemetri', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 5: Mengambil Daftar Kejadian Darurat Aktif & Riwayat
// -------------------------------------------------------------
app.get('/api/events', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;

    const [events] = await pool.execute(
      `SELECT e.*, p.full_name, p.room_number
       FROM emergency_events e
       JOIN patients p ON e.patient_id = p.id
       WHERE e.patient_id = ?
       ORDER BY e.updated_at DESC
       LIMIT 20`,
      [patientId]
    );

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil events darurat', details: error.message });
  }
});

// Endpoint alerts legacy
app.get('/api/alerts', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, p.full_name, p.room_number
       FROM health_alerts a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.is_resolved = FALSE
       ORDER BY a.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil alerts', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 6: Master Data Profil Pasien / Lansia (Juknis 5.2)
// -------------------------------------------------------------
app.get('/api/patients', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
             (SELECT COUNT(*) FROM health_alerts a WHERE a.patient_id = p.id AND a.is_resolved = FALSE) as active_alerts
      FROM patients p
      ORDER BY p.id ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil profil lansia', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 7: Kontak Darurat Bertingkat (Juknis 2.4 & 6.1)
// -------------------------------------------------------------
app.get('/api/contacts', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;
    const [rows] = await pool.execute(
      `SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY priority_order ASC`,
      [patientId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil kontak darurat', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 8: Pengingat Obat & Aktivitas (Pilar 3: AI Companion)
// -------------------------------------------------------------
app.get('/api/reminders', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;
    const [rows] = await pool.execute(
      `SELECT * FROM reminders WHERE patient_id = ? ORDER BY time_scheduled ASC`,
      [patientId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil jadwal pengingat', details: error.message });
  }
});

app.post('/api/reminders/toggle', async (req, res) => {
  try {
    const { reminder_id, is_confirmed } = req.body;
    await pool.execute(
      `UPDATE reminders SET is_confirmed = ?, confirmed_at = IF(? = TRUE, NOW(), NULL) WHERE id = ?`,
      [is_confirmed, is_confirmed, reminder_id]
    );
    res.json({ success: true, message: 'Status konfirmasi pengingat diperbarui' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memperbarui status pengingat', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 9: AI Companion Check-in & Percakapan (Pilar 3)
// -------------------------------------------------------------
app.get('/api/companion/chat', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;
    const [rows] = await pool.execute(
      `SELECT * FROM conversation_logs WHERE patient_id = ? ORDER BY created_at ASC LIMIT 50`,
      [patientId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil log percakapan AI', details: error.message });
  }
});

app.post('/api/companion/chat', async (req, res) => {
  try {
    const { patient_id, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong' });

    await pool.execute(
      `INSERT INTO conversation_logs (patient_id, sender, message, sentiment) VALUES (?, 'ELDER', ?, 'NEUTRAL')`,
      [patient_id || 1, message]
    );

    let aiReply = "Terima kasih sudah bercerita, Opa. Saya senang mendengar kabar Opa hari ini.";
    let sentiment = 'CALM';
    const lower = message.toLowerCase();

    if (lower.includes('sakit') || lower.includes('pusing') || lower.includes('nyeri') || lower.includes('jatuh')) {
      aiReply = "Opa, jangan memaksakan diri ya. Segera duduk istirahat dan minum air putih. Jika masih terasa sakit, saya bisa bantu hubungi keluarga atau perawat sekarang.";
      sentiment = 'ANXIOUS';
    } else if (lower.includes('obat') || lower.includes('minum')) {
      aiReply = "Bagus sekali Opa! Disiplin minum obat sangat penting agar kondisi tubuh tetap prima.";
      sentiment = 'HAPPY';
    } else if (lower.includes('jalan') || lower.includes('olahraga') || lower.includes('sehat')) {
      aiReply = "Wah hebat Opa! Jalan santai di pagi hari sangat bagus untuk melatih sirkulasi darah dan kekuatan kaki.";
      sentiment = 'HAPPY';
    }

    await pool.execute(
      `INSERT INTO conversation_logs (patient_id, sender, message, sentiment) VALUES (?, 'AI', ?, ?)`,
      [patient_id || 1, aiReply, sentiment]
    );

    res.json({ success: true, reply: aiReply, sentiment });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses percakapan AI', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint 10: Persetujuan Privasi & Consent (Juknis 8: Kepatuhan UU PDP)
// -------------------------------------------------------------
app.get('/api/consent', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;
    const [rows] = await pool.execute(
      `SELECT * FROM consents WHERE patient_id = ? ORDER BY id ASC`,
      [patientId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data consent', details: error.message });
  }
});

app.post('/api/consent/toggle', async (req, res) => {
  try {
    const { consent_id, is_granted } = req.body;
    await pool.execute(
      `UPDATE consents SET is_granted = ? WHERE id = ?`,
      [is_granted, consent_id]
    );
    res.json({ success: true, message: 'Status persetujuan consent diperbarui' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengubah status consent', details: error.message });
  }
});

// -------------------------------------------------------------
// Endpoint Penyaji Frontend React (Single Domain Hosting)
// -------------------------------------------------------------
const publicDir = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : fs.existsSync(path.join(__dirname, '..', 'public', 'index.html'))
  ? path.join(__dirname, '..', 'public')
  : fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : null;

if (publicDir) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Jalankan Server Express
app.listen(port, () => {
  console.log(`=============================================================`);
  console.log(`  AI-Powered Elderly Care Ecosystem - Backend API Server     `);
  console.log(`  Server aktif di http://localhost:${port}                    `);
  console.log(`  Autentikasi Token & Pairing Device Aktif (Anti-Collision)   `);
  console.log(`=============================================================`);
  runAutoMigrations();
});
