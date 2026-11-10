# Strategi Implementasi Dual-Proof: Wokwi + Huawei Cloud IoTDA
### Solusi Pemantauan Kesehatan Lansia — ELDERA (Tim Stratos - LPKIA)
### 11th Huawei ICT Competition (Innovation Track)

---

## 1. Ringkasan Eksekutif & Tujuan

Tujuan dari dokumen ini adalah merancang panduan implementasi **Strategi Dual-Proof** untuk mendemonstrasikan sistem **ELDERA** di hadapan dewan juri kompetisi nasional Huawei ICT Competition.

### Mengapa Menggunakan Pendekatan Dual-Proof?
1. **Tingkat Hardware / Sirkuit (Wokwi Simulator):**
   * Membuktikan bahwa kode embedded C++ (FreeRTOS di ESP32, sensor MPU-6050 6-axis, sensor suhu DHT22, buzzer alarm, dan rendering dinamis QR Code pada layar OLED I2C) **100% nyata, dapat dikompilasi, dan teruji secara logika sirkuit**.
2. **Tingkat Cloud & Protokol Resmi (Huawei Cloud IoTDA):**
   * Membuktikan bahwa sistem terintegrasi secara **native** dengan layanan resmi **Huawei Cloud IoT Device Access (IoTDA)** menggunakan standar industri protokol **MQTT**, manajemen profil produk (*Product Model*), dan aturan *Data Forwarding / Rule Engine* resmi Huawei.

> **Prinsip Utama Tahap Ini:** Dokumen ini **hanya berupa cetak biru (*blueprint*) dan panduan operasional**. Tidak ada file kode (`firmware/`, `backend/`, `frontend/`, `database/`) yang dimodifikasi sampai panduan ini disetujui.

---

## 2. Arsitektur Alur Data (Dual-Proof Pipeline)

Sistem ELDERA mengadopsi alur data 4-tahap yang mengintegrasikan kanal pengujian sirkuit (Wokwi) dan kanal telemetri cloud resmi (Huawei Cloud IoTDA) secara terstruktur tanpa hambatan:

### Tahap 1: Ingestion & Device Layer (Kanal Ganda)
* **Kanal A — Verifikasi Sirkuit Mikrokontroler (Wokwi):**
  ESP32 mengirimkan data pembacaan sensor fisik/virtual (akselerometer MPU-6050, potensiometer detak jantung, sensor suhu/kelembaban DHT22) langsung melalui protokol HTTPS POST JSON ke endpoint `/api/telemetry` di backend server.
* **Kanal B — Verifikasi Platform Cloud Resmi (Huawei Cloud IoTDA):**
  Perangkat virtual di konsol resmi Huawei Cloud IoTDA mempublikasikan data telemetri biometrik dan keamanan rumah menggunakan protokol MQTT standar industri ke broker cloud Huawei.

### Tahap 2: Gateway & Rule Forwarding Layer (Huawei Cloud Platform)
* Konsol Huawei Cloud IoTDA memvalidasi identitas node perangkat dan menjalankan aturan **Data Forwarding (Rule Engine)**.
* Pesan telemetri secara otomatis diteruskan melalui HTTP Push (Webhook) ke adapter backend `/api/iotda/telemetry` yang berjalan di instance Huawei Cloud ECS.

### Tahap 3: Cloud Intelligence & Storage Layer
* Backend Express.js memvalidasi payload dan menyimpannya secara persisten ke **Huawei Cloud RDS (MySQL 8.0)** pada tabel `health_metrics`.
* Mesin evaluasi aturan (*Rule Engine*) memeriksa indikator bahaya (detak jantung < 50 atau > 120 BPM, lonjakan benturan > 2.5G, atau asap/gas > 400 ADC).
* Jika kondisi kritis terdeteksi, status darurat diaktifkan bersama jendela verifikasi mandiri 30 detik untuk menekan alarm palsu (*false alarm mitigation*).

### Tahap 4: Presentation & Action Layer
* Dashboard keluarga (*Family Caregiver Dashboard*) berbasis React 19 menyajikan grafik biometrik secara langsung (*real-time*).
* Menampilkan banner peringatan darurat dengan tombol aksi cepat (Panggilan Telepon / WhatsApp keluarga) serta pencatatan izin privasi sesuai UU PDP No. 27/2022.

---

