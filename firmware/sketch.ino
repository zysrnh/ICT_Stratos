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
// Embedded QR Code engine included below

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
#define USE_HTTPS 1
#define API_HOST "ict.hmif-lpkia.my.id"
#if USE_HTTPS
  #define API_BASE "https://" API_HOST
#else
  #define API_BASE "http://" API_HOST
#endif
const char* URL_TELEMETRY = API_BASE "/api/telemetry";
const char* URL_EVENTS    = API_BASE "/api/events";
char activeToken[32]      = "HUAWEI-ECA-8821";   // Token ID Perangkat (Di-generate dinamis saat boot)
bool isPaired             = false;                // False: Standby di layar QR | True: Aktif monitoring
char pairedPatientName[64]= "Opa Budi Santoso";  // Nama lansia hasil pairing dari web

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
// Tampilan QR Code Layar Penuh SSD1306 (ESP32 Built-in esp_qrcode)
// ==========================================


// ================= EMBEDDED QR ENGINE (RICMOO/QRCODE) =================
/**
 * The MIT License (MIT)
 *
 * This library is written and maintained by Richard Moore.
 * Major parts were derived from Project Nayuki's library.
 *
 * Copyright (c) 2017 Richard Moore     (https://github.com/ricmoo/QRCode)
 * Copyright (c) 2017 Project Nayuki    (https://www.nayuki.io/page/qr-code-generator-library)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 *  Special thanks to Nayuki (https://www.nayuki.io/) from which this library was
 *  heavily inspired and compared against.
 *
 *  See: https://github.com/nayuki/QR-Code-generator/tree/master/cpp
 */


#ifndef __QRCODE_H_
#define __QRCODE_H_

#ifndef __cplusplus
typedef unsigned char bool;
static const bool false = 0;
static const bool true = 1;
#endif

#include <stdint.h>


// QR Code Format Encoding
#define MODE_NUMERIC        0
#define MODE_ALPHANUMERIC   1
#define MODE_BYTE           2


// Error Correction Code Levels
#define ECC_LOW            0
#define ECC_MEDIUM         1
#define ECC_QUARTILE       2
#define ECC_HIGH           3


// If set to non-zero, this library can ONLY produce QR codes at that version
// This saves a lot of dynamic memory, as the codeword tables are skipped
#ifndef LOCK_VERSION
#define LOCK_VERSION       0
#endif


typedef struct QRCode {
    uint8_t version;
    uint8_t size;
    uint8_t ecc;
    uint8_t mode;
    uint8_t mask;
    uint8_t *modules;
} QRCode;


#ifdef __cplusplus
extern "C"{
#endif  /* __cplusplus */



uint16_t qrcode_getBufferSize(uint8_t version);

int8_t qrcode_initText(QRCode *qrcode, uint8_t *modules, uint8_t version, uint8_t ecc, const char *data);
int8_t qrcode_initBytes(QRCode *qrcode, uint8_t *modules, uint8_t version, uint8_t ecc, uint8_t *data, uint16_t length);

bool qrcode_getModule(QRCode *qrcode, uint8_t x, uint8_t y);



#ifdef __cplusplus
}
#endif  /* __cplusplus */


#endif  /* __QRCODE_H_ */

/**
 * The MIT License (MIT)
 *
 * This library is written and maintained by Richard Moore.
 * Major parts were derived from Project Nayuki's library.
 *
 * Copyright (c) 2017 Richard Moore     (https://github.com/ricmoo/QRCode)
 * Copyright (c) 2017 Project Nayuki    (https://www.nayuki.io/page/qr-code-generator-library)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 *  Special thanks to Nayuki (https://www.nayuki.io/) from which this library was
 *  heavily inspired and compared against.
 *
 *  See: https://github.com/nayuki/QR-Code-generator/tree/master/cpp
 */



#include <stdlib.h>
#include <string.h>

#pragma mark - Error Correction Lookup tables

#if LOCK_VERSION == 0

static const uint16_t NUM_ERROR_CORRECTION_CODEWORDS[4][40] = {
    // 1,  2,  3,  4,  5,   6,   7,   8,   9,  10,  11,  12,  13,  14,  15,  16,  17,  18,  19,  20,  21,  22,  23,  24,   25,   26,   27,   28,   29,   30,   31,   32,   33,   34,   35,   36,   37,   38,   39,   40    Error correction level
    { 10, 16, 26, 36, 48,  64,  72,  88, 110, 130, 150, 176, 198, 216, 240, 280, 308, 338, 364, 416, 442, 476, 504, 560,  588,  644,  700,  728,  784,  812,  868,  924,  980, 1036, 1064, 1120, 1204, 1260, 1316, 1372},  // Medium
    {  7, 10, 15, 20, 26,  36,  40,  48,  60,  72,  80,  96, 104, 120, 132, 144, 168, 180, 196, 224, 224, 252, 270, 300,  312,  336,  360,  390,  420,  450,  480,  510,  540,  570,  570,  600,  630,  660,  720,  750},  // Low
    { 17, 28, 44, 64, 88, 112, 130, 156, 192, 224, 264, 308, 352, 384, 432, 480, 532, 588, 650, 700, 750, 816, 900, 960, 1050, 1110, 1200, 1260, 1350, 1440, 1530, 1620, 1710, 1800, 1890, 1980, 2100, 2220, 2310, 2430},  // High
    { 13, 22, 36, 52, 72,  96, 108, 132, 160, 192, 224, 260, 288, 320, 360, 408, 448, 504, 546, 600, 644, 690, 750, 810,  870,  952, 1020, 1050, 1140, 1200, 1290, 1350, 1440, 1530, 1590, 1680, 1770, 1860, 1950, 2040},  // Quartile
};

static const uint8_t NUM_ERROR_CORRECTION_BLOCKS[4][40] = {
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    // 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    {  1, 1, 1, 2, 2, 4, 4, 4, 5, 5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49},  // Medium
    {  1, 1, 1, 1, 1, 2, 2, 2, 2, 4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25},  // Low
    {  1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81},  // High
    {  1, 1, 2, 2, 4, 4, 6, 6, 8, 8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68},  // Quartile
};

