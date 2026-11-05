/*
  AI-Powered Elderly Care Ecosystem - Device Layer (Wokwi)
  ---------------------------------------------------------
  Satu ESP32 mensimulasikan DUA perangkat logis:
    1) ECA-WATCH-001 : jam pintar lansia (HR, aktivitas/langkah, deteksi jatuh, tombol SOS, tombol OK)
    2) ECA-HOME-001  : node keselamatan rumah (asap MQ-2 + suhu ruangan DHT22)
  Di perangkat nyata keduanya adalah board terpisah; kodenya tinggal dipisah.

  Alur darurat:
    Jatuh / HR abnormal -> VERIFY (lansia ditanya, tekan OK = aman) -> tak ada respons -> ESCALATED (backend notifikasi keluarga)
    SOS / Asap          -> langsung ESCALATED (tanpa verifikasi)

  Jaringan berjalan di task FreeRTOS terpisah, jadi HTTP yang lambat tidak menahan layar, buzzer, atau deteksi jatuh.
  Event darurat diantrikan (RAM) dan dikirim ulang otomatis bila WiFi putus.

  Perintah simulator via Serial Monitor:
    fall | sos | smoke | clear | hr <angka> | hr auto | token | token <id> | token new | qr
  Semua event dari perintah ini ditandai "sim": true.
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>
#include "qrcode.h"   // Tab qrcode.h + qrcode.c di Wokwi (ricmoo/QRCode)

// ==========================================
// OLED SSD1306 (I2C)
// ========================================== 
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================
// WiFi
// ==========================================
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

// ==========================================
// Backend
// USE_HTTPS=1 : TLS Enkripsi (Domain Produksi: ict.hmif-lpkia.my.id)
// ==========================================
#define USE_HTTPS 0
#define API_HOST "ict.hmif-lpkia.my.id"
#if USE_HTTPS
  #define API_BASE "https://" API_HOST
#else
  #define API_BASE "http://" API_HOST
#endif
const char* URL_TELEMETRY = API_BASE "/api/telemetry";
const char* URL_EVENTS    = API_BASE "/api/events";
char activeToken[32]      = "HUAWEI-ECA-74E7";   // Token ID default stabil (Sesuai sesi aktif Web Dashboard)
bool isPaired             = false;                // False: Standby di layar QR | True: Aktif monitoring
char pairedPatientName[64]= "Lansia Terhubung";
int  pairedPatientId      = 16;  // ID Pasien aktif (Sinkron dinamis dengan Web)

// ==========================================
// Identitas
// ==========================================
const char* DEVICE_ID      = "HUAWEI-WATCH-001";
const char* HOME_DEVICE_ID = "ECA-HOME-001";
const int   PATIENT_ID     = 1;

// ==========================================
// Pin
// ==========================================
#define DHTPIN     32   // DHT22: suhu & kelembaban RUANGAN (node rumah)
#define DHTTYPE    DHT22
#define POT_PIN    34   // simulasi PPG detak jantung (ADC1)
#define SMOKE_PIN  35   // MQ-2 AOUT (ADC1, input-only)
#define BUZZER_PIN 18
#define LED_SYNC   2
#define BTN_SOS    27   // tombol darurat (INPUT_PULLUP, aktif LOW)
#define BTN_OK     26   // tombol "saya baik-baik saja" / batalkan alarm
#define MPU_ADDR   0x68

// ==========================================
// Ambang Batas Parameter Medis & Sensor
// ==========================================
const int HR_WARN_HIGH = 100, HR_CRIT_HIGH = 120;
const int HR_WARN_LOW  = 50,  HR_CRIT_LOW  = 40;
const unsigned long HR_SUSTAIN_MS = 10000UL;   // demo 10 dtk
const unsigned long HR_COOLDOWN_MS = 60000UL;

const float FALL_IMPACT_G = 2.5f;              // puncak benturan
const unsigned long IMPACT_SETTLE_MS = 1000UL; // abaikan 1 dtk setelah benturan
const unsigned long STILL_WINDOW_MS  = 2000UL; // lalu harus diam selama 2 dtk
const float STILL_TOL_G = 0.20f;

const unsigned long VERIFY_FALL_MS = 15000UL;  // waktu tunggu respons lansia (jatuh: paling pendek)
const unsigned long VERIFY_HR_MS   = 30000UL;

const float STEP_UP_G = 1.25f, STEP_DOWN_G = 1.05f;
const unsigned long STEP_MIN_MS = 350UL;
const float ACTIVE_MOTION = 0.06f;

const int   SMOKE_ALERT_ADC = 2500, SMOKE_CLEAR_ADC = 2000;
const float ROOM_TEMP_ALERT = 57.0f;

// ==========================================
// Tipe & State
// ==========================================
enum AlertKind  { K_NONE, K_FALL, K_HR, K_SOS, K_SMOKE };
enum AlertPhase { P_IDLE, P_VERIFY, P_ESCALATED };
enum FallState  { F_IDLE, F_SETTLE, F_WATCH };
struct NetMsg { char body[400]; };
struct Btn { uint8_t pin; bool last; unsigned long t; };

DHT dht(DHTPIN, DHTTYPE);
QueueHandle_t evtQ, telQ;

AlertKind  curKind = K_NONE;
AlertPhase phase = P_IDLE;
const char* curSev = "WARNING";
float curValue = 0;
bool  curSim = false;
unsigned long verifyStart = 0, verifyLimit = 0;
char  curEventId[24] = "";
uint32_t eventSeq = 0, bootId = 0;

bool  mpuOk = false;
float lastG = 1.0f, motionEma = 0;
bool  isActive = false;
uint32_t steps = 0;
unsigned long lastStepAt = 0;
FallState fallState = F_IDLE;
unsigned long fallT = 0;
float fallPeak = 0, fallDev = 0;

float hrEma = 70;
int   hrNow = 70, hrOverride = -1, hrLevelNow = 0;
unsigned long hrAbnSince = 0, hrCooldownUntil = 0;

float roomTemp = NAN, roomHum = NAN;
bool  dhtOk = false;
float smokeEma = 0;
bool  simSmoke = false;

uint16_t cancelledCount = 0;   // jumlah alarm dibatalkan lansia

Btn btnSos = { BTN_SOS, HIGH, 0 };
Btn btnOk  = { BTN_OK,  HIGH, 0 };

// ==========================================
// Util
// ==========================================
uint32_t epochNow() {
  time_t t = time(nullptr);
  return (t > 1700000000) ? (uint32_t)t : 0;
}

const char* kindName(AlertKind k) {
  switch (k) {
    case K_FALL:  return "FALL";
    case K_HR:    return "HR_ABNORMAL";
    case K_SOS:   return "SOS";
    case K_SMOKE: return "SMOKE";
    default:      return "NONE";
  }
}

int prioOf(AlertKind k) {
  switch (k) {
    case K_SMOKE: return 4;
    case K_SOS:   return 3;
    case K_FALL:  return 2;
    case K_HR:    return 1;
    default:      return 0;
  }
}

const char* healthStatus() {
  if (phase == P_ESCALATED) return "CRITICAL";
  if (phase == P_VERIFY || hrLevelNow > 0) return "WARNING";
  return "NORMAL";
}

bool btnEdge(Btn &b) {
  bool r = digitalRead(b.pin);
  bool pressed = false;
  if (r != b.last && millis() - b.t > 40) {
    b.t = millis();
    b.last = r;
    if (r == LOW) pressed = true;
  }
  return pressed;
}

// ==========================================
// Tampilan QR Code Layar Penuh SSD1306 (ricmoo/QRCode - tab qrcode.h & qrcode.c)
// ==========================================
void drawQrCodeScreen() {
  display.clearDisplay();

  // Header bar solid
  display.fillRect(0, 0, 128, 10, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(4, 1);
  display.print("HUAWEI BAND PAIRING");

  // QR Version 2 (25x25 modul) cukup untuk token "HUAWEI-ECA-XXXX"
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(2)];
  qrcode_initText(&qrcode, qrcodeData, 2, ECC_LOW, activeToken);

  const int scale = 2;
  const int offsetX = 4;
  const int offsetY = 12;

  // Gambar modul QR di sisi kiri OLED (50x50 px)
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        display.fillRect(offsetX + (x * scale), offsetY + (y * scale), scale, scale, SSD1306_WHITE);
      }
    }
  }

  // Informasi token di sisi kanan OLED (X: 58 s.d 127)
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(58, 12);
  display.print("TOKEN ID:");

  display.setCursor(58, 22);
  display.print("HUAWEI-ECA");
  display.setCursor(58, 31);
  if (strlen(activeToken) > 11) {
    display.print(activeToken + 10); // misal: "-7F2A"
  } else {
    display.print(activeToken);
  }

  display.setCursor(58, 43);
  display.print("STATUS:");
  display.setCursor(58, 54);
  static int dots = 0;
  if (!isPaired) {
    dots = (dots + 1) % 4;
    if (dots == 0) display.print("CEK WEB");
    else if (dots == 1) display.print("CEK WEB.");
    else if (dots == 2) display.print("CEK WEB..");
    else display.print("CEK WEB...");
  } else {
    display.print("AKTIF");
  }

  display.display();
}

// ==========================================
// Tampilan Layar Selamat Datang Setelah Pairing Berhasil
// ==========================================
void drawWelcomeScreen() {
  display.clearDisplay();
  display.fillRect(0, 0, 128, 12, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(4, 2);
  display.print("* PAIRING BERHASIL! *");

  display.setTextColor(SSD1306_WHITE);
  display.setCursor(4, 18);
  display.print("Selamat Datang:");

  display.setCursor(4, 30);
  display.setTextSize(1);
  display.print(pairedPatientName);

  display.drawLine(0, 46, 127, 46, SSD1306_WHITE);
  display.setCursor(4, 52);
  display.print("Smartwatch Huawei Aktif");
  display.display();

  // Nada gembira tanda sukses pairing
  tone(BUZZER_PIN, 784, 120); delay(140);
  tone(BUZZER_PIN, 1046, 250); delay(260);
  noTone(BUZZER_PIN);
}

// Cek status pairing ke Cloud Backend
bool checkCloudPairing() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Cloud] Menunggu WiFi Wokwi terhubung...");
    return false;
  }

#if USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();
#else
  WiFiClient client;
#endif
  HTTPClient http;
  String url = String(API_BASE) + "/api/device/check-pair?token=" + activeToken;
  http.begin(client, url);
  http.setConnectTimeout(5000);
  http.setTimeout(5000);
  int httpCode = http.GET();
  bool paired = false;
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    deserializeJson(doc, payload);
    if (doc["paired"].as<bool>()) {
      paired = true;
      if (doc.containsKey("patient_id")) pairedPatientId = doc["patient_id"].as<int>();
      const char* pName = doc["patient_name"];
      if (pName && strlen(pName) > 0) {
        strlcpy(pairedPatientName, pName, sizeof(pairedPatientName));
      }
      Serial.printf("[Cloud] Auto-check: TERHUBUNG! Lansia: %s (ID: %d)\n", pairedPatientName, pairedPatientId);
    } else {
      Serial.printf("[Cloud] Auto-check: Token %s menunggu pairing di Web...\n", activeToken);
    }
  } else {
    Serial.printf("[Cloud] Auto-check: Gagal hubungi %s (%s, HTTP %d)\n", url.c_str(), http.errorToString(httpCode).c_str(), httpCode);
  }
  http.end();
  return paired;
}

// ==========================================
// Antrian Jaringan
// ==========================================
void enqueueMsg(QueueHandle_t q, const char* body) {
  NetMsg m;
  strlcpy(m.body, body, sizeof(m.body));
  if (xQueueSend(q, &m, 0) != pdTRUE) {
    NetMsg old;
    xQueueReceive(q, &old, 0);
    xQueueSend(q, &m, 0);
  }
}

void queueEvent(AlertKind k, const char* sev, const char* status, float val, bool sim) {
  StaticJsonDocument<384> d;
  d["event_id"]   = curEventId;
  d["device_id"]  = (k == K_SMOKE) ? HOME_DEVICE_ID : DEVICE_ID;
  d["patient_id"] = pairedPatientId;
  d["event_type"] = kindName(k);
  d["severity"]   = sev;
  d["status"]     = status;
  d["value"]      = val;
  d["ts"]         = epochNow();
  d["uptime_s"]   = millis() / 1000;
  d["sim"]        = sim;
  char buf[400];
  serializeJson(d, buf, sizeof(buf));
  enqueueMsg(evtQ, buf);
  Serial.printf("[EVENT] %s\n", buf);
}

void sendTelemetry() {
  char buf[512];
  StaticJsonDocument<512> d;
  d["device_id"]      = DEVICE_ID;
  d["patient_id"]     = pairedPatientId;
  d["device_type"]    = "watch";
  d["heart_rate"]     = hrNow;
  d["activity"]       = isActive ? "ACTIVE" : "REST";
  d["steps"]          = steps;
  d["accel_g"]        = lastG;
  d["health_status"]  = healthStatus();
  d["fall_cancelled"] = cancelledCount;
  d["sensor_ok"]      = mpuOk;
  d["sim"]            = (hrOverride > 0 || simSmoke);
  d["wifi_rssi"]      = WiFi.RSSI();
  if (dhtOk) {
    d["room_temp"]    = roomTemp;
    d["humidity"]     = roomHum;
  }
  d["smoke_adc"]      = (int)smokeEma;
  d["smoke_status"]   = (curKind == K_SMOKE) ? "ALERT" : "NORMAL";
  d["ts"]             = epochNow();
  d["uptime_s"]       = millis() / 1000;
  serializeJson(d, buf, sizeof(buf));
  enqueueMsg(telQ, buf);

  Serial.printf("[TEL] HR=%d %s steps=%lu g=%.2f | %s | rmh=%.1fC smoke=%d | queue evt=%u\n",
                hrNow, isActive ? "ACTIVE" : "REST", (unsigned long)steps, lastG, healthStatus(),
                dhtOk ? roomTemp : -99.0f, (int)smokeEma, (unsigned)uxQueueMessagesWaiting(evtQ));
}

int postJson(const char* url, const char* body) {
#if USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();
#else
  WiFiClient client;
#endif
  HTTPClient http;
  http.begin(client, url);
  http.setReuse(false);
  http.setConnectTimeout(3000);
  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + activeToken);
  http.addHeader("x-device-token", activeToken);
  http.addHeader("X-Pinggy-No-Screen", "1");
  int code = http.POST(String(body));
  if (code > 0) Serial.printf("[Cloud] %s -> HTTP %d\n", url, code);
  else          Serial.printf("[Cloud] %s gagal: %s\n", url, http.errorToString(code).c_str());
  http.end();
  digitalWrite(LED_SYNC, (code >= 200 && code < 300) ? HIGH : LOW);
  return code;
}

void netTask(void*) {
  unsigned long lastRetry = 0;
  unsigned long lastPairCheck = 0;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      digitalWrite(LED_SYNC, LOW);
      if (millis() - lastRetry > 10000UL) { lastRetry = millis(); WiFi.reconnect(); }
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    // Jika belum dipasangkan dengan web, cek status pairing secara berkala
    if (!isPaired) {
      if (millis() - lastPairCheck > 2000UL) {
        lastPairCheck = millis();
        if (checkCloudPairing()) {
          isPaired = true;
          Serial.printf("[Cloud] Pairing terdeteksi! Lansia: %s\n", pairedPatientName);
          drawWelcomeScreen();
          vTaskDelay(pdMS_TO_TICKS(2500));
        }
      }
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    NetMsg m;
    if (xQueuePeek(evtQ, &m, 0) == pdTRUE) {
      int code = postJson(URL_EVENTS, m.body);
      if ((code >= 200 && code < 300) || (code >= 400 && code < 500) || code <= 0) {
        xQueueReceive(evtQ, &m, 0);
      } else {
        vTaskDelay(pdMS_TO_TICKS(1500));
      }
      continue;
    }
    if (xQueueReceive(telQ, &m, pdMS_TO_TICKS(200)) == pdTRUE) {
      postJson(URL_TELEMETRY, m.body);
      vTaskDelay(pdMS_TO_TICKS(500));
    }
  }
}

// ==========================================
// Logika Alarm (Verifikasi -> Eskalasi)
// ==========================================
void clearAlert(const char* status) {
  queueEvent(curKind, curSev, status, curValue, curSim);
  if (curKind == K_HR) { hrAbnSince = 0; hrCooldownUntil = millis() + HR_COOLDOWN_MS; }
  curKind = K_NONE;
  phase = P_IDLE;
  noTone(BUZZER_PIN);
}

void raiseAlert(AlertKind k, float v, const char* sev, bool sim) {
  if (phase != P_IDLE && prioOf(k) <= prioOf(curKind)) return;
  if (phase == P_VERIFY) queueEvent(curKind, curSev, "CANCELLED", curValue, curSim);
  curKind = k; curSev = sev; curValue = v; curSim = sim;
  snprintf(curEventId, sizeof(curEventId), "%08lx-%lu", (unsigned long)bootId, (unsigned long)++eventSeq);
  if (k == K_SOS || k == K_SMOKE) {
    phase = P_ESCALATED;
    queueEvent(k, sev, "ESCALATED", v, sim);
  } else {
    phase = P_VERIFY;
    verifyStart = millis();
    verifyLimit = (k == K_FALL) ? VERIFY_FALL_MS : VERIFY_HR_MS;
    queueEvent(k, sev, "PENDING", v, sim);
  }
}

void onOkPressed() {
  cancelledCount++;
  simSmoke = false;
  smokeEma = 320.0f;
  hrOverride = 72;
  noTone(BUZZER_PIN);
  clearAlert(phase == P_VERIFY ? "CANCELLED" : "RESOLVED");
  Serial.println("[OK] Alarm dibatalkan & status dinormalkan (HR=72, Asap Aman)!");
}

void updateAlertLogic(unsigned long now) {
  if (phase == P_VERIFY && now - verifyStart >= verifyLimit) {
    phase = P_ESCALATED;
    queueEvent(curKind, curSev, "ESCALATED", curValue, curSim);
  }
}

void updateBuzzer(unsigned long now) {
  static unsigned long last = 0;
  unsigned long period; int freq;
  if (phase == P_VERIFY)         { period = 1000; freq = 1800; }
  else if (phase == P_ESCALATED) { period = (curKind == K_SMOKE) ? 400 : 300; freq = (curKind == K_SMOKE) ? 3000 : 2400; }
  else return;
  if (now - last >= period) { last = now; tone(BUZZER_PIN, freq, 150); }
}

// ==========================================
// Sensor: MPU6050
// ==========================================
bool initMpu() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C); Wire.write(0x10);
  Wire.endTransmission();
  return true;
}

int16_t rd16() {
  uint8_t h = Wire.read();
  uint8_t l = Wire.read();
  return (int16_t)((h << 8) | l);
}

bool readAccel(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)6) != 6) return false;
  ax = rd16() / 4096.0f;
  ay = rd16() / 4096.0f;
  az = rd16() / 4096.0f;
  return true;
}

void processSteps(float g, unsigned long now) {
  static bool above = false;
  if (!above && g > STEP_UP_G && g < FALL_IMPACT_G && now - lastStepAt > STEP_MIN_MS) {
    above = true; steps++; lastStepAt = now;
  } else if (above && g < STEP_DOWN_G) {
    above = false;
  }
}

void processFall(float g, unsigned long now) {
  switch (fallState) {
    case F_IDLE:
      if (g >= FALL_IMPACT_G) { fallState = F_SETTLE; fallT = now; fallPeak = g; }
      break;
    case F_SETTLE:
      if (g > fallPeak) fallPeak = g;
      if (now - fallT >= IMPACT_SETTLE_MS) { fallState = F_WATCH; fallT = now; fallDev = 0; }
      break;
    case F_WATCH: {
      float dev = fabsf(g - 1.0f);
      if (dev > fallDev) fallDev = dev;
      if (now - fallT >= STILL_WINDOW_MS) {
        if (fallDev < STILL_TOL_G) raiseAlert(K_FALL, fallPeak, "CRITICAL", false);
        fallState = F_IDLE;
      }
      break;
    }
  }
}

// ==========================================
// Evaluasi HR & Lingkungan
// ==========================================
void evalHr(unsigned long now) {
  int hr = hrNow, lvl = 0;
  if (hr <= HR_CRIT_LOW) lvl = 2;
  else if (hr <= HR_WARN_LOW) lvl = 1;
  else if (!isActive) {
    if (hr >= HR_CRIT_HIGH) lvl = 2;
    else if (hr >= HR_WARN_HIGH) lvl = 1;
  }
  hrLevelNow = lvl;
  if (lvl == 0) {
    hrAbnSince = 0;
    if (phase == P_VERIFY && curKind == K_HR) clearAlert("CANCELLED");
    return;
  }
  if (now < hrCooldownUntil) return;
  if (hrAbnSince == 0) hrAbnSince = now;
  if (phase == P_IDLE && now - hrAbnSince >= HR_SUSTAIN_MS)
    raiseAlert(K_HR, hr, lvl == 2 ? "CRITICAL" : "WARNING", hrOverride > 0);
}

void evalHome() {
  bool tempHigh  = dhtOk && roomTemp >= ROOM_TEMP_ALERT;
  bool smokeHigh = smokeEma >= SMOKE_ALERT_ADC;
  if (smokeHigh || tempHigh) {
    raiseAlert(K_SMOKE, smokeHigh ? smokeEma : roomTemp, "CRITICAL", simSmoke);
  } else if (curKind == K_SMOKE && smokeEma < SMOKE_CLEAR_ADC && !(dhtOk && roomTemp >= ROOM_TEMP_ALERT - 3.0f)) {
    clearAlert("RESOLVED");
  }
}

// ==========================================
// Simulator via Serial
// ==========================================
void activateBypass() {
  Serial.println("[PAIRING] Mencoba sinkronkan data lansia dari Web...");
  if (!checkCloudPairing()) {
    if (strlen(activeToken) > 11) {
      snprintf(pairedPatientName, sizeof(pairedPatientName), "Lansia (%s)", activeToken + 11);
    } else {
      snprintf(pairedPatientName, sizeof(pairedPatientName), "Lansia Aktif");
    }
  }
  isPaired = true;
  Serial.printf("[PAIRING] Operasional Aktif! Lansia: %s (ID: %d, Token: %s)\n", pairedPatientName, pairedPatientId, activeToken);
  drawWelcomeScreen();
  delay(1500);
}

void runCmd(char* s) {
  if      (!strcmp(s, "fall"))  { raiseAlert(K_FALL, 3.0f, "CRITICAL", true); }
  else if (!strcmp(s, "sos"))   { raiseAlert(K_SOS, 0, "CRITICAL", true); }
  else if (!strcmp(s, "smoke")) { simSmoke = true; }
  else if (!strcmp(s, "clear") || !strcmp(s, "normal") || !strcmp(s, "reset") || !strcmp(s, "aman")) {
    simSmoke = false;
    smokeEma = 320.0f;
    hrOverride = 72;
    noTone(BUZZER_PIN);
    clearAlert("RESOLVED");
    Serial.println("[SIM] SEMUA STATUS DI-RESET KE NORMAL (Aman, HR=72, Alarm Mati)");
  }
  else if (!strcmp(s, "ok") || !strcmp(s, "bypass")) {
    activateBypass();
  }
  else if (!strcmp(s, "qr") || !strcmp(s, "pair")) {
    drawQrCodeScreen();
    Serial.printf("\n[SMARTWATCH QR PAIRING]\n  TOKEN AKTIF : %s\n  URL PAIRING : https://%s/?pair=%s\n\n", activeToken, API_HOST, activeToken);
    delay(4000);
  }
  else if (!strcmp(s, "token")) {
    Serial.printf("\n[SMARTWATCH PAIRING INFO]\n  TOKEN AKTIF : %s\n  URL PAIRING : https://%s/?pair=%s\n\n", activeToken, API_HOST, activeToken);
  }
  else if (!strncmp(s, "token ", 6)) {
    if (!strcmp(s + 6, "new")) {
      snprintf(activeToken, sizeof(activeToken), "HUAWEI-ECA-%04X", (unsigned)(esp_random() & 0xFFFF));
    } else {
      strncpy(activeToken, s + 6, sizeof(activeToken) - 1);
      activeToken[sizeof(activeToken) - 1] = '\0';
    }
    Serial.printf("\n[TOKEN AKTIF DIUBAH]\n  TOKEN BARU  : %s\n  URL PAIRING : https://%s/?pair=%s\n\n", activeToken, API_HOST, activeToken);
    drawQrCodeScreen();
    delay(3000);
  }
  else if (!strncmp(s, "hr ", 3)) {
    if (!strcmp(s + 3, "auto")) hrOverride = -1;
    else hrOverride = atoi(s + 3);
  }
  else Serial.println("[SIM] perintah: fall | sos | smoke | clear | hr <angka> | hr auto | token | token <id> | token new | qr");
  Serial.printf("[SIM] ok: %s\n", s);
}

void handleSerial() {
  static char buf[32];
  static uint8_t n = 0;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (n) { buf[n] = 0; runCmd(buf); n = 0; }
    } else if (n < sizeof(buf) - 1) {
      buf[n++] = c;
    }
  }
}

// ==========================================
// Tampilan OLED Operasional
// ==========================================
void drawUI(unsigned long now) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  if (phase == P_VERIFY) {
    unsigned long el = now - verifyStart;
    unsigned long remain = (el >= verifyLimit) ? 0 : (verifyLimit - el) / 1000 + 1;
    display.setCursor(0, 0);
    display.print(curKind == K_FALL ? "JATUH TERDETEKSI" : "DETAK ABNORMAL");
    display.setCursor(0, 14);
    display.print("Anda baik-baik saja?");
    display.setTextSize(2);
    display.setCursor(0, 28);
    display.printf("Sisa %2lus", remain);
    display.setTextSize(1);
    display.setCursor(0, 54);
    display.print("Tekan OK = saya aman");
  } else if (phase == P_ESCALATED) {
    display.fillRect(0, 0, 128, 64, SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK);
    display.setTextSize(2);
    display.setCursor(0, 4);
    switch (curKind) {
      case K_FALL:  display.print("JATUH!");   break;
      case K_SOS:   display.print("SOS!");     break;
      case K_SMOKE: display.print("ASAP!");    break;
      default:      display.print("HR ALERT"); break;
    }
    display.setTextSize(1);
    display.setCursor(0, 28);
    display.print(curKind == K_SMOKE ? "Alarm rumah aktif" : "Keluarga diberi tahu");
    display.setCursor(0, 40);
    display.print(curKind == K_SMOKE ? "Menunggu udara aman" : "OK = batalkan/aman");
    display.setCursor(0, 54);
    if (WiFi.status() == WL_CONNECTED) display.print("Online");
    else display.printf("OFFLINE antri:%u", (unsigned)uxQueueMessagesWaiting(evtQ));
  } else {
    char ts[8] = "--:--";
    struct tm t;
    if (getLocalTime(&t, 0)) snprintf(ts, sizeof(ts), "%02d:%02d", t.tm_hour, t.tm_min);
    display.setCursor(0, 0);
    display.print("ECA WATCH");
    display.setCursor(64, 0);
    display.print(WiFi.status() == WL_CONNECTED ? "ON" : "OFF");
    display.setCursor(92, 0);
    display.print(ts);
    display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

    display.setCursor(0, 14);
    display.print("HEART RATE");
    display.setTextSize(2);
    display.setCursor(0, 26);
    display.printf("%3d", hrNow);
    display.setTextSize(1);
    display.setCursor(40, 33);
    display.print("BPM");

    display.setCursor(75, 14);
    display.print("STEPS");
    display.setCursor(75, 26);
    display.printf("%lu", (unsigned long)steps);
    display.setCursor(75, 38);
    display.print(isActive ? "AKTIF" : "ISTIRAHAT");

    display.drawLine(0, 48, 127, 48, SSD1306_WHITE);
    display.setCursor(14, 53);
    if (hrLevelNow == 0) display.print("* STATUS: NORMAL *");
    else display.printf("! HR %s !", hrNow >= 90 ? "TINGGI" : "RENDAH");
  }
  display.display();
}

// ==========================================
// Setup & Loop
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== AI-Powered Elderly Care - Device Layer ===");
  bootId = esp_random();

  // Token ID default stabil: HUAWEI-ECA-74E7 (Ketik 'token new' di Serial jika ingin acak baru)

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_SYNC, OUTPUT);
  pinMode(POT_PIN, INPUT);
  pinMode(SMOKE_PIN, INPUT);
  pinMode(BTN_SOS, INPUT_PULLUP);
  pinMode(BTN_OK, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_SYNC, LOW);

  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[Display] SSD1306 tidak terdeteksi!");
  } else {
    // Tampilkan Layar QR Code Dinamis untuk Pairing Smartwatch (Standby menunggu web)
    drawQrCodeScreen();
  }

  // Cetak Banner Pairing Siap Pakai di Serial Monitor
  Serial.println("\n=============================================================");
  Serial.println("  HUAWEI SMART HEALTH BAND - SMARTWATCH PAIRING READY        ");
  Serial.println("=============================================================");
  Serial.printf ("  DEVICE ID   : %s\n", DEVICE_ID);
  Serial.printf ("  TOKEN ID    : %s\n", activeToken);
  Serial.printf ("  URL PAIRING : https://%s/?pair=%s\n", API_HOST, activeToken);
  Serial.println("=============================================================");
  Serial.println("👉 Klik link URL PAIRING di atas untuk langsung menghubungkan ke Chrome!\n");
  Serial.println("[INFO] Jam tangan dalam status STANDBY menunggu pairing dari Web.");
  Serial.println("[INFO] Tekan tombol hijau OK atau ketik 'ok' di Serial untuk bypass manual.");
  Serial.println("[INFO] Ketik 'qr' di Serial Monitor untuk menampilkan QR Code lagi.\n");

  mpuOk = initMpu();
  Serial.println(mpuOk ? "[MPU6050] OK" : "[MPU6050] TIDAK TERDETEKSI - deteksi jatuh nonaktif");
  dht.begin();

  evtQ = xQueueCreate(12, sizeof(NetMsg));
  telQ = xQueueCreate(2, sizeof(NetMsg));

  Serial.print("[WiFi] Menghubungkan ke ");
  Serial.print(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int wifiWait = 0;
  while (WiFi.status() != WL_CONNECTED && wifiWait < 30) {
    delay(200);
    Serial.print(".");
    wifiWait++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(" Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Menyambung di latar belakang...");
  }
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");

  xTaskCreatePinnedToCore(netTask, "net", 12288, NULL, 1, NULL, 0);
}

void loop() {
  unsigned long now = millis();
  static unsigned long lastImu = 0, lastHr = 0, lastDht = 0, lastSmoke = 0, lastUi = 0, lastTel = 0, lastQr = 0;

  handleSerial();

  // Tombol OK: Jika belum paired, menekan OK mem-bypass manual ke status operasional aktif
  if (btnEdge(btnOk)) {
    if (!isPaired) {
      activateBypass();
      return;
    } else {
      onOkPressed();
    }
  }

  // Jika jam tangan BELUM PAIRED dengan web:
  // Tetap diam di layar QR Code, jangan jalankan detak jantung / alarm / telemetri!
  if (!isPaired) {
    if (now - lastQr >= 2000) {
      lastQr = now;
      drawQrCodeScreen();
    }
    delay(20);
    return;
  }

  // Tombol SOS hanya aktif saat jam sudah operasional
  if (btnEdge(btnSos)) raiseAlert(K_SOS, 0, "CRITICAL", false);

  // --- IMU 50 Hz: langkah, aktivitas, jatuh ---
  if (mpuOk && now - lastImu >= 20) {
    lastImu = now;
    float ax, ay, az;
    if (readAccel(ax, ay, az)) {
      float g = sqrtf(ax * ax + ay * ay + az * az);
      lastG = g;
      motionEma = 0.98f * motionEma + 0.02f * fabsf(g - 1.0f);
      isActive = (motionEma > ACTIVE_MOTION) || (lastStepAt > 0 && now - lastStepAt < 5000UL);
      processSteps(g, now);
      processFall(g, now);
    }
  }

  // --- HR 10 Hz ---
  if (now - lastHr >= 100) {
    lastHr = now;
    float target = (hrOverride > 0) ? (float)hrOverride : (float)map(analogRead(POT_PIN), 0, 4095, 45, 150);
    hrEma += 0.15f * (target - hrEma);
    hrNow = (int)(hrEma + 0.5f);
    evalHr(now);
  }

  // --- DHT22 (interval 2.5 dtk) ---
  if (now - lastDht >= 2500) {
    lastDht = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    dhtOk = !(isnan(t) || isnan(h));
    if (dhtOk) { roomTemp = t; roomHum = h; }
  }

  // --- MQ-2 5 Hz ---
  if (now - lastSmoke >= 200) {
    lastSmoke = now;
    float target = simSmoke ? 3500.0f : (float)analogRead(SMOKE_PIN);
    smokeEma += 0.3f * (target - smokeEma);
    evalHome();
  }

  // --- Tombol Fisik ---
  if (btnEdge(btnSos)) raiseAlert(K_SOS, 0, "CRITICAL", false);
  if (btnEdge(btnOk))  onOkPressed();

  updateAlertLogic(now);
  updateBuzzer(now);

  if (now - lastUi >= 250) { lastUi = now; drawUI(now); }
  if (now - lastTel >= 3000) { lastTel = now; sendTelemetry(); }
}