## 3. Spesifikasi Profil Produk (*Product Model*) Huawei Cloud IoTDA

Saat membuat produk di konsol **Huawei Cloud IoTDA**, struktur properti yang akan didaftarkan mencakup parameter fisiologis dan lingkungan berikut:

### Metadata Produk:
* **Product Name:** `ELDERA_Elderly_Care_Node`
* **Protocol:** `MQTT`
* **Data Format:** `JSON`
* **Industry:** `Smart Healthcare`
* **Device Type:** `Wearable_and_Ambient_Station`

### Service 1: `ElderlyBiometrics` (Data Smartwatch)
| Property Name | Data Type | Range / Options | Satuan | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `heart_rate` | `int` | 30 - 220 | BPM | Detak jantung waktu nyata |
| `accel_g` | `decimal` | 0.00 - 5.00 | G | Resultan akselerasi MPU-6050 |
| `health_status` | `string` | NORMAL, WARNING, CRITICAL | - | Status Early Warning Score |
| `steps` | `int` | 0 - 50000 | steps | Pedometer harian lansia |
| `fall_event` | `int` | 0 (No), 1 (Fall Detected) | - | Indikator lonjakan benturan jatuh |

### Service 2: `HomeSafety` (Data Stasiun Keamanan Rumah)
| Property Name | Data Type | Range / Options | Satuan | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| `room_temp` | `decimal` | -10.0 - 60.0 | °C | Suhu ruangan lansia |
| `humidity` | `decimal` | 10.0 - 99.0 | % | Kelembaban udara |
| `smoke_adc` | `int` | 0 - 1024 | ADC | Sensor gas & asap MQ-2 |
| `smoke_status` | `string` | NORMAL, ALERT | - | Status bahaya gas/asap |

### Contoh Format Payload Telemetri Resmi IoTDA:
```json
{
  "services": [
    {
      "service_id": "ElderlyBiometrics",
      "properties": {
        "heart_rate": 78,
        "accel_g": 1.02,
        "health_status": "NORMAL",
        "steps": 2450,
        "fall_event": 0
      },
      "event_time": "20261110T093000Z"
    },
    {
      "service_id": "HomeSafety",
      "properties": {
        "room_temp": 26.5,
        "humidity": 62.0,
        "smoke_adc": 85,
        "smoke_status": "NORMAL"
      },
      "event_time": "20261110T093000Z"
    }
  ]
}
```

---

## 4. Panduan Langkah demi Langkah di Konsol Huawei Cloud IoTDA