static const uint16_t NUM_RAW_DATA_MODULES[40] = {
    //  1,   2,   3,   4,    5,    6,    7,    8,    9,   10,   11,   12,   13,   14,   15,   16,   17,
      208, 359, 567, 807, 1079, 1383, 1568, 1936, 2336, 2768, 3232, 3728, 4256, 4651, 5243, 5867, 6523,
    //   18,   19,   20,   21,    22,    23,    24,    25,   26,    27,     28,    29,    30,    31,
       7211, 7931, 8683, 9252, 10068, 10916, 11796, 12708, 13652, 14628, 15371, 16411, 17483, 18587,
    //    32,    33,    34,    35,    36,    37,    38,    39,    40
       19723, 20891, 22091, 23008, 24272, 25568, 26896, 28256, 29648
};

// @TODO: Put other LOCK_VERSIONS here
#elif LOCK_VERSION == 3

static const int16_t NUM_ERROR_CORRECTION_CODEWORDS[4] = {
    26, 15, 44, 36
};

static const int8_t NUM_ERROR_CORRECTION_BLOCKS[4] = {
    1, 1, 2, 2
};

static const uint16_t NUM_RAW_DATA_MODULES = 567;

#else

#error Unsupported LOCK_VERSION (add it...)

#endif


static int max(int a, int b) {
    if (a > b) { return a; }
    return b;
}

/*
static int abs(int value) {
    if (value < 0) { return -value; }
    return value;
}
*/


#pragma mark - Mode testing and conversion

static int8_t getAlphanumeric(char c) {
    
    if (c >= '0' && c <= '9') { return (c - '0'); }
    if (c >= 'A' && c <= 'Z') { return (c - 'A' + 10); }
    
    switch (c) {
        case ' ': return 36;
        case '
  display.clearDisplay();
  
  // Header bar solid
  display.fillRect(0, 0, 128, 10, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(4, 1);
  display.print("HUAWEI BAND PAIRING");

  // Inisialisasi QR Code Dinamis (Embedded ricmoo QRCode Version 2: 25x25)
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(2)];
  qrcode_initText(&qrcode, qrcodeData, 2, ECC_LOW, activeToken);

  int scale = 2;
  int offsetX = 4;
  int offsetY = 12;

  // Gambar modul QR Code di sisi kiri OLED (50x50 px)
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        display.fillRect(offsetX + (x * scale), offsetY + (y * scale), scale, scale, SSD1306_WHITE);
      }
    }
  }

  // Informasi teks token di sisi kanan OLED (X: 58 s.d 127)
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
  display.print(isPaired ? "AKTIF" : "WAIT WEB");

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
  if (WiFi.status() != WL_CONNECTED) return false;

#if USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();
#else
  WiFiClient client;
#endif
  HTTPClient http;
  String url = String(API_BASE) + "/api/device/check-pair?token=" + activeToken;
  http.begin(client, url);
  http.setConnectTimeout(2500);
  http.setTimeout(3000);
  int httpCode = http.GET();
  bool paired = false;
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    deserializeJson(doc, payload);
    if (doc["paired"].as<bool>()) {
      paired = true;
      const char* pName = doc["patient_name"];
      if (pName && strlen(pName) > 0) {
        strlcpy(pairedPatientName, pName, sizeof(pairedPatientName));
      }
    }
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
  d["patient_id"] = PATIENT_ID;
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
  char buf[400];

  // --- Perangkat 1: Jam Pintar ---
  {
    StaticJsonDocument<512> d;
    d["device_id"]      = DEVICE_ID;
    d["patient_id"]     = PATIENT_ID;
    d["device_type"]    = "watch";
    d["heart_rate"]     = hrNow;
    d["activity"]       = isActive ? "ACTIVE" : "REST";
    d["steps"]          = steps;
    d["accel_g"]        = lastG;
    d["health_status"]  = healthStatus();
    d["fall_cancelled"] = cancelledCount;
    d["sensor_ok"]      = mpuOk;
    d["sim"]            = (hrOverride > 0);
    d["wifi_rssi"]      = WiFi.RSSI();
    d["ts"]             = epochNow();
    d["uptime_s"]       = millis() / 1000;
    serializeJson(d, buf, sizeof(buf));
    enqueueMsg(telQ, buf);
  }

  // --- Perangkat 2: Node Rumah ---
  {
    StaticJsonDocument<512> d;
    d["device_id"]    = HOME_DEVICE_ID;
    d["patient_id"]   = PATIENT_ID;
    d["device_type"]  = "home";
    if (dhtOk) { d["room_temp"] = roomTemp; d["humidity"] = roomHum; }
    else       { d["room_temp"] = nullptr;  d["humidity"] = nullptr; }
    d["smoke_adc"]    = (int)smokeEma;
    d["smoke_status"] = (curKind == K_SMOKE) ? "ALERT" : "NORMAL";
    d["sensor_ok"]    = dhtOk;
    d["sim"]          = simSmoke;
    d["ts"]           = epochNow();
    d["uptime_s"]     = millis() / 1000;
    serializeJson(d, buf, sizeof(buf));
    enqueueMsg(telQ, buf);
  }

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
      if ((code >= 200 && code < 300) || (code >= 400 && code < 500)) {
        xQueueReceive(evtQ, &m, 0);
      } else {
        vTaskDelay(pdMS_TO_TICKS(1500));
      }
      continue;
    }
    if (xQueueReceive(telQ, &m, pdMS_TO_TICKS(200)) == pdTRUE) postJson(URL_TELEMETRY, m.body);
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
  if (phase == P_VERIFY) { cancelledCount++; clearAlert("CANCELLED"); }
  else if (phase == P_ESCALATED && curKind != K_SMOKE) clearAlert("RESOLVED");
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
void runCmd(char* s) {
  if      (!strcmp(s, "fall"))  { raiseAlert(K_FALL, 3.0f, "CRITICAL", true); }
  else if (!strcmp(s, "sos"))   { raiseAlert(K_SOS, 0, "CRITICAL", true); }
  else if (!strcmp(s, "smoke")) { simSmoke = true; }
  else if (!strcmp(s, "clear")) { simSmoke = false; }
  else if (!strcmp(s, "ok") || !strcmp(s, "bypass")) {
    isPaired = true;
    Serial.println("[PAIRING] Manual bypass via serial command!");
    drawWelcomeScreen();
    delay(1500);
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

  // Otomatis generate Token ID Unik Baru (acak) setiap kali ESP32 dinyalakan / di-reset!
  snprintf(activeToken, sizeof(activeToken), "HUAWEI-ECA-%04X", (unsigned)(esp_random() & 0xFFFF));

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

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);
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
      isPaired = true;
      Serial.println("[PAIRING] Manual bypass via tombol OK ditekan!");
      drawWelcomeScreen();
      delay(1500);
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
: return 37;
        case '%': return 38;
        case '*': return 39;
        case '+': return 40;
        case '-': return 41;
        case '.': return 42;
        case '/': return 43;
        case ':': return 44;
    }
    
    return -1;
}

