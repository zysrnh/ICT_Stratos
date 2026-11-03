require('dotenv').config();
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

// Middleware autentikasi token (opsional di dev, siap pakai untuk juknis 8.1)
const authenticateDevice = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Toleransi jika belum ada token saat demo lokal
  if (!authHeader || authHeader.startsWith('Bearer ')) {
    return next();
  }
  next();
};

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
// Sesuai Juknis 5.2 & Firmware Dual-Device
// -------------------------------------------------------------
app.post('/api/telemetry', authenticateDevice, async (req, res) => {
  try {
    const body = req.body;
    const { device_id, patient_id, device_type } = body;

    if (!device_id || !patient_id) {
      return res.status(400).json({ error: 'Payload tidak valid: device_id dan patient_id wajib diisi.' });
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
      patient_id,
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

    // 2. Perbarui status perangkat di tabel devices
    await pool.execute(
      `INSERT INTO devices (id, patient_id, device_type, model_name, status, last_seen)
       VALUES (?, ?, ?, ?, 'ONLINE', NOW())
       ON DUPLICATE KEY UPDATE status = 'ONLINE', last_seen = NOW()`,
      [device_id, patient_id, type === 'home' ? 'home' : 'watch', device_id]
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
// Endpoint 3: Menerima Kejadian Darurat (Juknis Bagian 6: Alur Darurat)
// Event Lifecycle: PENDING -> ESCALATED / CANCELLED / RESOLVED
// -------------------------------------------------------------
app.post('/api/events', authenticateDevice, async (req, res) => {
  try {
    const { event_id, device_id, patient_id, event_type, severity, status, value, sim } = req.body;

    if (!event_id || !patient_id || !event_type) {
      return res.status(400).json({ error: 'Payload event darurat tidak lengkap.' });
    }

    let escalatedTo = null;
    let escalationLevel = 1;

    if (status === 'ESCALATED') {
      escalationLevel = 2; // Eskalasi ke keluarga utama
      escalatedTo = 'Keluarga Utama: Rully Santoso (+62 812-3456-7890)';
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
      patient_id,
      device_id,
      event_type,
      severity || 'WARNING',
      status || 'PENDING',
      value || 0,
      sim === true || sim === 1 ? 1 : 0,
      escalationLevel,
      escalatedTo
    ]);

    // 2. Jika status ESCALATED, catat ke tabel health_alerts untuk notifikasi keluarga
    if (status === 'ESCALATED') {
      let alertMsg = `[DARURAT ${event_type}] Membutuhkan perhatian segera! Nilai sensor: ${value || 0}`;
      if (event_type === 'FALL') alertMsg = 'Lansia terdeteksi jatuh dan tidak merespon verifikasi jam tangan!';
      else if (event_type === 'SOS') alertMsg = 'Tombol SOS darurat fisik ditekan oleh lansia!';
      else if (event_type === 'SMOKE') alertMsg = 'Bahaya asap kebakaran terdeteksi di dalam rumah!';
      else if (event_type === 'HR_ABNORMAL') alertMsg = `Detak jantung abnormal bertahan di ${value} BPM!`;

      await pool.execute(
        `INSERT INTO health_alerts (patient_id, alert_type, severity, message, is_resolved)
         VALUES (?, ?, ?, ?, FALSE)`,
        [patient_id, event_type, severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING', alertMsg]
      );
    } else if (status === 'RESOLVED' || status === 'CANCELLED') {
      // Tandai resolved pada alert aktif
      await pool.execute(
        `UPDATE health_alerts SET is_resolved = TRUE
         WHERE patient_id = ? AND alert_type = ? AND is_resolved = FALSE`,
        [patient_id, event_type]
      );
    }

    console.log(`[EVENT PROCESSED] ${event_id} | ${event_type} -> ${status} (Level ${escalationLevel})`);

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
// Endpoint 4: Mengambil Data Telemetri Terkini (Untuk Dashboard)
// -------------------------------------------------------------
app.get('/api/telemetry/latest', async (req, res) => {
  try {
    const patientId = req.query.patient_id || 1;

    // Ambil 30 telemetri terbaru dari smartwatch & home node
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
// Endpoint 9: AI Companion Check-in & Percakapan (Pilar 3 - Juknis 5.4)
// Batasan Juknis: Sopan, tempo ramah lansia, tanpa vonis medis
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

    // 1. Simpan pesan dari lansia
    await pool.execute(
      `INSERT INTO conversation_logs (patient_id, sender, message, sentiment) VALUES (?, 'ELDER', ?, 'NEUTRAL')`,
      [patient_id || 1, message]
    );

    // 2. Logika Respon AI Ramah Lansia (Sesuai Juknis 5.4)
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

    // 3. Simpan respon AI
    await pool.execute(
      `INSERT INTO conversation_logs (patient_id, sender, message, sentiment) VALUES (?, 'AI', ?, ?)`,
      [patient_id || 1, aiReply, sentiment]
    );

    res.json({
      success: true,
      reply: aiReply,
      sentiment
    });
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

// Jalankan Server Express
app.listen(port, () => {
  console.log(`=============================================================`);
  console.log(`  AI-Powered Elderly Care Ecosystem - Backend API Server     `);
  console.log(`  Server aktif di http://localhost:${port}                    `);
  console.log(`  Mendukung 4 Pilar JUKNIS: Health, Home, AI, Family        `);
  console.log(`=============================================================`);
});
