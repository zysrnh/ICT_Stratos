#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==========================================
// Konfigurasi WiFi Wokwi
// ==========================================
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// ==========================================
// Konfigurasi Server / Backend API (HTTP Tunnel Aktif)
// ==========================================
String serverUrl = "http://bpfzj-2400-9800-264-2864-8961-1b88-7281-1569.free.pinggy.net/api/telemetry";

// ==========================================
// Konfigurasi Pin Sensor & Indikator
// ==========================================
#define DHTPIN 15          // Pin Data DHT22
#define DHTTYPE DHT22      // Tipe DHT22
#define POT_PIN 34         // ADC1 Pin Potensiometer (Simulasi Pulse/Heart Rate)
#define LED_NORMAL 2       // LED Hijau (Status Normal)
#define LED_ALERT 19       // LED Merah (Status Anomali/Bahaya)

DHT dht(DHTPIN, DHTTYPE);

// Identitas Device & Pasien
const char* DEVICE_ID = "DEV-ESP32-001";
const int PATIENT_ID = 1;

// Interval Pengiriman Data (ms)
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 3000; // Kirim tiap 3 detik

// Deklarasi fungsi pengiriman
void sendTelemetryToCloud(float temp, float hum, int hr, String status);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  Smart Health IoT Telemetry System - Huawei Cloud RDS ");
  Serial.println("=======================================================");

  // Inisialisasi Pin
  pinMode(LED_NORMAL, OUTPUT);
  pinMode(LED_ALERT, OUTPUT);
  pinMode(POT_PIN, INPUT);

  digitalWrite(LED_NORMAL, LOW);
  digitalWrite(LED_ALERT, LOW);

  // Inisialisasi Sensor DHT22
  dht.begin();
  Serial.println("[Sensor] Sensor DHT22 siap.");

  // Koneksi WiFi (Wokwi-GUEST)
  Serial.print("[WiFi] Menghubungkan ke ");
  Serial.println(ssid);
  WiFi.begin(ssid, password, 6);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Sukses terhubung ke jaringan!");
    Serial.print("[WiFi] IP Lokal ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Belum terhubung, ESP32 tetap membaca sensor secara lokal.");
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // Evaluasi dan kirim data secara periodik
  if (currentMillis - lastSendTime >= sendInterval) {
    lastSendTime = currentMillis;

    // 1. Baca Sensor Suhu & Kelembaban
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("[Sensor Error] Gagal membaca DHT22, menggunakan nilai fallback.");
      temperature = 36.6;
      humidity = 60.0;
    }

    // 2. Baca Potensiometer untuk Simulasi Sinyal Detak Jantung
    // ADC ESP32 bernilai 0 - 4095.
    // Dipetakan ke rentang detak jantung medis (45 - 150 BPM).
    int rawPot = analogRead(POT_PIN);
    int heartRate = map(rawPot, 0, 4095, 45, 150);

    // 3. Klasifikasi Status Kesehatan
    // Standar: Suhu normal 36.1 - 37.5 °C, Heart rate 60 - 100 BPM
    String healthStatus = "NORMAL";
    bool isAlert = false;

    if (temperature >= 38.5 || heartRate >= 120 || heartRate <= 48) {
      healthStatus = "CRITICAL";
      isAlert = true;
    } else if (temperature >= 37.6 || heartRate > 100 || heartRate < 60) {
      healthStatus = "WARNING";
      isAlert = true;
    } else {
      healthStatus = "NORMAL";
      isAlert = false;
    }

    // 4. Update Indikator LED
    if (isAlert) {
      digitalWrite(LED_NORMAL, LOW);
      digitalWrite(LED_ALERT, HIGH);
    } else {
      digitalWrite(LED_NORMAL, HIGH);
      digitalWrite(LED_ALERT, LOW);
    }

    // 5. Cetak ke Serial Monitor Wokwi
    Serial.println("\n-------------------------------------------");
    Serial.printf("Suhu Tubuh   : %.1f °C\n", temperature);
    Serial.printf("Kelembaban   : %.1f %%\n", humidity);
    Serial.printf("Detak Jantung: %d BPM (Raw ADC: %d)\n", heartRate, rawPot);
    Serial.printf("Kondisi      : [%s]\n", healthStatus.c_str());

    // 6. Kirim data ke Backend Cloud API jika terkoneksi WiFi
    if (WiFi.status() == WL_CONNECTED) {
      sendTelemetryToCloud(temperature, humidity, heartRate, healthStatus);
    }
  }
}

// ==========================================
// Fungsi Pengiriman Telemetri ke Backend API
// Menggunakan Plain HTTP (Stabil & Kompatibel Wokwi)
// ==========================================
void sendTelemetryToCloud(float temp, float hum, int hr, String status) {
  WiFiClient client;
  HTTPClient http;

  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Pinggy-No-Screen", "1"); // Bypass halaman warning pinggy

  // Format Dokumen JSON
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["patient_id"] = PATIENT_ID;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["heart_rate"] = hr;
  doc["health_status"] = status;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.println("[Cloud] Mengirim payload JSON...");
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[Cloud Success] HTTP %d: %s\n", httpResponseCode, response.c_str());
  } else {
    Serial.printf("[Cloud Warning] POST gagal, kode: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