static bool isAlphanumeric(const char *text, uint16_t length) {
    while (length != 0) {
        if (getAlphanumeric(text[--length]) == -1) { return false; }
    }
    return true;
}


static bool isNumeric(const char *text, uint16_t length) {
    while (length != 0) {
        char c = text[--length];
        if (c < '0' || c > '9') { return false; }
    }
    return true;
}


#pragma mark - Counting

// We store the following tightly packed (less 8) in modeInfo
//               <=9  <=26  <= 40
// NUMERIC      ( 10,   12,    14);
// ALPHANUMERIC (  9,   11,    13);
// BYTE         (  8,   16,    16);
static char getModeBits(uint8_t version, uint8_t mode) {
    // Note: We use 15 instead of 16; since 15 doesn't exist and we cannot store 16 (8 + 8) in 3 bits
    // hex(int("".join(reversed([('00' + bin(x - 8)[2:])[-3:] for x in [10, 9, 8, 12, 11, 15, 14, 13, 15]])), 2))
    unsigned int modeInfo = 0x7bbb80a;
    
#if LOCK_VERSION == 0 || LOCK_VERSION > 9
    if (version > 9) { modeInfo >>= 9; }
#endif
    
#if LOCK_VERSION == 0 || LOCK_VERSION > 26
    if (version > 26) { modeInfo >>= 9; }
#endif
    
    char result = 8 + ((modeInfo >> (3 * mode)) & 0x07);
    if (result == 15) { result = 16; }
    
    return result;
}


#pragma mark - BitBucket

typedef struct BitBucket {
    uint32_t bitOffsetOrWidth;
    uint16_t capacityBytes;
    uint8_t *data;
} BitBucket;

/*
void bb_dump(BitBucket *bitBuffer) {
    printf("Buffer: ");
    for (uint32_t i = 0; i < bitBuffer->capacityBytes; i++) {
        printf("%02x", bitBuffer->data[i]);
        if ((i % 4) == 3) { printf(" "); }
    }
    printf("\n");
}
*/

static uint16_t bb_getGridSizeBytes(uint8_t size) {
    return (((size * size) + 7) / 8);
}

static uint16_t bb_getBufferSizeBytes(uint32_t bits) {
    return ((bits + 7) / 8);
}

static void bb_initBuffer(BitBucket *bitBuffer, uint8_t *data, int32_t capacityBytes) {
    bitBuffer->bitOffsetOrWidth = 0;
    bitBuffer->capacityBytes = capacityBytes;
    bitBuffer->data = data;
    
    memset(data, 0, bitBuffer->capacityBytes);
}

static void bb_initGrid(BitBucket *bitGrid, uint8_t *data, uint8_t size) {
    bitGrid->bitOffsetOrWidth = size;
    bitGrid->capacityBytes = bb_getGridSizeBytes(size);
    bitGrid->data = data;

    memset(data, 0, bitGrid->capacityBytes);
}

static void bb_appendBits(BitBucket *bitBuffer, uint32_t val, uint8_t length) {
    uint32_t offset = bitBuffer->bitOffsetOrWidth;
    for (int8_t i = length - 1; i >= 0; i--, offset++) {
        bitBuffer->data[offset >> 3] |= ((val >> i) & 1) << (7 - (offset & 7));
    }
    bitBuffer->bitOffsetOrWidth = offset;
}
/*
void bb_setBits(BitBucket *bitBuffer, uint32_t val, int offset, uint8_t length) {
    for (int8_t i = length - 1; i >= 0; i--, offset++) {
        bitBuffer->data[offset >> 3] |= ((val >> i) & 1) << (7 - (offset & 7));
    }
}
*/
static void bb_setBit(BitBucket *bitGrid, uint8_t x, uint8_t y, bool on) {
    uint32_t offset = y * bitGrid->bitOffsetOrWidth + x;
    uint8_t mask = 1 << (7 - (offset & 0x07));
    if (on) {
        bitGrid->data[offset >> 3] |= mask;
    } else {
        bitGrid->data[offset >> 3] &= ~mask;
    }
}

static void bb_invertBit(BitBucket *bitGrid, uint8_t x, uint8_t y, bool invert) {
    uint32_t offset = y * bitGrid->bitOffsetOrWidth + x;
    uint8_t mask = 1 << (7 - (offset & 0x07));
    bool on = ((bitGrid->data[offset >> 3] & (1 << (7 - (offset & 0x07)))) != 0);
    if (on ^ invert) {
        bitGrid->data[offset >> 3] |= mask;
    } else {
        bitGrid->data[offset >> 3] &= ~mask;
    }
}

static bool bb_getBit(BitBucket *bitGrid, uint8_t x, uint8_t y) {
    uint32_t offset = y * bitGrid->bitOffsetOrWidth + x;
    return (bitGrid->data[offset >> 3] & (1 << (7 - (offset & 0x07)))) != 0;
}


