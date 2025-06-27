#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>

#include <DHT.h>
#include <Wire.h>
#include <BH1750.h>

#define DHTPIN 26
#define DHTTYPE DHT11
#define LEDPIN 27
#define LEDPINLUX 25
#define ANALOG_SOIL1 32
#define BUZZER_PIN 33 
#define ENA_PIN 19
#define IN1_PIN 18
#define LED_SERVER 2
#define WATER_LEVEL_PIN 34 


#define SOIL_DRY_THRESHOLD 3600 //Трябва да се настрои експериментално.
int val = 0;
bool isBuzzerActive = false;
DHT dht(DHTPIN, DHTTYPE);
BH1750 lightMeter;

const char *ssid = "ESP32_Plant_Monitor";
const char *password = "12345678";

AsyncWebServer server(80);

float temperature, humidity, lightIntensity = -1.0;
int soilMoisture;
bool isPumpOn = false;
bool buzzON = true;
int waterLvl = 0;

    int readRawSensorValue() {
        val = analogRead(WATER_LEVEL_PIN);
        return val;
    }

    int mapSensorValue(int rawValue) {
        int minAnalogWet = 2500;  // Стойност за 100% пълно
        int maxAnalogDry = 200; // Стойност за 0% пълно

        long mappedValue = map(rawValue, maxAnalogDry, minAnalogWet, 0, 100);

        if (mappedValue < 0) {
            mappedValue = 0;
        }
        if (mappedValue > 100) {
            mappedValue = 100;
        }
        return (int)mappedValue;
    }


void setup() {
    Serial.begin(9600);
    Serial.println("\nBooting Plant Monitor...");

    dht.begin();
    Wire.begin();
    lightMeter.begin(BH1750::ONE_TIME_HIGH_RES_MODE);

    pinMode(LEDPIN, OUTPUT);
    pinMode(LEDPINLUX, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(ENA_PIN, OUTPUT);
    pinMode(IN1_PIN, OUTPUT);
    pinMode(LED_SERVER, OUTPUT);
    pinMode(WATER_LEVEL_PIN, OUTPUT);

    digitalWrite(IN1_PIN, LOW);
    analogWrite(ENA_PIN, 0);

    isPumpOn = false;
    digitalWrite(LED_SERVER, LOW);
    digitalWrite(LEDPIN, LOW);
    digitalWrite(LEDPINLUX, LOW);
    noTone(BUZZER_PIN);

    if (!SPIFFS.begin(true)) {
        Serial.println("An Error has occurred while mounting SPIFFS");
        return;
    }
    Serial.println("SPIFFS mounted successfully");

    WiFi.softAP(ssid, password);
    Serial.print("AP SSID: ");
    Serial.println(ssid);
    Serial.print("AP IP address: ");
    Serial.println(WiFi.softAPIP());
    digitalWrite(LED_SERVER, HIGH);

    // Routes за статични файлове
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (SPIFFS.exists("/index.html")) request->send(SPIFFS, "/index.html", "text/html");
        else request->send(404, "text/plain", "index.html not found");
    });
    server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (SPIFFS.exists("/style.css")) request->send(SPIFFS, "/style.css", "text/css");
        else request->send(404, "text/plain", "style.css not found");
    });
    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (SPIFFS.exists("/script.js")) request->send(SPIFFS, "/script.js", "text/javascript");
        else request->send(404, "text/plain", "script.js not found");
    });
    server.on("/logo.webp", HTTP_GET, [](AsyncWebServerRequest *request){
        if (SPIFFS.exists("/logo.webp")) request->send(SPIFFS, "/logo.webp", "image/webp");
        else request->send(404, "text/plain", "logo.webp not found");
    });
    server.on("/backgroundPlants.avif", HTTP_GET, [](AsyncWebServerRequest *request){
         if (SPIFFS.exists("/backgroundPlants.avif")) request->send(SPIFFS, "/backgroundPlants.avif", "image/avif");
        else request->send(404, "text/plain", "backgroundPlants.avif not found");
    });

    // Route за данни от сензори
    server.on("/data", HTTP_GET, [](AsyncWebServerRequest *request) {

        StaticJsonDocument<320> jsonDocument; 

        if (isnan(temperature)) {
            jsonDocument["temperature"] = nullptr;
        } else {
            jsonDocument["temperature"] = String(temperature, 1);
        }

        if (isnan(humidity)) {
            jsonDocument["humidity"] = nullptr;
        } else {
            jsonDocument["humidity"] = String(humidity, 1);
        }

        if (lightIntensity < 0) { // Проверка за валидна стойност от BH1750
            jsonDocument["lightIntensity"] = nullptr;
        } else {
            jsonDocument["lightIntensity"] = String(lightIntensity, 0);
        }

        jsonDocument["soilMoisture"] = soilMoisture; // Суровата стойност от почвения сензор
        jsonDocument["pumpStatus"] = isPumpOn ? "ON" : "OFF";

        jsonDocument["waterLevelPercent"] = mapSensorValue(val); // Мапнатата стойност (0-100%)
        jsonDocument["waterLevelRaw"] = val;  // Суровата аналогова стойност

        String jsonString;
        serializeJson(jsonDocument, jsonString);
        request->send(200, "application/json", jsonString);
    });

    server.begin();
    Serial.println("HTTP server started");
}


