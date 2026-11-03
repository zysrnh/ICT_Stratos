/*
  AI-Powered Elderly Care Ecosystem - Device Layer (Wokwi)
  ---------------------------------------------------------
  Satu ESP32 mensimulasikan DUA perangkat logis:
    1) ECA-WATCH-001 : jam pintar lansia (HR, aktivitas/langkah, deteksi jatuh, tombol SOS, tombol OK)
    2) ECA-HOME-001  : node keselamatan rumah (asap MQ-2 + suhu ruangan DHT22)
  Di perangkat nyata keduanya adalah board terpisah; kodenya tinggal dipisah.

  Alur darurat mengikuti juknis Bagian 6:
    Jatuh / HR abnormal -> VERIFY (lansia ditanya, tekan OK = aman) -> tak ada respons -> ESCALATED (backend notifikasi keluarga)
    SOS / Asap          -> langsung ESCALATED (tanpa verifikasi)

  Jaringan berjalan di task FreeRTOS terpisah, jadi HTTP yang lambat tidak menahan layar, buzzer, atau deteksi jatuh.
  Event darurat diantrikan (RAM) dan dikirim ulang otomatis bila WiFi putus.

  Perintah simulator via Serial Monitor (juknis 5.5 - simulator wajib ada):
    fall | sos | smoke | clear | hr <angka> | hr auto
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
// USE_HTTPS=1 : TLS Enkripsi Juknis 8.1 (Domain Produksi: ict.hmif-lpkia.my.id)
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
const char* API_KEY       = "HUAWEI-ECA-8821";   // Token ID Perangkat (Anti-Collision: ganti sesuai token di web jika buat ID baru)

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
// AMBANG (nilai DEMO). Juknis 5.3: jangan ditebak, wajib dari referensi medis dan
// disimpan sebagai konfigurasi yang bisa diubah. Isi sumbernya di dokumentasi.
// ==========================================
const int HR_WARN_HIGH = 100, HR_CRIT_HIGH = 120;
const int HR_WARN_LOW  = 50,  HR_CRIT_LOW  = 40;
const unsigned long HR_SUSTAIN_MS = 10000UL;   // demo 10 dtk; produksi hitungan menit
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

const int   SMOKE_ALERT_ADC = 2500, SMOKE_CLEAR_ADC = 2000;  // kalibrasi dengan sensor nyata
const float ROOM_TEMP_ALERT = 57.0f;                          // placeholder detektor panas suhu tetap

// ==========================================
// Tipe & state
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

uint16_t cancelledCount = 0;   // jumlah alarm dibatalkan lansia (bahan metrik false alarm, juknis 6.3)

Btn btnSos = { BTN_SOS, HIGH, 0 };
Btn btnOk  = { BTN_OK,  HIGH, 0 };

// ==========================================
// Util
// ==========================================
uint32_t epochNow() {
  time_t t = time(nullptr);
  return (t > 1700000000) ? (uint32_t)t : 0;   // 0 = belum sinkron NTP
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
// Antrian jaringan
// ==========================================
void enqueueMsg(QueueHandle_t q, const char* body) {
  NetMsg m;
  strlcpy(m.body, body, sizeof(m.body));
  if (xQueueSend(q, &m, 0) != pdTRUE) {      // penuh: buang yang terlama
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
  d["status"]     = status;     // PENDING | ESCALATED | CANCELLED | RESOLVED
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

  // --- perangkat 1: jam pintar ---
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

  // --- perangkat 2: node rumah ---
  {
    StaticJsonDocument<512> d;
    d["device_id"]    = HOME_DEVICE_ID;
    d["patient_id"]   = PATIENT_ID;
    d["device_type"]  = "home";
    if (dhtOk) { d["room_temp"] = roomTemp; d["humidity"] = roomHum; }
    else       { d["room_temp"] = nullptr;  d["humidity"] = nullptr; }   // tidak memalsukan data saat sensor gagal
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

// Mengembalikan kode HTTP (<=0 = gagal jaringan)
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
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
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
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      digitalWrite(LED_SYNC, LOW);
      if (millis() - lastRetry > 10000UL) { lastRetry = millis(); WiFi.reconnect(); }
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    NetMsg m;
    if (xQueuePeek(evtQ, &m, 0) == pdTRUE) {          // event darurat selalu didahulukan
      int code = postJson(URL_EVENTS, m.body);
      if ((code >= 200 && code < 300) || (code >= 400 && code < 500)) {
        xQueueReceive(evtQ, &m, 0);                   // sukses, atau ditolak permanen (jangan macet)
      } else {
        vTaskDelay(pdMS_TO_TICKS(1500));              // jaringan/server bermasalah: coba lagi
      }
      continue;
    }
    if (xQueueReceive(telQ, &m, pdMS_TO_TICKS(200)) == pdTRUE) postJson(URL_TELEMETRY, m.body);
  }
}

// ==========================================
// Logika alarm (verifikasi -> eskalasi)
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
  if (phase == P_VERIFY) queueEvent(curKind, curSev, "CANCELLED", curValue, curSim);  // digantikan yang lebih prioritas
  curKind = k; curSev = sev; curValue = v; curSim = sim;
  snprintf(curEventId, sizeof(curEventId), "%08lx-%lu", (unsigned long)bootId, (unsigned long)++eventSeq);
  if (k == K_SOS || k == K_SMOKE) {
    phase = P_ESCALATED;                               // tanpa verifikasi (juknis 6.2 C & D)
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
// Sensor: MPU6050 (akselerometer mentah, rentang +-8g)
// ==========================================
bool initMpu() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0x00);                 // bangunkan
  if (Wire.endTransmission() != 0) return false;
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C); Wire.write(0x10);                 // ACCEL_CONFIG: +-8g (4096 LSB/g)
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

// Benturan -> tunggu -> diam = dicurigai jatuh. Bukan satu ambang saja (juknis 6.3: gabungkan sinyal).
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
// Evaluasi HR & rumah
// ==========================================
void evalHr(unsigned long now) {
  int hr = hrNow, lvl = 0;
  if (hr <= HR_CRIT_LOW) lvl = 2;
  else if (hr <= HR_WARN_LOW) lvl = 1;
  else if (!isActive) {                                  // HR tinggi hanya dihitung saat istirahat
    if (hr >= HR_CRIT_HIGH) lvl = 2;
    else if (hr >= HR_WARN_HIGH) lvl = 1;
  }
  hrLevelNow = lvl;
  if (lvl == 0) {
    hrAbnSince = 0;
    if (phase == P_VERIFY && curKind == K_HR) clearAlert("CANCELLED");   // pulih sendiri sebelum eskalasi
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
  else if (!strncmp(s, "hr ", 3)) {
    if (!strcmp(s + 3, "auto")) hrOverride = -1;
    else hrOverride = atoi(s + 3);
  }
  else Serial.println("[SIM] perintah: fall | sos | smoke | clear | hr <angka> | hr auto");
  Serial.printf("[SIM] ok: %s\n", s);
}

void handleSerial() {
  static char buf[24];
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
// Tampilan OLED
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
// Setup & loop
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== AI-Powered Elderly Care - Device Layer ===");
  Serial.println("[SIM] perintah: fall | sos | smoke | clear | hr <angka> | hr auto");

  bootId = esp_random();
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
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(10, 24);
    display.println("Elderly Care Band");
    display.setCursor(24, 40);
    display.println("Memulai...");
    display.display();
  }

  mpuOk = initMpu();
  Serial.println(mpuOk ? "[MPU6050] OK" : "[MPU6050] TIDAK TERDETEKSI - deteksi jatuh nonaktif");
  dht.begin();

  evtQ = xQueueCreate(12, sizeof(NetMsg));
  telQ = xQueueCreate(2, sizeof(NetMsg));

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);                    // channel 6: cepat di Wokwi
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");   // WIB

  xTaskCreatePinnedToCore(netTask, "net", 12288, NULL, 1, NULL, 0);
}

void loop() {
  unsigned long now = millis();
  static unsigned long lastImu = 0, lastHr = 0, lastDht = 0, lastSmoke = 0, lastUi = 0, lastTel = 0;

  handleSerial();

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

  // --- HR 10 Hz, dihaluskan (EMA) agar lonjakan sesaat tidak memicu alarm ---
  if (now - lastHr >= 100) {
    lastHr = now;
    float target = (hrOverride > 0) ? (float)hrOverride : (float)map(analogRead(POT_PIN), 0, 4095, 45, 150);
    hrEma += 0.15f * (target - hrEma);
    hrNow = (int)(hrEma + 0.5f);
    evalHr(now);
  }

  // --- DHT22 (min. interval 2 dtk) ---
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

  // --- tombol ---
  if (btnEdge(btnSos)) raiseAlert(K_SOS, 0, "CRITICAL", false);
  if (btnEdge(btnOk))  onOkPressed();

  updateAlertLogic(now);
  updateBuzzer(now);

  if (now - lastUi >= 250) { lastUi = now; drawUI(now); }
  if (now - lastTel >= 3000) { lastTel = now; sendTelemetry(); }
}