#pragma mark - Drawing Patterns

// XORs the data modules in this QR Code with the given mask pattern. Due to XOR's mathematical
// properties, calling applyMask(m) twice with the same value is equivalent to no change at all.
// This means it is possible to apply a mask, undo it, and try another mask. Note that a final
// well-formed QR Code symbol needs exactly one mask applied (not zero, not two, etc.).
static void applyMask(BitBucket *modules, BitBucket *isFunction, uint8_t mask) {
    uint8_t size = modules->bitOffsetOrWidth;
    
    for (uint8_t y = 0; y < size; y++) {
        for (uint8_t x = 0; x < size; x++) {
            if (bb_getBit(isFunction, x, y)) { continue; }
            
            bool invert = 0;
            switch (mask) {
                case 0:  invert = (x + y) % 2 == 0;                    break;
                case 1:  invert = y % 2 == 0;                          break;
                case 2:  invert = x % 3 == 0;                          break;
                case 3:  invert = (x + y) % 3 == 0;                    break;
                case 4:  invert = (x / 3 + y / 2) % 2 == 0;            break;
                case 5:  invert = x * y % 2 + x * y % 3 == 0;          break;
                case 6:  invert = (x * y % 2 + x * y % 3) % 2 == 0;    break;
                case 7:  invert = ((x + y) % 2 + x * y % 3) % 2 == 0;  break;
            }
            bb_invertBit(modules, x, y, invert);
        }
    }
}

static void setFunctionModule(BitBucket *modules, BitBucket *isFunction, uint8_t x, uint8_t y, bool on) {
    bb_setBit(modules, x, y, on);
    bb_setBit(isFunction, x, y, true);
}

// Draws a 9*9 finder pattern including the border separator, with the center module at (x, y).
static void drawFinderPattern(BitBucket *modules, BitBucket *isFunction, uint8_t x, uint8_t y) {
    uint8_t size = modules->bitOffsetOrWidth;

    for (int8_t i = -4; i <= 4; i++) {
        for (int8_t j = -4; j <= 4; j++) {
            uint8_t dist = max(abs(i), abs(j));  // Chebyshev/infinity norm
            int16_t xx = x + j, yy = y + i;
            if (0 <= xx && xx < size && 0 <= yy && yy < size) {
                setFunctionModule(modules, isFunction, xx, yy, dist != 2 && dist != 4);
            }
        }
    }
}

// Draws a 5*5 alignment pattern, with the center module at (x, y).
static void drawAlignmentPattern(BitBucket *modules, BitBucket *isFunction, uint8_t x, uint8_t y) {
    for (int8_t i = -2; i <= 2; i++) {
        for (int8_t j = -2; j <= 2; j++) {
            setFunctionModule(modules, isFunction, x + j, y + i, max(abs(i), abs(j)) != 1);
        }
    }
}

// Draws two copies of the format bits (with its own error correction code)
// based on the given mask and this object's error correction level field.
static void drawFormatBits(BitBucket *modules, BitBucket *isFunction, uint8_t ecc, uint8_t mask) {
    
    uint8_t size = modules->bitOffsetOrWidth;

    // Calculate error correction code and pack bits
    uint32_t data = ecc << 3 | mask;  // errCorrLvl is uint2, mask is uint3
    uint32_t rem = data;
    for (int i = 0; i < 10; i++) {
        rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    }
    
    data = data << 10 | rem;
    data ^= 0x5412;  // uint15
    
    // Draw first copy
    for (uint8_t i = 0; i <= 5; i++) {
        setFunctionModule(modules, isFunction, 8, i, ((data >> i) & 1) != 0);
    }
    
    setFunctionModule(modules, isFunction, 8, 7, ((data >> 6) & 1) != 0);
    setFunctionModule(modules, isFunction, 8, 8, ((data >> 7) & 1) != 0);
    setFunctionModule(modules, isFunction, 7, 8, ((data >> 8) & 1) != 0);
    
    for (int8_t i = 9; i < 15; i++) {
        setFunctionModule(modules, isFunction, 14 - i, 8, ((data >> i) & 1) != 0);
    }
    
    // Draw second copy
    for (int8_t i = 0; i <= 7; i++) {
        setFunctionModule(modules, isFunction, size - 1 - i, 8, ((data >> i) & 1) != 0);
    }
    
    for (int8_t i = 8; i < 15; i++) {
        setFunctionModule(modules, isFunction, 8, size - 15 + i, ((data >> i) & 1) != 0);
    }
    
    setFunctionModule(modules, isFunction, 8, size - 8, true);
}


// Draws two copies of the version bits (with its own error correction code),
// based on this object's version field (which only has an effect for 7 <= version <= 40).
static void drawVersion(BitBucket *modules, BitBucket *isFunction, uint8_t version) {
    
    int8_t size = modules->bitOffsetOrWidth;

#if LOCK_VERSION != 0 && LOCK_VERSION < 7
    return;
    
#else
    if (version < 7) { return; }
    
    // Calculate error correction code and pack bits
    uint32_t rem = version;  // version is uint6, in the range [7, 40]
    for (uint8_t i = 0; i < 12; i++) {
        rem = (rem << 1) ^ ((rem >> 11) * 0x1F25);
    }
    
    uint32_t data = version << 12 | rem;  // uint18
    
    // Draw two copies
    for (uint8_t i = 0; i < 18; i++) {
        bool bit = ((data >> i) & 1) != 0;
        uint8_t a = size - 11 + i % 3, b = i / 3;
        setFunctionModule(modules, isFunction, a, b, bit);
        setFunctionModule(modules, isFunction, b, a, bit);
    }
    
#endif
}

