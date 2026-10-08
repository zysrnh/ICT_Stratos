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
// Konfigurasi Server / Backend API (HTTP Tunnel Ngrok Aktif)
// ==========================================
String serverUrl = "https://d816-2400-9800-264-2864-8961-1b88-7281-1569.ngrok-free.app/api/telemetry";

// ==========================================
// Konfigurasi Pin Hardware Smartwatch
// ==========================================
#define DHTPIN 32          // Sensor Suhu Kulit DHT22 (Pin Sisi Kiri ESP32)
#define DHTTYPE DHT22
#define POT_PIN 34         // Sensor Denyut Jantung PPG Potentiometer (Pin Sisi Kiri ESP32)
#define BTN_SOS 19         // Tombol Crown / SOS Darurat (Pin Sisi Kanan ESP32)
#define BUZZER_PIN 18      // Haptic Vibration / Alarm Buzzer (Pin Sisi Kanan ESP32)
#define LED_SYNC 2         // LED Status Sinkronisasi Cloud (Pin Sisi Kiri ESP32)

DHT dht(DHTPIN, DHTTYPE);

// Identitas Device & Pengguna
const char* DEVICE_ID = "HUAWEI-WATCH-001";
const int PATIENT_ID = 1;

// Interval Pengiriman & Waktu Jam
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 3000; // Kirim tiap 3 detik
unsigned long lastClockTick = 0;
int clockSeconds = 0;
int clockMinutes = 35;
int clockHours = 17;

// Status Darurat SOS
bool sosTriggered = false;

// Deklarasi Fungsi
void updateWatchDisplay(int heartRate, float temperature, String status, bool isAlert);
void sendTelemetryToCloud(float temp, float hum, int hr, String status);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("   Huawei Smart Health Band (Wearable IoT Prototype)   ");
  Serial.println("=======================================================");

  // Inisialisasi Pin
  pinMode(BTN_SOS, INPUT_PULLUP);
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
    display.println("HUAWEI WATCH");
    display.setCursor(15, 35);
    display.println("Smart Health Band");
    display.setCursor(20, 50);
    display.println("Booting System...");
    display.display();
    delay(1200);
  }

  // Inisialisasi Sensor DHT22
  dht.begin();

  // Koneksi WiFi Wokwi-GUEST
  Serial.print("[WiFi] Menghubungkan ke ");
  Serial.println(ssid);
  WiFi.begin(ssid, password, 6);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 15) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Sukses terhubung ke Cloud!");
    digitalWrite(LED_SYNC, HIGH);
  } else {
    Serial.println("\n[WiFi] Mode Offline.");
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // Update Jam Digital Internal Smartwatch
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

  // Deteksi Tombol SOS Darurat pada Jam Tangan
  if (digitalRead(BTN_SOS) == LOW) {
    sosTriggered = true;
    tone(BUZZER_PIN, 2500, 300); // Alarm darurat bunyi
  }

  // Rutinitas Pembacaan Sensor & Kirim Telemetri
  if (currentMillis - lastSendTime >= sendInterval) {
    lastSendTime = currentMillis;

    // 1. Baca Sensor Suhu Kulit
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      temperature = 36.6;
      humidity = 60.0;
    }

    // 2. Baca Sensor Denyut Jantung Optik (PPG)
    int rawPot = analogRead(POT_PIN);
    int heartRate = map(rawPot, 0, 4095, 45, 150);

    // 3. Evaluasi Kondisi Medis
    String healthStatus = "NORMAL";
    bool isAlert = false;

    if (sosTriggered) {
      healthStatus = "CRITICAL";
      isAlert = true;
      sosTriggered = false; // Reset status SOS setelah terkirim
    } else if (temperature >= 38.5 || heartRate >= 120 || heartRate <= 48) {
      healthStatus = "CRITICAL";
      isAlert = true;
    } else if (temperature >= 37.6 || heartRate > 100 || heartRate < 60) {
      healthStatus = "WARNING";
      isAlert = true;
    } else {
      healthStatus = "NORMAL";
      isAlert = false;
    }

    // 4. Efek Haptic / Getar Jam Tangan saat Anomali
    if (isAlert) {
      tone(BUZZER_PIN, 1800, 150);
    }

    // 5. Render Watchface ke Layar OLED
    updateWatchDisplay(heartRate, temperature, healthStatus, isAlert);

    // 6. Cetak ke Serial Monitor
    Serial.println("\n-------------------------------------------");
    Serial.printf("[WATCH] Time: %02d:%02d:%02d\n", clockHours, clockMinutes, clockSeconds);
    Serial.printf("[HEART] %d BPM | [TEMP] %.1f C\n", heartRate, temperature);
    Serial.printf("[STATUS] %s\n", healthStatus.c_str());

    // 7. Sync Data ke Cloud
    if (WiFi.status() == WL_CONNECTED) {
      sendTelemetryToCloud(temperature, humidity, heartRate, healthStatus);
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
    display.setCursor(22, 53);
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
  http.addHeader("ngrok-skip-browser-warning", "true");
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

  Serial.println("[Cloud] Sync telemetri jam ke server...");
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[Cloud Sync OK] HTTP %d: %s\n", httpResponseCode, response.c_str());
    digitalWrite(LED_SYNC, HIGH);
  } else {
    Serial.printf("[Cloud Sync Error] Gagal: %s\n", http.errorToString(httpResponseCode).c_str());
    digitalWrite(LED_SYNC, LOW);
  }

  http.end();
}