void managePump() {
     if (soilMoisture > SOIL_DRY_THRESHOLD) {
          Serial.println("Pump ON");
          digitalWrite(IN1_PIN, HIGH);
          digitalWrite(ENA_PIN, HIGH);
          delay(3000);
          digitalWrite(IN1_PIN, LOW);
          analogWrite(ENA_PIN, LOW); 
          Serial.println("Pump OFF");
          delay(3000);
     }
}


void loop() {

    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    lightIntensity = lightMeter.readLightLevel();
    lightMeter.configure(BH1750::ONE_TIME_HIGH_RES_MODE);

    long sumSoilMoisture = 0;
    for (int i = 0; i < 5; i++) {
        sumSoilMoisture += analogRead(ANALOG_SOIL1);
        delay(10);
    }
    soilMoisture = sumSoilMoisture / 5;

    static unsigned long lastSerialPrintTime = 0;
    if (millis() - lastSerialPrintTime > 5000) { // Печат на всеки 5 секунди
        lastSerialPrintTime = millis();
        Serial.println("--- Sensor Readings ---");
        if (isnan(temperature)) Serial.println("Temperature: Failed to read");
        else { Serial.print("Temperature: "); Serial.print(temperature, 1); Serial.println(" *C"); }

        if (isnan(humidity)) Serial.println("Humidity: Failed to read");
        else { Serial.print("Humidity: "); Serial.print(humidity, 1); Serial.println(" %"); }

        Serial.print("Light Intensity: ");
        if (lightIntensity < 0) Serial.println("Failed to read");
        else { Serial.print(lightIntensity, 0); Serial.println(" lx"); }

        Serial.print("Soil Moisture (raw): "); Serial.println(soilMoisture);
        Serial.print("Pump Status: "); Serial.println(isPumpOn ? "ON" : "OFF");
        Serial.println("-----------------------");
    }

    // Логика за LEDs
    if (!isnan(temperature)) {
        if (temperature < 15.0 || temperature > 30.0) digitalWrite(LEDPIN, HIGH);
        else digitalWrite(LEDPIN, LOW);
    }

    if (lightIntensity >= 0 && lightIntensity < 100.0) {
        digitalWrite(LEDPINLUX, HIGH);
    } else {
        digitalWrite(LEDPINLUX, LOW);
    }
    
    
    int rawValue = readRawSensorValue();
    int mappedLevel = mapSensorValue(rawValue);

    if (mappedLevel < 25) {
        if (!isBuzzerActive) {
        tone(BUZZER_PIN, 1000, 500);
        Serial.print("  <<<< LOW WATER LEVEL - BUZZER ACTIVATED >>>>");
        }
    } else {
        if (isBuzzerActive) { 
        noTone(BUZZER_PIN);
        isBuzzerActive = false;
        Serial.print("  <<<< Water level OK - Buzzer DEACTIVATED >>>>");
        }
    }

    Serial.println();

    if(mappedLevel > 10) {
        managePump();
        noTone(BUZZER_PIN);
    }

    delay(100);
}