static void drawFunctionPatterns(BitBucket *modules, BitBucket *isFunction, uint8_t version, uint8_t ecc) {
    
    uint8_t size = modules->bitOffsetOrWidth;

    // Draw the horizontal and vertical timing patterns
    for (uint8_t i = 0; i < size; i++) {
        setFunctionModule(modules, isFunction, 6, i, i % 2 == 0);
        setFunctionModule(modules, isFunction, i, 6, i % 2 == 0);
    }
    
    // Draw 3 finder patterns (all corners except bottom right; overwrites some timing modules)
    drawFinderPattern(modules, isFunction, 3, 3);
    drawFinderPattern(modules, isFunction, size - 4, 3);
    drawFinderPattern(modules, isFunction, 3, size - 4);
    
#if LOCK_VERSION == 0 || LOCK_VERSION > 1

    if (version > 1) {

        // Draw the numerous alignment patterns
        
        uint8_t alignCount = version / 7 + 2;
        uint8_t step;
        if (version != 32) {
            step = (version * 4 + alignCount * 2 + 1) / (2 * alignCount - 2) * 2;  // ceil((size - 13) / (2*numAlign - 2)) * 2
        } else { // C-C-C-Combo breaker!
            step = 26;
        }
        
        uint8_t alignPositionIndex = alignCount - 1;
        uint8_t alignPosition[alignCount];
        
        alignPosition[0] = 6;
        
        uint8_t size = version * 4 + 17;
        for (uint8_t i = 0, pos = size - 7; i < alignCount - 1; i++, pos -= step) {
            alignPosition[alignPositionIndex--] = pos;
        }
        
        for (uint8_t i = 0; i < alignCount; i++) {
            for (uint8_t j = 0; j < alignCount; j++) {
                if ((i == 0 && j == 0) || (i == 0 && j == alignCount - 1) || (i == alignCount - 1 && j == 0)) {
                    continue;  // Skip the three finder corners
                } else {
                    drawAlignmentPattern(modules, isFunction, alignPosition[i], alignPosition[j]);
                }
            }
        }
    }
    
#endif
    
    // Draw configuration data
    drawFormatBits(modules, isFunction, ecc, 0);  // Dummy mask value; overwritten later in the constructor
    drawVersion(modules, isFunction, version);
}


// Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
// data area of this QR Code symbol. Function modules need to be marked off before this is called.
static void drawCodewords(BitBucket *modules, BitBucket *isFunction, BitBucket *codewords) {
    
    uint32_t bitLength = codewords->bitOffsetOrWidth;
    uint8_t *data = codewords->data;
    
    uint8_t size = modules->bitOffsetOrWidth;
    
    // Bit index into the data
    uint32_t i = 0;
    
    // Do the funny zigzag scan
    for (int16_t right = size - 1; right >= 1; right -= 2) {  // Index of right column in each column pair
        if (right == 6) { right = 5; }
        
        for (uint8_t vert = 0; vert < size; vert++) {  // Vertical counter
            for (int j = 0; j < 2; j++) {
                uint8_t x = right - j;  // Actual x coordinate
                bool upwards = ((right & 2) == 0) ^ (x < 6);
                uint8_t y = upwards ? size - 1 - vert : vert;  // Actual y coordinate
                if (!bb_getBit(isFunction, x, y) && i < bitLength) {
                    bb_setBit(modules, x, y, ((data[i >> 3] >> (7 - (i & 7))) & 1) != 0);
                    i++;
                }
                // If there are any remainder bits (0 to 7), they are already
                // set to 0/false/white when the grid of modules was initialized
            }
        }
    }
}



#pragma mark - Penalty Calculation

#define PENALTY_N1      3
#define PENALTY_N2      3
#define PENALTY_N3     40
#define PENALTY_N4     10

// Calculates and returns the penalty score based on state of this QR Code's current modules.
// This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
// @TODO: This can be optimized by working with the bytes instead of bits.
static uint32_t getPenaltyScore(BitBucket *modules) {
    uint32_t result = 0;
    
    uint8_t size = modules->bitOffsetOrWidth;
    
    // Adjacent modules in row having same color
    for (uint8_t y = 0; y < size; y++) {
        
        bool colorX = bb_getBit(modules, 0, y);
        for (uint8_t x = 1, runX = 1; x < size; x++) {
            bool cx = bb_getBit(modules, x, y);
            if (cx != colorX) {
                colorX = cx;
                runX = 1;
                
            } else {
                runX++;
                if (runX == 5) {
                    result += PENALTY_N1;
                } else if (runX > 5) {
                    result++;
                }
            }
        }
    }
    
    // Adjacent modules in column having same color
    for (uint8_t x = 0; x < size; x++) {
        bool colorY = bb_getBit(modules, x, 0);
        for (uint8_t y = 1, runY = 1; y < size; y++) {
            bool cy = bb_getBit(modules, x, y);
            if (cy != colorY) {
                colorY = cy;
                runY = 1;
            } else {
                runY++;
                if (runY == 5) {
                    result += PENALTY_N1;
                } else if (runY > 5) {
                    result++;
                }
            }
        }
    }
    
    uint16_t black = 0;
    for (uint8_t y = 0; y < size; y++) {
        uint16_t bitsRow = 0, bitsCol = 0;
        for (uint8_t x = 0; x < size; x++) {
            bool color = bb_getBit(modules, x, y);

            // 2*2 blocks of modules having same color
            if (x > 0 && y > 0) {
                bool colorUL = bb_getBit(modules, x - 1, y - 1);
                bool colorUR = bb_getBit(modules, x, y - 1);
                bool colorL = bb_getBit(modules, x - 1, y);
                if (color == colorUL && color == colorUR && color == colorL) {
                    result += PENALTY_N2;
                }
            }

            // Finder-like pattern in rows and columns
            bitsRow = ((bitsRow << 1) & 0x7FF) | color;
            bitsCol = ((bitsCol << 1) & 0x7FF) | bb_getBit(modules, y, x);

            // Needs 11 bits accumulated
            if (x >= 10) {
                if (bitsRow == 0x05D || bitsRow == 0x5D0) {
                    result += PENALTY_N3;
                }
                if (bitsCol == 0x05D || bitsCol == 0x5D0) {
                    result += PENALTY_N3;
                }
            }

            // Balance of black and white modules
            if (color) { black++; }
        }
    }

    // Find smallest k such that (45-5k)% <= dark/total <= (55+5k)%
    uint16_t total = size * size;
    for (uint16_t k = 0; black * 20 < (9 - k) * total || black * 20 > (11 + k) * total; k++) {
        result += PENALTY_N4;
    }
    
    return result;
}


