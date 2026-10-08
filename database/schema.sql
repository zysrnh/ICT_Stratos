-- =====================================================================
-- Database Schema: Huawei Cloud RDS (MySQL 8.0)
-- Project: IoT Real-Time Health Telemetry & Anomaly Monitoring
-- Track: Huawei ICT Competition - Innovation Track
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `huawei_health_iot`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `huawei_health_iot`;

-- ---------------------------------------------------------------------
-- 1. Tabel Pasien (Master Data)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `patients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_code` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Kode unik rekam medis pasien',
    `full_name` VARCHAR(100) NOT NULL,
    `age` INT NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `room_number` VARCHAR(30) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. Tabel Telemetri Sensor (Data Real-Time dari ESP32)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `health_metrics` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `device_id` VARCHAR(50) NOT NULL,
    `temperature` DECIMAL(4, 2) NOT NULL COMMENT 'Suhu tubuh pasien (°C)',
    `humidity` DECIMAL(4, 2) DEFAULT NULL COMMENT 'Kelembaban ruangan (%)',
    `heart_rate` INT NOT NULL COMMENT 'Detak jantung pasien (BPM)',
    `health_status` ENUM('NORMAL', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_patient_time` (`patient_id`, `recorded_at`),
    INDEX `idx_device` (`device_id`),
    INDEX `idx_status` (`health_status`),
    CONSTRAINT `fk_metrics_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. Tabel Alerting / Anomali (Trigger Medis & AI Inference)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `health_alerts` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `metric_id` BIGINT NOT NULL,
    `patient_id` INT NOT NULL,
    `alert_type` VARCHAR(50) NOT NULL COMMENT 'Contoh: TACHYCARDIA, BRADYCARDIA, HYPERTHERMIA',
    `severity` ENUM('WARNING', 'CRITICAL') NOT NULL,
    `message` TEXT NOT NULL,
    `is_resolved` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_patient_alert` (`patient_id`, `created_at`),
    INDEX `idx_resolved` (`is_resolved`),
    CONSTRAINT `fk_alert_metric` FOREIGN KEY (`metric_id`) REFERENCES `health_metrics` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_alert_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Seed Data Awal untuk Demo & Pengujian
-- ---------------------------------------------------------------------
INSERT INTO `patients` (`id`, `patient_code`, `full_name`, `age`, `gender`, `room_number`)
VALUES 
(1, 'P-001', 'Budi Santoso', 45, 'MALE', 'ICU Room 03'),
(2, 'P-002', 'Siti Rahma', 32, 'FEMALE', 'Ward Room 12')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);
