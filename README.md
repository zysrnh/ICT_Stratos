# IoT Smart Health Telemetry & Anomaly Monitoring
### Huawei ICT Competition 2026-2027 — Innovation Track

Proyek monitoring kesehatan cerdas berbasis IoT (ESP32) dan Cloud Database (**Huawei Cloud RDS - MySQL**) untuk mendeteksi anomali suhu tubuh dan detak jantung pasien secara real-time.

---

## 📁 Struktur Direktori
```
d:/ITC Huawei/
├── firmware/
│   ├── sketch.ino          # Firmware Arduino C++ ESP32
│   ├── diagram.json        # Desain sirkuit & wiring Wokwi simulator
│   └── libraries.txt       # Library Arduino yang dibutuhkan di Wokwi
├── database/
│   └── schema.sql          # DDL Skema MySQL untuk Huawei Cloud RDS
├── backend/
│   ├── server.js           # REST API Express jembatan Wokwi -> RDS
│   ├── package.json        # Dependencies Node.js
│   └── .env.example        # Template konfigurasi koneksi RDS
└── README.md
```

---

## ⚡ 1. Menjalankan Simulasi di Wokwi

1. Buka [https://wokwi.com](https://wokwi.com) dan pilih **ESP32**.
2. Buka tab **diagram.json**, hapus isinya lalu copas isi dari file `firmware/diagram.json`.
3. Buka tab **sketch.ino**, copas isi dari file `firmware/sketch.ino`.
4. Tambahkan file **libraries.txt** di Wokwi jika belum ada, isi dengan:
   ```
   DHT sensor library
   Adafruit Unified Sensor
   ArduinoJson
   ```
5. Tekan tombol **Play / Start Simulation**.
6. **Interaksi Sensor:**
   - Klik sensor **DHT22** untuk menaikkan/menurunkan suhu dan kelembaban.
   - Putar tuas **Potensiometer** untuk mensimulasikan perubahan detak jantung (BPM).
   - LED Hijau akan menyala jika status `NORMAL`.
   - LED Merah akan menyala jika status `WARNING` atau `CRITICAL` (anomali detak jantung/suhu).

---

## 🗄️ 2. Setup Database Huawei Cloud RDS

1. Buka konsol **Huawei Cloud RDS** dan buat instance MySQL 8.0.
2. Buat database atau jalankan skrip `database/schema.sql` melalui client database (DBeaver, MySQL Workbench, atau Data Admin Service Huawei Cloud).
3. Tabel yang dibuat:
   - `patients`: Data identitas pasien / ruangan.
   - `health_metrics`: Log telemetri real-time dari ESP32.
   - `health_alerts`: Catatan alert anomali otomatis.

---

## 🚀 3. Menjalankan Backend API

1. Masuk ke folder backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```
2. Sesuaikan file `.env` dengan kredensial Huawei Cloud RDS kamu.
3. Jalankan server:
   ```bash
   npm start
   ```
4. Endpoint yang tersedia:
   - `POST /api/telemetry` : Menerima data sensor dari ESP32 dan simpan ke RDS.
   - `GET /api/telemetry/latest?patient_id=1` : Mengambil 20 data telemetri terbaru.
   - `GET /api/alerts` : Mengambil daftar alert aktif belum selesai.
   - `GET /api/health` : Cek koneksi backend ke database RDS.