#pragma mark - Reed-Solomon Generator

static uint8_t rs_multiply(uint8_t x, uint8_t y) {
    // Russian peasant multiplication
    // See: https://en.wikipedia.org/wiki/Ancient_Egyptian_multiplication
    uint16_t z = 0;
    for (int8_t i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >> 7) * 0x11D);
        z ^= ((y >> i) & 1) * x;
    }
    return z;
}

static void rs_init(uint8_t degree, uint8_t *coeff) {
    memset(coeff, 0, degree);
    coeff[degree - 1] = 1;
    
    // Compute the product polynomial (x - r^0) * (x - r^1) * (x - r^2) * ... * (x - r^{degree-1}),
    // drop the highest term, and store the rest of the coefficients in order of descending powers.
    // Note that r = 0x02, which is a generator element of this field GF(2^8/0x11D).
    uint16_t root = 1;
    for (uint8_t i = 0; i < degree; i++) {
        // Multiply the current product by (x - r^i)
        for (uint8_t j = 0; j < degree; j++) {
            coeff[j] = rs_multiply(coeff[j], root);
            if (j + 1 < degree) {
                coeff[j] ^= coeff[j + 1];
            }
        }
        root = (root << 1) ^ ((root >> 7) * 0x11D);  // Multiply by 0x02 mod GF(2^8/0x11D)
    }
}

static void rs_getRemainder(uint8_t degree, uint8_t *coeff, uint8_t *data, uint8_t length, uint8_t *result, uint8_t stride) {
    // Compute the remainder by performing polynomial division
    
    //for (uint8_t i = 0; i < degree; i++) { result[] = 0; }
    //memset(result, 0, degree);
    
    for (uint8_t i = 0; i < length; i++) {
        uint8_t factor = data[i] ^ result[0];
        for (uint8_t j = 1; j < degree; j++) {
            result[(j - 1) * stride] = result[j * stride];
        }
        result[(degree - 1) * stride] = 0;
        
        for (uint8_t j = 0; j < degree; j++) {
            result[j * stride] ^= rs_multiply(coeff[j], factor);
        }
    }
}



#pragma mark - QrCode

static int8_t encodeDataCodewords(BitBucket *dataCodewords, const uint8_t *text, uint16_t length, uint8_t version) {
    int8_t mode = MODE_BYTE;
    
    if (isNumeric((char*)text, length)) {
        mode = MODE_NUMERIC;
        bb_appendBits(dataCodewords, 1 << MODE_NUMERIC, 4);
        bb_appendBits(dataCodewords, length, getModeBits(version, MODE_NUMERIC));

        uint16_t accumData = 0;
        uint8_t accumCount = 0;
        for (uint16_t i = 0; i < length; i++) {
            accumData = accumData * 10 + ((char)(text[i]) - '0');
            accumCount++;
            if (accumCount == 3) {
                bb_appendBits(dataCodewords, accumData, 10);
                accumData = 0;
                accumCount = 0;
            }
        }
        
        // 1 or 2 digits remaining
        if (accumCount > 0) {
            bb_appendBits(dataCodewords, accumData, accumCount * 3 + 1);
        }
        
    } else if (isAlphanumeric((char*)text, length)) {
        mode = MODE_ALPHANUMERIC;
        bb_appendBits(dataCodewords, 1 << MODE_ALPHANUMERIC, 4);
        bb_appendBits(dataCodewords, length, getModeBits(version, MODE_ALPHANUMERIC));

        uint16_t accumData = 0;
        uint8_t accumCount = 0;
        for (uint16_t i = 0; i  < length; i++) {
            accumData = accumData * 45 + getAlphanumeric((char)(text[i]));
            accumCount++;
            if (accumCount == 2) {
                bb_appendBits(dataCodewords, accumData, 11);
                accumData = 0;
                accumCount = 0;
            }
        }
        
        // 1 character remaining
        if (accumCount > 0) {
            bb_appendBits(dataCodewords, accumData, 6);
        }
        
    } else {
        bb_appendBits(dataCodewords, 1 << MODE_BYTE, 4);
        bb_appendBits(dataCodewords, length, getModeBits(version, MODE_BYTE));
        for (uint16_t i = 0; i < length; i++) {
            bb_appendBits(dataCodewords, (char)(text[i]), 8);
        }
    }
    
    //bb_setBits(dataCodewords, length, 4, getModeBits(version, mode));
    
    return mode;
}

static void performErrorCorrection(uint8_t version, uint8_t ecc, BitBucket *data) {
    
    // See: http://www.thonky.com/qr-code-tutorial/structure-final-message
    
#if LOCK_VERSION == 0
    uint8_t numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc][version - 1];
    uint16_t totalEcc = NUM_ERROR_CORRECTION_CODEWORDS[ecc][version - 1];
    uint16_t moduleCount = NUM_RAW_DATA_MODULES[version - 1];
#else
    uint8_t numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc];
    uint16_t totalEcc = NUM_ERROR_CORRECTION_CODEWORDS[ecc];
    uint16_t moduleCount = NUM_RAW_DATA_MODULES;
