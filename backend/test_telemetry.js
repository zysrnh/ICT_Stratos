const mysql = require('mysql2/promise');
require('dotenv').config();

async function testQuery() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'huawei_health_iot'
  });

  console.log('[Test] Menguji insert telemetri dummy...');
  const [insert] = await pool.execute(
    'INSERT INTO health_metrics (patient_id, device_id, temperature, humidity, heart_rate, health_status) VALUES (?, ?, ?, ?, ?, ?)',
    [1, 'DEV-ESP32-001', 36.8, 65.0, 78, 'NORMAL']
  );
  console.log('[Test] Data berhasil disimpan! Metric ID:', insert.insertId);

  const [rows] = await pool.query('SELECT * FROM health_metrics ORDER BY id DESC LIMIT 1');
  console.log('[Test] Data di tabel health_metrics:', rows[0]);

  await pool.end();
}

testQuery().catch(console.error);