### Langkah 1: Aktivasi Layanan IoTDA
1. Masuk ke [Huawei Cloud Console](https://console.huaweicloud.com/).
2. Pada bilah pencarian layanan (*Service List*), ketik **IoTDA** (atau **IoT Device Access**).
3. Pilih Region operasional yang aktif (misal: `AP-Singapore` atau `AP-Jakarta` sesuai akun tim).

### Langkah 2: Membuat Produk (*Create Product*)
1. Pada menu navigasi sebelah kiri, pilih **Products** -> klik **Create Product**.
2. Masukkan parameter:
   * **Product Name:** `ELDERA_Elderly_Care_Node`
   * **Protocol Type:** `MQTT`
   * **Data Format:** `JSON`
3. Klik tab **Product Definition / Model Definition** -> tambahkan Service `ElderlyBiometrics` dan `HomeSafety` dengan properti pada Bab 3 di atas.

### Langkah 3: Mendaftarkan Virtual Device
1. Pada menu navigasi kiri, pilih **Devices** -> **All Devices** -> klik **Individual Register**.
2. Masukkan parameter:
   * **Product:** Pilih `ELDERA_Elderly_Care_Node`
   * **Device Identifier (Node ID):** `ELDERA-WATCH-DEMO-01`
   * **Device Name:** `Smartwatch Opa Budi`
3. Setelah terdaftar, sistem akan memberikan kredensial (Device ID & Secret).

### Langkah 4: Menjalankan *Online Device Simulator* (Tanpa Hardware Fisik)
1. Klik nama perangkat `Smartwatch Opa Budi` di daftar perangkat.
2. Buka tab **Online Debugging** / **Simulator**.
3. Di layar ini, Huawei Cloud menyediakan panel visual:
   * Masukkan nilai `heart_rate` = `138` (Simulasi aritmia darurat).
   * Klik tombol **Report Data**.
4. Log di layar Huawei Cloud akan langsung menampilkan status *Reported Successfully*.

### Langkah 5: Menyiapkan Aturan *Data Forwarding* (Rule Engine)
1. Pada menu navigasi kiri, pilih **Rules** -> **Data Forwarding** -> klik **Create Rule**.
2. **Rule Name:** `ForwardToElderaBackend`
3. **Data Source:** `Device Data Reported` dari produk `ELDERA_Elderly_Care_Node`.
4. **Action:** Pilih **HTTP Push** -> masukkan endpoint webhook backend server ELDERA.

---

## 5. Rencana Penyesuaian Program (Untuk Tahap Berikutnya)

Ketika tim memutuskan untuk mengaktifkan integrasi kode, berikut adalah perubahan terisolasi yang akan dilakukan **tanpa merusak kode yang sudah ada**:

1. **Backend (`backend/server.js`):**
   * Menambahkan satu rute adapter baru: `POST /api/iotda/telemetry`.
   * Adapter ini bertugas memetakan format payload Huawei Cloud IoTDA (`services[].properties`) ke kolom tabel `health_metrics` yang sudah ada di database MySQL.
   * Endpoint lama `/api/telemetry` **tetap dipertahankan 100%** untuk menerima data dari Wokwi.
2. **Firmware (`firmware/`):**
   * Tidak ada kode yang diubah. Sirkuit Wokwi tetap berjalan sebagaimana mestinya sebagai bukti hardware level rendah.
3. **Frontend (`frontend/`):**
   * Tidak ada perubahan UI yang merusak; dashboard tetap mengambil data dari tabel MySQL yang sama.

---

## 6. Skenario Demonstrasi saat Live Judging di Depan Juri

| Skenario | Alat Uji yang Ditampilkan | Aksi yang Dilakukan | Hasil yang Diharapkan |
| :--- | :--- | :--- | :--- |
| **Skenario 1: Verifikasi Sirkuit C++** | Wokwi Simulator | Memutar tuas potensiometer BPM, mengamati animasi OLED I2C dan lampu LED hijau | Membuktikan kode mikrokontroler valid, non-blocking FreeRTOS berjalan |
| **Skenario 2: Anomali Jantung via Huawei Cloud IoTDA** | Huawei Cloud IoTDA Console | Mengirim `heart_rate` = 135 BPM via Online Simulator | Pesan MQTT diterima IoTDA, diteruskan ke backend, banner merah muncul di Caregiver Dashboard |
| **Skenario 3: Deteksi Jatuh & Intervensi Suara** | Wokwi + Dashboard | Mengubah akselerasi MPU-6050 > 2.5G | Buzzer lokal berbunyi, AI companion memulai window konfirmasi 30 detik untuk menekan *false alarm* |
| **Skenario 4: Kepatuhan Regulasi Privasi** | Caregiver Dashboard | Membuka tab Consent Management | Menunjukkan transparansi izin data lansia sesuai UU No. 27/2022 (UU PDP) |

---

## 7. Rekomendasi Pembaruan Teks Dokumen Word (`Stratos team LPKIA.docx`)

Setelah rancangan ini disetujui, teks pada baris **Entry Demonstration** di formulir Word akan diperbarui dengan rumusan berikut:

> **Dual-Layer Verification Architecture:**  
> ELDERA provides a comprehensive dual-layer verification architecture combining low-level hardware circuit simulation with enterprise cloud IoT orchestration:
> 
> 1. **Hardware Circuit & Firmware Simulation (Wokwi Virtual Lab):**  
>    Demonstrates compiled ESP32 C++ firmware execution, I2C SSD1306 OLED dynamic QR token rendering, MPU-6050 6-axis interrupt sampling, and local audio-visual alarm peripherals.
> 
> 2. **Native Huawei Cloud IoTDA Ingestion (Huawei Cloud Online Device Simulator):**  
>    Demonstrates official Huawei Cloud IoT Device Access (IoTDA) integration using standard MQTT telemetry reporting, custom Product Model schemas (`ElderlyBiometrics` and `HomeSafety`), and automated Data Forwarding rule engines routing critical emergency events to Huawei Cloud RDS.

---
*Dokumen ini disusun sebagai panduan teknis internal tim Stratos sebelum eksekusi kode dilakukan.*