#endif
    
    uint8_t blockEccLen = totalEcc / numBlocks;
    uint8_t numShortBlocks = numBlocks - moduleCount / 8 % numBlocks;
    uint8_t shortBlockLen = moduleCount / 8 / numBlocks;
    
    uint8_t shortDataBlockLen = shortBlockLen - blockEccLen;
    
    uint8_t result[data->capacityBytes];
    memset(result, 0, sizeof(result));
    
    uint8_t coeff[blockEccLen];
    rs_init(blockEccLen, coeff);
    
    uint16_t offset = 0;
    uint8_t *dataBytes = data->data;
    
    
    // Interleave all short blocks
    for (uint8_t i = 0; i < shortDataBlockLen; i++) {
        uint16_t index = i;
        uint8_t stride = shortDataBlockLen;
        for (uint8_t blockNum = 0; blockNum < numBlocks; blockNum++) {
            result[offset++] = dataBytes[index];
            
#if LOCK_VERSION == 0 || LOCK_VERSION >= 5
            if (blockNum == numShortBlocks) { stride++; }
#endif
            index += stride;
        }
    }
    
    // Version less than 5 only have short blocks
#if LOCK_VERSION == 0 || LOCK_VERSION >= 5
    {
        // Interleave long blocks
        uint16_t index = shortDataBlockLen * (numShortBlocks + 1);
        uint8_t stride = shortDataBlockLen;
        for (uint8_t blockNum = 0; blockNum < numBlocks - numShortBlocks; blockNum++) {
            result[offset++] = dataBytes[index];
            
            if (blockNum == 0) { stride++; }
            index += stride;
        }
    }
#endif
    
    // Add all ecc blocks, interleaved
    uint8_t blockSize = shortDataBlockLen;
    for (uint8_t blockNum = 0; blockNum < numBlocks; blockNum++) {
        
#if LOCK_VERSION == 0 || LOCK_VERSION >= 5
        if (blockNum == numShortBlocks) { blockSize++; }
#endif
        rs_getRemainder(blockEccLen, coeff, dataBytes, blockSize, &result[offset + blockNum], numBlocks);
        dataBytes += blockSize;
    }
    
    memcpy(data->data, result, data->capacityBytes);
    data->bitOffsetOrWidth = moduleCount;
}

// We store the Format bits tightly packed into a single byte (each of the 4 modes is 2 bits)
// The format bits can be determined by ECC_FORMAT_BITS >> (2 * ecc)
static const uint8_t ECC_FORMAT_BITS = (0x02 << 6) | (0x03 << 4) | (0x00 << 2) | (0x01 << 0);


#pragma mark - Public QRCode functions

uint16_t qrcode_getBufferSize(uint8_t version) {
    return bb_getGridSizeBytes(4 * version + 17);
}

// @TODO: Return error if data is too big.
int8_t qrcode_initBytes(QRCode *qrcode, uint8_t *modules, uint8_t version, uint8_t ecc, uint8_t *data, uint16_t length) {
    uint8_t size = version * 4 + 17;
    qrcode->version = version;
    qrcode->size = size;
    qrcode->ecc = ecc;
    qrcode->modules = modules;
    
    uint8_t eccFormatBits = (ECC_FORMAT_BITS >> (2 * ecc)) & 0x03;
    
#if LOCK_VERSION == 0
    uint16_t moduleCount = NUM_RAW_DATA_MODULES[version - 1];
    uint16_t dataCapacity = moduleCount / 8 - NUM_ERROR_CORRECTION_CODEWORDS[eccFormatBits][version - 1];
#else
    version = LOCK_VERSION;
    uint16_t moduleCount = NUM_RAW_DATA_MODULES;
    uint16_t dataCapacity = moduleCount / 8 - NUM_ERROR_CORRECTION_CODEWORDS[eccFormatBits];
#endif
    
    struct BitBucket codewords;
    uint8_t codewordBytes[bb_getBufferSizeBytes(moduleCount)];
    bb_initBuffer(&codewords, codewordBytes, (int32_t)sizeof(codewordBytes));
    
    // Place the data code words into the buffer
    int8_t mode = encodeDataCodewords(&codewords, data, length, version);
    
    if (mode < 0) { return -1; }
    qrcode->mode = mode;
    
    // Add terminator and pad up to a byte if applicable
    uint32_t padding = (dataCapacity * 8) - codewords.bitOffsetOrWidth;
    if (padding > 4) { padding = 4; }
    bb_appendBits(&codewords, 0, padding);
    bb_appendBits(&codewords, 0, (8 - codewords.bitOffsetOrWidth % 8) % 8);

    // Pad with alternate bytes until data capacity is reached
    for (uint8_t padByte = 0xEC; codewords.bitOffsetOrWidth < (dataCapacity * 8); padByte ^= 0xEC ^ 0x11) {
        bb_appendBits(&codewords, padByte, 8);
    }

    BitBucket modulesGrid;
    bb_initGrid(&modulesGrid, modules, size);
    
    BitBucket isFunctionGrid;
    uint8_t isFunctionGridBytes[bb_getGridSizeBytes(size)];
    bb_initGrid(&isFunctionGrid, isFunctionGridBytes, size);
    
    // Draw function patterns, draw all codewords, do masking
    drawFunctionPatterns(&modulesGrid, &isFunctionGrid, version, eccFormatBits);
    performErrorCorrection(version, eccFormatBits, &codewords);
    drawCodewords(&modulesGrid, &isFunctionGrid, &codewords);
    
    // Find the best (lowest penalty) mask
    uint8_t mask = 0;
    int32_t minPenalty = INT32_MAX;
    for (uint8_t i = 0; i < 8; i++) {
        drawFormatBits(&modulesGrid, &isFunctionGrid, eccFormatBits, i);
        applyMask(&modulesGrid, &isFunctionGrid, i);
        int penalty = getPenaltyScore(&modulesGrid);
        if (penalty < minPenalty) {
            mask = i;
            minPenalty = penalty;
        }
        applyMask(&modulesGrid, &isFunctionGrid, i);  // Undoes the mask due to XOR
    }
    
    qrcode->mask = mask;
    
    // Overwrite old format bits
    drawFormatBits(&modulesGrid, &isFunctionGrid, eccFormatBits, mask);
    
    // Apply the final choice of mask
    applyMask(&modulesGrid, &isFunctionGrid, mask);

    return 0;
}

