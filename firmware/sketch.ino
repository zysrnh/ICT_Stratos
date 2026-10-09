#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==========================================
// Konfigurasi Layar OLED (SSD1306 - I2C)
// ==========================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================
// Konfigurasi WiFi Wokwi
// ==========================================
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// ==========================================
// Konfigurasi Server / Backend API (HTTP Tunnel Pinggy Aktif)
// ==========================================
String serverUrl = "http://orcsc-2400-9800-2b3-1ca4-e12e-fa59-f29-ef79.free.pinggy.net/api/telemetry";

// ==========================================
// Konfigurasi Pin Hardware Smart Health Band
// ==========================================
#define DHTPIN 32          // Sensor Suhu Kulit DHT22 (Kiri ESP32)
#define DHTTYPE DHT22
#define POT_PIN 34         // Sensor PPG Detak Jantung Potensiometer (Kiri ESP32)
#define BUZZER_PIN 18      // Alarm Haptic Buzzer (Kanan ESP32)
#define LED_SYNC 2         // Indikator Sinkronisasi Cloud (Kiri ESP32)

DHT dht(DHTPIN, DHTTYPE);

// Identitas Device & Pasien
const char* DEVICE_ID = "HUAWEI-WATCH-001";
const int PATIENT_ID = 1;

// Interval Pengiriman & Waktu Jam
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 3000; // Kirim tiap 3 detik
unsigned long lastClockTick = 0;
int clockSeconds = 0;
int clockMinutes = 45;
int clockHours = 17;

// Deklarasi Fungsi
void updateWatchDisplay(int heartRate, float temperature, String status, bool isAlert);
void sendTelemetryToCloud(float temp, float hum, int hr, String status);

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=======================================================");
  Serial.println("  HUAWEI SMART HEALTH BAND - Real-Time Telemetry IoT   ");
  Serial.println("=======================================================");

  // Inisialisasi Pin
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_SYNC, OUTPUT);
  pinMode(POT_PIN, INPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_SYNC, LOW);

  // Inisialisasi Layar OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[Display Error] SSD1306 tidak terdeteksi!");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(18, 15);
    display.println("HUAWEI HEALTH");
    display.setCursor(15, 32);
    display.println("Early Warning Sys");
    display.setCursor(20, 48);
    display.println("Connecting WiFi...");
    display.display();
  }

  // Inisialisasi Sensor DHT22
  dht.begin();

  // Koneksi WiFi Wokwi Standard STA Mode (Kunci Channel 6 agar instan tanpa scan)
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password, 6);
  Serial.print("[WiFi] Menghubungkan ke Wokwi-GUEST");

  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    Serial.print(".");
  }

  Serial.println(" [CONNECTED]");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_SYNC, HIGH);
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Update Jam Digital Internal Smartwatch
  if (currentMillis - lastClockTick >= 1000) {
    lastClockTick = currentMillis;
    clockSeconds++;
    if (clockSeconds >= 60) {
      clockSeconds = 0;
      clockMinutes++;
      if (clockMinutes >= 60) {
        clockMinutes = 0;
        clockHours = (clockHours + 1) % 24;
      }
    }
  }

  // 2. Rutinitas Pembacaan Sensor & Pengiriman Tiap 3 Detik
  if (currentMillis - lastSendTime >= sendInterval) {
    lastSendTime = currentMillis;

    // Baca Suhu & Kelembaban
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      temperature = 36.6;
      humidity = 60.0;
    }

    // Baca Detak Jantung (PPG Simulator Knob: 45 - 150 BPM)
    int rawPot = analogRead(POT_PIN);
    int heartRate = map(rawPot, 0, 4095, 45, 150);

    // 3. Evaluasi Kondisi Medis Otomatis (Early Warning System)
    String healthStatus = "NORMAL";
    bool isAlert = false;

    if (temperature >= 38.5 || heartRate >= 120 || heartRate <= 48) {
      healthStatus = "CRITICAL";
      isAlert = true;
    } else if (temperature >= 37.5 || heartRate > 100 || heartRate < 60) {
      healthStatus = "WARNING";
      isAlert = true;
    } else {
      healthStatus = "NORMAL";
      isAlert = false;
    }

    // 4. Efek Haptic Buzzer (Beep pendek intermiten jika anomali)
    if (isAlert) {
      int alertFreq = (healthStatus == "CRITICAL") ? 2400 : 1400;
      tone(BUZZER_PIN, alertFreq, 180); // Beep 180ms
    }

    // 5. Render Watchface ke Layar OLED
    updateWatchDisplay(heartRate, temperature, healthStatus, isAlert);

    // 6. Cetak Ringkasan ke Serial Monitor
    Serial.println("\n-------------------------------------------");
    Serial.printf("[TIME] %02d:%02d:%02d | [PATIENT] #%d\n", clockHours, clockMinutes, clockSeconds, PATIENT_ID);
    Serial.printf("[HEART] %d BPM | [TEMP] %.1f C\n", heartRate, temperature);
    Serial.printf("[EWS STATUS] %s\n", healthStatus.c_str());

    // 7. Cek koneksi WiFi lalu Kirim Telemetri ke Cloud
    if (WiFi.status() == WL_CONNECTED) {
      sendTelemetryToCloud(temperature, humidity, heartRate, healthStatus);
    } else {
      Serial.println("[WiFi] Status: Terputus dari Wokwi-GUEST...");
    }
  }
}

// ==========================================
// Rendering Antarmuka Jam Tangan (Watchface)
// ==========================================
void updateWatchDisplay(int heartRate, float temperature, String status, bool isAlert) {
  display.clearDisplay();

  // Header Bar: Brand + Jam Digital
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print("HUAWEI");

  char timeStr[9];
  sprintf(timeStr, "%02d:%02d", clockHours, clockMinutes);
  display.setCursor(95, 0);
  display.print(timeStr);

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // Widget Denyut Jantung (BPM)
  display.setCursor(2, 16);
  display.print("HEART RATE");

  display.setTextSize(2);
  display.setCursor(2, 28);
  display.printf("%3d", heartRate);

  display.setTextSize(1);
  display.setCursor(45, 34);
  display.print("BPM");

  // Widget Suhu Tubuh
  display.setCursor(75, 16);
  display.print("SKIN TEMP");

  display.setTextSize(1);
  display.setCursor(75, 29);
  display.printf("%.1f C", temperature);

  // Status Bar Bawah
  display.drawLine(0, 48, 127, 48, SSD1306_WHITE);

  if (isAlert) {
    display.fillRect(0, 50, 128, 14, SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
    display.setCursor(18, 53);
    display.printf("! ALERT: %s !", status.c_str());
  } else {
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(20, 53);
    display.print("* STATUS: NORMAL *");
  }

  display.display();
}

// ==========================================
// Fungsi Kirim Telemetri ke Cloud Backend
// ==========================================
void sendTelemetryToCloud(float temp, float hum, int hr, String status) {
  WiFiClient client;
  HTTPClient http;

  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Pinggy-No-Screen", "1");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["patient_id"] = PATIENT_ID;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["heart_rate"] = hr;
  doc["health_status"] = status;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.println("[Cloud] Mengirim telemetri ke RDS MySQL...");
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[Cloud OK] HTTP %d: %s\n", httpResponseCode, response.c_str());
    digitalWrite(LED_SYNC, HIGH);
  } else {
    Serial.printf("[Cloud Error] Gagal: %s (Code: %d)\n", http.errorToString(httpResponseCode).c_str(), httpResponseCode);
    digitalWrite(LED_SYNC, LOW);
  }

  http.end();
}
