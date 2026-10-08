const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function initDatabase() {
  console.log('[DB Init] Menghubungkan ke MySQL Laragon (127.0.0.1:3306)...');
  
  // Koneksi awal tanpa database spesifik untuk membuat database jika belum ada
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  console.log('[DB Init] Terhubung ke MySQL server!');

  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[DB Init] Menjalankan schema.sql...');
  await connection.query(schemaSql);
  console.log('[DB Init] Sukses! Database `huawei_health_iot` dan tabel-tabel berhasil dibuat.');

  // Verifikasi tabel
  const [tables] = await connection.query('SHOW TABLES FROM `huawei_health_iot`');
  console.log('[DB Init] Daftar tabel:', tables.map(r => Object.values(r)[0]));

  await connection.end();
}

initDatabase().catch(err => {
  console.error('[DB Init Error]:', err.message);
  process.exit(1);
});