int8_t qrcode_initText(QRCode *qrcode, uint8_t *modules, uint8_t version, uint8_t ecc, const char *data) {
    return qrcode_initBytes(qrcode, modules, version, ecc, (uint8_t*)data, strlen(data));
}

bool qrcode_getModule(QRCode *qrcode, uint8_t x, uint8_t y) {
    if (x < 0 || x >= qrcode->size || y < 0 || y >= qrcode->size) {
        return false;
    }

    uint32_t offset = y * qrcode->size + x;
    return (qrcode->modules[offset >> 3] & (1 << (7 - (offset & 0x07)))) != 0;
}

/*
uint8_t qrcode_getHexLength(QRCode *qrcode) {
    return ((qrcode->size * qrcode->size) + 7) / 4;
}

void qrcode_getHex(QRCode *qrcode, char *result) {
    
}
*/

// ================= END EMBEDDED QR ENGINE =================

void drawQrCodeScreen() {
  display.clearDisplay();
  
  // Header bar solid
  display.fillRect(0, 0, 128, 10, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(4, 1);
  display.print("HUAWEI BAND PAIRING");

  // Inisialisasi QR Code Dinamis (Embedded ricmoo QRCode Version 2: 25x25)
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(2)];
  qrcode_initText(&qrcode, qrcodeData, 2, ECC_LOW, activeToken);

  int scale = 2;
  int offsetX = 4;
  int offsetY = 12;

  // Gambar modul QR Code di sisi kiri OLED (50x50 px)
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        display.fillRect(offsetX + (x * scale), offsetY + (y * scale), scale, scale, SSD1306_WHITE);
      }
    }
  }

  // Informasi teks token di sisi kanan OLED (X: 58 s.d 127)
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
  display.print(isPaired ? "AKTIF" : "WAIT WEB");

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
  if (WiFi.status() != WL_CONNECTED) return false;

#if USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();
#else
  WiFiClient client;
#endif
  HTTPClient http;
  String url = String(API_BASE) + "/api/device/check-pair?token=" + activeToken;
  http.begin(client, url);
  http.setConnectTimeout(2500);
  http.setTimeout(3000);
  int httpCode = http.GET();
  bool paired = false;
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    deserializeJson(doc, payload);
    if (doc["paired"].as<bool>()) {
      paired = true;
      const char* pName = doc["patient_name"];
      if (pName && strlen(pName) > 0) {
        strlcpy(pairedPatientName, pName, sizeof(pairedPatientName));
      }
    }
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
  d["patient_id"] = PATIENT_ID;
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
  char buf[400];

  // --- Perangkat 1: Jam Pintar ---
  {
    StaticJsonDocument<512> d;
    d["device_id"]      = DEVICE_ID;
    d["patient_id"]     = PATIENT_ID;
    d["device_type"]    = "watch";
    d["heart_rate"]     = hrNow;
    d["activity"]       = isActive ? "ACTIVE" : "REST";
    d["steps"]          = steps;
    d["accel_g"]        = lastG;
    d["health_status"]  = healthStatus();
    d["fall_cancelled"] = cancelledCount;
    d["sensor_ok"]      = mpuOk;
    d["sim"]            = (hrOverride > 0);
    d["wifi_rssi"]      = WiFi.RSSI();
    d["ts"]             = epochNow();
    d["uptime_s"]       = millis() / 1000;
    serializeJson(d, buf, sizeof(buf));
    enqueueMsg(telQ, buf);
  }

  // --- Perangkat 2: Node Rumah ---
  {
    StaticJsonDocument<512> d;
    d["device_id"]    = HOME_DEVICE_ID;
    d["patient_id"]   = PATIENT_ID;
    d["device_type"]  = "home";
    if (dhtOk) { d["room_temp"] = roomTemp; d["humidity"] = roomHum; }
    else       { d["room_temp"] = nullptr;  d["humidity"] = nullptr; }
    d["smoke_adc"]    = (int)smokeEma;
    d["smoke_status"] = (curKind == K_SMOKE) ? "ALERT" : "NORMAL";
    d["sensor_ok"]    = dhtOk;
    d["sim"]          = simSmoke;
    d["ts"]           = epochNow();
    d["uptime_s"]     = millis() / 1000;
    serializeJson(d, buf, sizeof(buf));
    enqueueMsg(telQ, buf);
  }

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
      if ((code >= 200 && code < 300) || (code >= 400 && code < 500)) {
        xQueueReceive(evtQ, &m, 0);
      } else {
        vTaskDelay(pdMS_TO_TICKS(1500));
      }
      continue;
    }
    if (xQueueReceive(telQ, &m, pdMS_TO_TICKS(200)) == pdTRUE) postJson(URL_TELEMETRY, m.body);
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
  if (phase == P_VERIFY) { cancelledCount++; clearAlert("CANCELLED"); }
  else if (phase == P_ESCALATED && curKind != K_SMOKE) clearAlert("RESOLVED");
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
void runCmd(char* s) {
  if      (!strcmp(s, "fall"))  { raiseAlert(K_FALL, 3.0f, "CRITICAL", true); }
  else if (!strcmp(s, "sos"))   { raiseAlert(K_SOS, 0, "CRITICAL", true); }
  else if (!strcmp(s, "smoke")) { simSmoke = true; }
  else if (!strcmp(s, "clear")) { simSmoke = false; }
  else if (!strcmp(s, "ok") || !strcmp(s, "bypass")) {
    isPaired = true;
    Serial.println("[PAIRING] Manual bypass via serial command!");
    drawWelcomeScreen();
    delay(1500);
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

  // Otomatis generate Token ID Unik Baru (acak) setiap kali ESP32 dinyalakan / di-reset!
  snprintf(activeToken, sizeof(activeToken), "HUAWEI-ECA-%04X", (unsigned)(esp_random() & 0xFFFF));

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

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);
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
      isPaired = true;
      Serial.println("[PAIRING] Manual bypass via tombol OK ditekan!");
      drawWelcomeScreen();
      delay(1500);
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
