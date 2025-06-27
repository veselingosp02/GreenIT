document.addEventListener('DOMContentLoaded', function() {
    const temperatureElem = document.getElementById('temperature');
    const tempIconElem = document.getElementById('tempIcon');
    const tempWarningElem = document.getElementById('tempWarning');
    const humidityElem = document.getElementById('humidity');
    const lightIntensityElem = document.getElementById('lightIntensity');
    const soilMoistureElem = document.getElementById('soilMoisture');
    const pumpOnBtn = document.getElementById('pumpOnBtn');
    const pumpStatusElem = document.getElementById('pumpStatus');
	const waterLevelElem = document.getElementById('waterLevel');

    function displaySensorError(element, defaultText = '-') {
        if (element) {
            element.textContent = defaultText; // Показва "-" 
        }
    }

function updateTemperatureUI(tempStr) { // Очакваме стринг от JSON
    if (temperatureElem && tempIconElem && tempWarningElem) { // Проверка дали елементите съществуват
        if (tempStr !== null && tempStr !== undefined && tempStr !== "Error") {
            const temp = parseFloat(tempStr);
            temperatureElem.textContent = temp.toFixed(1); // ESP32 изпраща с 1 знак
            temperatureElem.style.color = '#333';         // Нулиране на цвета на текста
            temperatureElem.style.backgroundColor = 'transparent'; // Нулиране на фона
            tempIconElem.className = '';                 // Нулиране на иконите
            tempWarningElem.textContent = '';            // Нулиране на предупреждението

            if (temp < 15) {
                temperatureElem.style.backgroundColor = '#ADD8E6'; // Светло синьо за студено
                temperatureElem.style.color = '#0000CD';       // Тъмно син текст
                tempIconElem.className = 'fas fa-snowflake';
                tempWarningElem.textContent = 'Внимание: Ниска температура!';
            } else if (temp >= 15 && temp <= 30) {
                temperatureElem.style.backgroundColor = '#90EE90'; // Светло зелено за нормално
                temperatureElem.style.color = '#006400';       // Тъмно зелен текст
                // Няма специфична икона за нормална температура, освен ако не искаш
            } else if (temp > 30 && temp <= 40) {
                temperatureElem.style.backgroundColor = '#FFFFE0'; // Светло жълто за топло
                temperatureElem.style.color = '#B8860B';       // Тъмно жълт/кафяв текст
                tempIconElem.className = 'fas fa-exclamation-triangle'; // Икона за внимание
                tempWarningElem.textContent = 'Внимание: Висока температура!';
            } else if (temp > 40) {
                temperatureElem.style.backgroundColor = '#FFCCCB'; // Светло червено за много горещо
                temperatureElem.style.color = '#A52A2A';       // Кафяво-червен текст
                tempIconElem.className = 'fas fa-fire-alt';    // Или fa-fire за Font Awesome 6
                tempWarningElem.textContent = 'ОПАСНОСТ: Много висока температура!';
            }
        } else {
            // Ако има грешка при четене или стойността е null/undefined
            temperatureElem.textContent = "-"; // Показва тире
            temperatureElem.style.color = '#333';
            temperatureElem.style.backgroundColor = 'transparent'; // Без специфичен фон при грешка
            tempIconElem.className = '';
            if (tempWarningElem) tempWarningElem.textContent = 'Грешка при четене на темп.';
        }
    } else {
        console.error("Един или повече елементи за температура липсват в DOM!");
    }
}

    function updateHumidityUI(humidityStr) { // Очакваме стринг от JSON
        if (humidityStr !== null && humidityStr !== undefined && humidityStr !== "Error") {
            const humidity = parseFloat(humidityStr);
            humidityElem.textContent = humidity.toFixed(1); // ESP32 изпраща с 1 знак
            humidityElem.style.color = '#333'; // Върни нормален цвят по подразбиране

            if (humidity < 30) {
                humidityElem.style.backgroundColor = '#ADD8E6';
                humidityElem.style.color = '#0000CD';
            } else if (humidity >= 30 && humidity <= 50) {
                humidityElem.style.backgroundColor = '#90EE90';
                humidityElem.style.color = '#006400';
            } else { // > 50
                humidityElem.style.backgroundColor = '#FFFFE0';
                humidityElem.style.color = '#B8860B';
            }
        } else {
            // humidityElem.textContent = "Грешка H";
        }
    }

    function updateLightIntensityUI(lightStr) { // Очакваме стринг от JSON
        if (lightStr !== null && lightStr !== undefined && lightStr !== "Error") {
            const light = parseFloat(lightStr);
            lightIntensityElem.textContent = light.toFixed(0); // ESP32 изпраща без десетични
            lightIntensityElem.style.color = '#333';

            if (light < 10000) {
                lightIntensityElem.style.backgroundColor = '#FFFFE0';
                lightIntensityElem.style.color = '#B8860B';
            } else if (light >= 10000 && light <= 20000) {
                lightIntensityElem.style.backgroundColor = '#90EE90';
                lightIntensityElem.style.color = '#006400';
            } else { // > 20000
                lightIntensityElem.style.backgroundColor = '#FFCCCB';
                lightIntensityElem.style.color = '#A52A2A';
            }
        } else {
            // lightIntensityElem.textContent = "Грешка L"; // Пример
        }
    }

    function updateSoilMoistureUI(soil) { // soil е число (сурова стойност)
        const DRY_VALUE = 4000;
        const WET_VALUE = 1500;
        let soilPercent = 0;

        if (soil !== null && soil !== undefined) {
            soilPercent = 100 - ((soil - WET_VALUE) / (DRY_VALUE - WET_VALUE)) * 100;
            soilPercent = Math.max(0, Math.min(100, soilPercent));
            soilMoistureElem.textContent = soilPercent.toFixed(0) + ' % (raw: ' + soil + ')';
            soilMoistureElem.style.color = '#333';

            if (soilPercent < 40) {
                soilMoistureElem.style.backgroundColor = '#FFCCCB';
                soilMoistureElem.style.color = '#A52A2A';
            } else { // >= 40
                soilMoistureElem.style.backgroundColor = '#90EE90';
                soilMoistureElem.style.color = '#006400';
            }
        } else {
            // soilMoistureElem.textContent = "Грешка S"; // Пример
        }
    }
	
	function updateWaterLevelUI(waterLevelPercent, rawWaterValue) {
        const LOW_WATER_THRESHOLD = 10; // Процент, под който се счита за ниско ниво
        const CRITICAL_LOW_WATER_THRESHOLD = 5; // Още по-критично ниско ниво

        if (waterLevelPercent !== null && waterLevelPercent !== undefined) {
            let displayText = waterLevelPercent.toFixed(0) + ' %';
            if (rawWaterValue !== null && rawWaterValue !== undefined) {
                displayText += ' (raw: ' + rawWaterValue + ')';
            }
            waterLevelElem.textContent = displayText;
            waterLevelElem.style.color = '#333'; // Стандартен цвят на текста

            // Логика за оцветяване на фона и текста според нивото
            if (waterLevelPercent < CRITICAL_LOW_WATER_THRESHOLD) {
                // Много ниско ниво - червено
                waterLevelElem.style.backgroundColor = '#FF6347'; // Tomato red
                waterLevelElem.style.color = '#FFFFFF'; // Бял текст за контраст
            } else if (waterLevelPercent < LOW_WATER_THRESHOLD) {
                // Ниско ниво - оранжево/жълто
                waterLevelElem.style.backgroundColor = '#FFA500'; // Orange
                waterLevelElem.style.color = '#333';
            } else if (waterLevelPercent < 30) {
                // Под средното, но не критично - светло жълто
                waterLevelElem.style.backgroundColor = '#FFFFE0'; // LightYellow
                waterLevelElem.style.color = '#333';
            } else { // >= 30 (нормално или високо ниво)
                // Нормално ниво - зелено
                waterLevelElem.style.backgroundColor = '#90EE90'; // LightGreen
                waterLevelElem.style.color = '#006400'; // Тъмно зелен текст
            }
        } else {
            waterLevelElem.textContent = "Грешка WL"; // Или друг подходящ текст за грешка
            waterLevelElem.style.backgroundColor = '#F0F0F0'; // Сив фон при грешка
            waterLevelElem.style.color = '#A9A9A9'; // Сив текст
        }
    }	


    function getAllSensorData() {
        fetch('/data')
            .then(response => {
                if (!response.ok) {
                    // Ако има HTTP грешка (напр. 404, 500), грешка, за да отиде в .catch()
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Получени данни от ESP32:", data); // За дебъг

                updateTemperatureUI(data.temperature);
                updateHumidityUI(data.humidity);
                updateLightIntensityUI(data.lightIntensity);
                updateSoilMoistureUI(data.soilMoisture);
				updateWaterLevelUI(data.waterLevelPercent, data.rawWaterValue);

                // Обновяване на статуса на помпата
                if (data.pumpStatus && pumpStatusElem) {
                    pumpStatusElem.textContent = data.pumpStatus === "ON" ? "Включена" : "Изключена";
                    pumpStatusElem.style.color = data.pumpStatus === "ON" ? "#27ae60" : "#e74c3c";
                }
            })
            .catch(error => {
                console.error('Error fetching sensor data:', error);
                // При грешка при извличане на данните, НЕ нулираме стойностите на сензорите.
                // Показваме само общо съобщение за грешка, ако е необходимо.
                if (tempWarningElem) { // Използвай tempWarning, за да покажеш обща грешка при връзка
                    tempWarningElem.textContent = 'Грешка при връзка със сървъра!';
                    tempWarningElem.style.color = 'red'; // Направи го по-видимо
                }
            });
    }

function controlPump() {
    if(pumpStatusElem) {
        pumpStatusElem.textContent = "Включва се...";
        pumpStatusElem.style.color = "#f39c12"; // Оранжево за изчакване
    }

    fetch('/PUMP_ON') // <<< ИЗПРАЩА ЗАЯВКА КЪМ /PUMP_ON
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(responseText => {
            console.log("Отговор от /PUMP_ON:", responseText);
            // Показваме, че помпата е била стартирана
            if (pumpStatusElem) {
                pumpStatusElem.textContent = "Работи (3 сек)...";
                pumpStatusElem.style.color = "#27ae60"; // Зелено
            }
            // След малко повече от 3 секунди, обнови статуса от сървъра,
            // за да сме сигурни, че показва "Изключена"
            setTimeout(getAllSensorData, 3500); // Малко повече от 3000ms
        })
        .catch(error => {
            console.error('Error controlling pump:', error);
            if (pumpStatusElem) {
                pumpStatusElem.textContent = "Грешка!";
                pumpStatusElem.style.color = "#c0392b";
            }
            setTimeout(getAllSensorData, 1000); // Опитай да обновиш статуса въпреки грешката
        });
}

if (pumpOnBtn) {
    pumpOnBtn.addEventListener('click', () => {
        controlPump(); // Извиква функцията без параметър
    });
}
    getAllSensorData();
    setInterval(getAllSensorData, 5000); // Обновявай на всеки 5 секунди
});