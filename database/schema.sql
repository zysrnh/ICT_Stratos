-- =====================================================================
-- Database Schema: Huawei Cloud RDS (MySQL 8.0)
-- Project: AI-Powered Elderly Care Ecosystem (ECA)
-- Track: Huawei ICT Competition - Innovation Track
-- Sesuai Dokumen JUKNIS Versi 1.0 (4 Pilar Produk + Autentikasi Token)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `huawei_health_iot`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `huawei_health_iot`;

-- ---------------------------------------------------------------------
-- 1. Tabel Akun Pengguna / Keluarga (Juknis 5.1 & 8.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `role` ENUM('FAMILY_PRIMARY', 'FAMILY_SECONDARY', 'DOCTOR', 'ADMIN') DEFAULT 'FAMILY_PRIMARY',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. Tabel Profil Lansia / Pasien (Master Data - Juknis 5.2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_code` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Kode unik rekam lansia (misal: ELD-001)',
    `full_name` VARCHAR(100) NOT NULL,
    `age` INT NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `room_number` VARCHAR(30) DEFAULT NULL,
    `condition_summary` TEXT DEFAULT NULL COMMENT 'Kondisi umum / riwayat penyakit',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Tabel Perangkat Terdaftar & Token Pairing (Device Token Security)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `devices` (
    `id` VARCHAR(50) PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `device_token` VARCHAR(100) DEFAULT 'HUAWEI-ECA-8821' COMMENT 'Token otentikasi unik perangkat',
    `device_type` ENUM('watch', 'home', 'companion') NOT NULL,
    `model_name` VARCHAR(50) NOT NULL,
    `status` ENUM('ONLINE', 'OFFLINE') DEFAULT 'ONLINE',
    `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_device_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. Tabel Telemetri Sensor Deret Waktu (Dual-Device: Watch & Home)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `health_metrics` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `device_id` VARCHAR(50) NOT NULL,
    `device_type` ENUM('watch', 'home') DEFAULT 'watch',
    
    -- Metrik Smartwatch Lansia (Pilar 1: Health Monitoring)
    `heart_rate` INT DEFAULT NULL COMMENT 'Detak jantung (BPM)',
    `activity` VARCHAR(20) DEFAULT 'REST' COMMENT 'ACTIVE / REST',
    `steps` INT DEFAULT 0 COMMENT 'Jumlah langkah kaki (pedometer)',
    `accel_g` DECIMAL(4, 2) DEFAULT 1.00 COMMENT 'G-force akselerasi MPU6050',
    `health_status` ENUM('NORMAL', 'WARNING', 'CRITICAL') DEFAULT 'NORMAL',
    `fall_cancelled` INT DEFAULT 0 COMMENT 'Jumlah alarm dibatalkan lansia',
    
    -- Metrik Home Safety Node (Pilar 2: Home Safety)
    `temperature` DECIMAL(4, 2) DEFAULT NULL COMMENT 'Suhu tubuh / legacy',
    `room_temp` DECIMAL(4, 2) DEFAULT NULL COMMENT 'Suhu ruangan (°C)',
    `humidity` DECIMAL(4, 2) DEFAULT NULL COMMENT 'Kelembaban ruangan (%)',
    `smoke_adc` INT DEFAULT NULL COMMENT 'Nilai analog gas MQ-2',
    `smoke_status` VARCHAR(20) DEFAULT 'NORMAL' COMMENT 'NORMAL / ALERT',
    
    -- Metadata Jaringan & Simulasi (Juknis 3.1 & 7)
    `sim` BOOLEAN DEFAULT FALSE COMMENT 'Penanda data tiruan / simulasi jujur',
    `wifi_rssi` INT DEFAULT NULL,
    `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_patient_time` (`patient_id`, `recorded_at`),
    INDEX `idx_device_type` (`device_type`),
    INDEX `idx_status` (`health_status`),
    CONSTRAINT `fk_metrics_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. Tabel Kejadian Darurat & Siklus Eskalasi (Juknis Bagian 6)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `emergency_events` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_id` VARCHAR(50) NOT NULL UNIQUE,
    `patient_id` INT NOT NULL,
    `device_id` VARCHAR(50) NOT NULL,
    `event_type` VARCHAR(50) NOT NULL COMMENT 'FALL, HR_ABNORMAL, SOS, SMOKE',
    `severity` ENUM('WARNING', 'CRITICAL') NOT NULL,
    `status` ENUM('PENDING', 'ESCALATED', 'CANCELLED', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    `value` DECIMAL(6, 2) DEFAULT 0,
    `sim` BOOLEAN DEFAULT FALSE,
    `escalation_level` INT DEFAULT 1 COMMENT '1: Lansia/Wearable, 2: Keluarga Utama, 3: Kontak Sekunder, 4: RS/Ambulans',
    `escalated_to` VARCHAR(100) DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_patient_event` (`patient_id`, `created_at`),
    INDEX `idx_status` (`status`),
    INDEX `idx_type` (`event_type`),
    CONSTRAINT `fk_event_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel Legacy Health Alerts (kompatibilitas)
CREATE TABLE IF NOT EXISTS `health_alerts` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `metric_id` BIGINT DEFAULT NULL,
    `patient_id` INT NOT NULL,
    `alert_type` VARCHAR(50) NOT NULL,
    `severity` ENUM('WARNING', 'CRITICAL') NOT NULL,
    `message` TEXT NOT NULL,
    `is_resolved` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_patient_alert` (`patient_id`, `created_at`),
    INDEX `idx_resolved` (`is_resolved`),
    CONSTRAINT `fk_alert_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 6. Tabel Kontak Darurat Bertingkat (Juknis 2.4 & 6.1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `emergency_contacts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `relationship` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `priority_order` INT NOT NULL DEFAULT 1,
    `is_primary` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_contact_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 7. Tabel Pengingat Obat & Aktivitas (Pilar 3: AI Companion - Juknis 5.4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reminders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `reminder_type` ENUM('MEDICINE', 'ACTIVITY', 'CHECKIN') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `time_scheduled` VARCHAR(10) NOT NULL,
    `is_confirmed` BOOLEAN DEFAULT FALSE,
    `confirmed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_reminder_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 8. Tabel Persetujuan Privasi & Consent (Juknis 8: Kepatuhan UU PDP)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `consents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `data_type` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `is_granted` BOOLEAN DEFAULT TRUE,
    `granted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_consent_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 9. Tabel Log Percakapan AI Companion (Pilar 3 - Juknis 5.4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `conversation_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `sender` ENUM('ELDER', 'AI') NOT NULL,
    `message` TEXT NOT NULL,
    `sentiment` VARCHAR(30) DEFAULT 'NEUTRAL',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_chat_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Seed Data Awal
-- ---------------------------------------------------------------------
INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `role`)
VALUES
(1, 'rully', 'rully@familycare.id', 'demo123', 'Rully Santoso (Keluarga Utama)', 'FAMILY_PRIMARY')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

INSERT INTO `patients` (`id`, `patient_code`, `full_name`, `age`, `gender`, `room_number`, `condition_summary`)
VALUES 
(1, 'ELD-001', 'Opa Budi Santoso', 71, 'MALE', 'Kamar Utama (Lantai 1)', 'Hipertensi terkontrol Amlodipine 5mg. Riwayat pusing saat bangun tidur'),
(2, 'ELD-002', 'Oma Siti Rahma', 68, 'FEMALE', 'Paviliun Melati', 'Kondisi stabil, rutin konsumsi vitamin & obat jantung')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

INSERT INTO `devices` (`id`, `patient_id`, `device_token`, `device_type`, `model_name`, `status`)
VALUES
('HUAWEI-WATCH-001', 1, 'HUAWEI-ECA-8821', 'watch', 'Huawei Smart Health Band Pro', 'ONLINE'),
('ECA-HOME-001', 1, 'HUAWEI-ECA-8821', 'home', 'Huawei Smart Home Safety Node', 'ONLINE')
ON DUPLICATE KEY UPDATE `device_token` = VALUES(`device_token`);

INSERT INTO `emergency_contacts` (`patient_id`, `name`, `relationship`, `phone_number`, `priority_order`, `is_primary`)
VALUES
(1, 'Rully Santoso', 'Anak Pertama (Keluarga Utama)', '+62 812-3456-7890', 1, TRUE),
(1, 'dr. Maya Sp.JP', 'Dokter Keluarga / Telemedicine', '+62 821-9876-5432', 2, FALSE),
(1, 'Layanan Darurat 119 / RSUD', 'Instalasi Gawat Darurat', '119', 3, FALSE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `reminders` (`patient_id`, `reminder_type`, `title`, `time_scheduled`, `is_confirmed`)
VALUES
(1, 'MEDICINE', 'Amlodipine 5mg (Obat Tekanan Darah)', '08:00', TRUE),
(1, 'ACTIVITY', 'Jalan Santai Pagi 15 Menit di Halaman', '08:30', TRUE),
(1, 'MEDICINE', 'Vitamin D3 & Kalsium', '12:30', FALSE),
(1, 'CHECKIN', 'Check-in Sore Bersama AI Companion', '17:00', FALSE)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

INSERT INTO `consents` (`patient_id`, `data_type`, `description`, `is_granted`)
VALUES
(1, 'Biometrik Jantung & Aktivitas', 'Pengambilan data denyut jantung dan pedometer secara real-time untuk pemantauan kesehatan keluarga.', TRUE),
(1, 'Deteksi Jatuh & Akselerometer', 'Pengambilan data sensor gerak MPU6050 untuk mendeteksi kondisi darurat jatuh.', TRUE),
(1, 'Keamanan Rumah (Sensor Asap & Suhu)', 'Pemantauan kualitas udara dan risiko kebakaran di dalam kediaman lansia.', TRUE),
(1, 'AI Companionship Check-in', 'Penyimpanan ringkasan percakapan harian untuk mendeteksi kesejahteraan emosional.', TRUE)
ON DUPLICATE KEY UPDATE `is_granted` = VALUES(`is_granted`);

INSERT INTO `conversation_logs` (`patient_id`, `sender`, `message`, `sentiment`)
VALUES
(1, 'AI', 'Selamat pagi Opa Budi! Semoga hari ini cerah dan menyenangkan. Jangan lupa minum segelas air hangat ya.', 'CALM'),
(1, 'ELDER', 'Iya nak, sudah tadi setelah sholat subuh. Badan terasa agak segar hari ini.', 'HAPPY'),
(1, 'AI', 'Alhamdulillah! Sudah waktunya minum obat Amlodipine setelah sarapan ya Opa. Nanti kabari saya kalau sudah.', 'CALM'),
(1, 'ELDER', 'Sudah ku minum barusan dengan roti gandum.', 'HAPPY'),
(1, 'AI', 'Hebat Opa! Tercatat aman. Selamat beraktivitas santai ya!', 'CALM')
ON DUPLICATE KEY UPDATE `message` = VALUES(`message`);
