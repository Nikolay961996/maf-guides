# Исправление ошибки 500 на сервере

## Проблема
Сервер возвращает 500 ошибку "Failed to save log" из-за:
1. Неправильной обработки IPv6 адресов (`[::1]`)
2. Попытки получить геолокацию для локального IP
3. Недостаточного логирования ошибок

## Решение
Заменить файл `main.go` на исправленную версию и пересобрать сервер.

## Шаги исправления

### 1. Создать резервную копию текущего файла
```bash
cd /var/maf-guides/server
cp main.go main.go.backup
```

### 2. Создать новый исправленный файл `main.go`
Скопируйте содержимое исправленного файла (приведено ниже) или замените файл целиком.

#### Вариант A: Создать через nano/vim
```bash
cd /var/maf-guides/server
nano main.go
```
Удалите всё содержимое и вставьте исправленный код (см. ниже), сохраните (Ctrl+O, Enter, Ctrl+X).

#### Вариант B: Заменить файл через curl (если есть доступ к сырому файлу)
```bash
cd /var/maf-guides/server
curl -o main.go https://raw.githubusercontent.com/.../main_fixed.go
```
(Нужно загрузить файл на GitHub или другой хостинг)

#### Вариант C: Вручную заменить содержимое
```bash
cd /var/maf-guides/server
cat > main.go << 'EOF'
[ВСТАВЬТЕ СОДЕРЖАНИЕ ФАЙЛА main_fixed.go ЗДЕСЬ]
EOF
```

### 3. Пересобрать сервер
```bash
cd /var/maf-guides/server
go build -o logserver
chmod +x logserver
```

### 4. Перезапустить сервис
```bash
sudo systemctl restart logserver
sudo systemctl status logserver
```

### 5. Проверить работу
```bash
# Тестовый запрос
curl -X POST -H "Content-Type: application/json" -d '{"linkId":"test-fixed","timestamp":"2026-02-08T10:30:00Z"}' http://localhost:3002/api/log -v
```

### 6. Проверить логи
```bash
sudo journalctl -u logserver -n 20 --no-pager
tail -n 5 /var/maf-guides/server/logs.json
```

## Исправленный код `main.go`

```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// LogEntry представляет структуру лога
type LogEntry struct {
	LinkID      string `json:"linkId"`
	Timestamp   string `json:"timestamp"`
	IPAddress   string `json:"ipAddress,omitempty"`
	Country     string `json:"country,omitempty"`
	CountryCode string `json:"countryCode,omitempty"`
	Region      string `json:"region,omitempty"`
	City        string `json:"city,omitempty"`
	UserAgent   string `json:"userAgent,omitempty"`
	Referrer    string `json:"referrer,omitempty"`
	Screen      string `json:"screenResolution,omitempty"`
	Language    string `json:"language,omitempty"`
}

// GeoInfo представляет информацию о геолокации от ipinfo.io
type GeoInfo struct {
	IP       string `json:"ip"`
	City     string `json:"city"`
	Region   string `json:"region"`
	Country  string `json:"country"`
	Timezone string `json:"timezone"`
	Loc      string `json:"loc"`
}

var (
	logFile = "logs.json"
	mu      sync.Mutex
)

func main() {
	port := getEnv("PORT", "3002")
	log.Printf("Starting log server on port %s", port)

	http.HandleFunc("/api/log", handleLog)
	http.HandleFunc("/logs", handleGetLogs)

	addr := fmt.Sprintf(":%s", port)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// isLocalIP проверяет, является ли IP локальным (loopback)
func isLocalIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}

// normalizeIPv6Address нормализует IPv6 адрес (убирает квадратные скобки)
func normalizeIPv6Address(addr string) string {
	// Если адрес начинается с '[' и заканчивается ']', убираем скобки
	if len(addr) > 2 && addr[0] == '[' && addr[len(addr)-1] == ']' {
		return addr[1 : len(addr)-1]
	}
	return addr
}

// getClientIP извлекает реальный IP клиента из запроса
func getClientIP(r *http.Request) string {
	// Проверяем X-Forwarded-For (список IP через запятую)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// Берем первый IP из списка
		ips := strings.Split(forwarded, ",")
		if len(ips) > 0 {
			return normalizeIPv6Address(strings.TrimSpace(ips[0]))
		}
	}

	// Проверяем X-Real-IP
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return normalizeIPv6Address(realIP)
	}

	// Используем RemoteAddr (может содержать порт)
	remoteAddr := r.RemoteAddr
	if remoteAddr != "" {
		// Обработка IPv6 адреса с портом: [::1]:3002
		// Убираем порт, если есть
		if strings.Contains(remoteAddr, "]") {
			// IPv6 адрес с портом: [::1]:3002
			// Находим закрывающую скобку
			if bracketIdx := strings.LastIndex(remoteAddr, "]"); bracketIdx != -1 {
				ipPart := remoteAddr[:bracketIdx+1] // [::1]
				return normalizeIPv6Address(ipPart)
			}
		} else {
			// IPv4 адрес с портом: 127.0.0.1:3002
			if idx := strings.LastIndex(remoteAddr, ":"); idx != -1 {
				return remoteAddr[:idx]
			}
		}
		return normalizeIPv6Address(remoteAddr)
	}

	return "unknown"
}

// getGeoFromIP запрашивает геолокацию по IP у ipinfo.io
func getGeoFromIP(ip string) (GeoInfo, error) {
	// Не запрашиваем геолокацию для локальных IP
	if isLocalIP(ip) {
		return GeoInfo{}, fmt.Errorf("skip local IP: %s", ip)
	}

	token := getEnv("IPINFO_TOKEN", "")
	// Нормализуем IP для URL (убираем квадратные скобки если есть)
	normalizedIP := normalizeIPv6Address(ip)
	url := "https://ipinfo.io/" + normalizedIP + "/json"
	if token != "" {
		url = url + "?token=" + token
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return GeoInfo{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GeoInfo{}, fmt.Errorf("ipinfo.io returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return GeoInfo{}, err
	}

	var geoInfo GeoInfo
	if err := json.Unmarshal(body, &geoInfo); err != nil {
		return GeoInfo{}, err
	}

	return geoInfo, nil
}

// handleLog принимает POST запрос с JSON логом и сохраняет в файл
func handleLog(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var entry LogEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Добавляем timestamp, если отсутствует
	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	// Получаем реальный IP клиента
	clientIP := getClientIP(r)
	if clientIP != "unknown" {
		entry.IPAddress = clientIP
	}

	// Если IP определен и geo-данные отсутствуют или unknown, получаем геолокацию
	// Пропускаем геолокацию для локальных IP
	if entry.IPAddress != "" && entry.IPAddress != "unknown" && !isLocalIP(entry.IPAddress) {
		geoInfo, err := getGeoFromIP(entry.IPAddress)
		if err == nil {
			// Обновляем геолокационные поля, если они пустые или unknown
			if entry.Country == "" || entry.Country == "unknown" {
				entry.Country = geoInfo.Country
			}
			if entry.CountryCode == "" || entry.CountryCode == "unknown" {
				entry.CountryCode = geoInfo.Country
			}
			if entry.Region == "" || entry.Region == "unknown" {
				entry.Region = geoInfo.Region
			}
			if entry.City == "" || entry.City == "unknown" {
				entry.City = geoInfo.City
			}
		} else {
			// Логируем только ошибки, кроме "skip local IP"
			if !strings.Contains(err.Error(), "skip local IP") {
				log.Printf("Failed to get geo info for IP %s: %v", entry.IPAddress, err)
			}
		}
	}

	// Сохраняем лог
	if err := saveLog(entry); err != nil {
		log.Printf("Failed to save log: %v", err)
		http.Error(w, "Failed to save log", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleGetLogs возвращает все логи в JSON
func handleGetLogs(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	logs, err := readLogs()
	if err != nil {
		http.Error(w, "Failed to read logs", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// saveLog добавляет запись в файл logs.json (каждая запись с новой строки)
func saveLog(entry LogEntry) error {
	mu.Lock()
	defer mu.Unlock()

	// Преобразуем в JSON
	data, err := json.Marshal(entry)
	if err != nil {
		log.Printf("Error marshaling log entry: %v", err)
		return err
	}

	// Открываем файл для добавления (создаем если нет)
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Error opening log file %s: %v", logFile, err)
		return err
	}
	defer f.Close()

	// Записываем JSON строку с новой строки
	if _, err := f.Write(append(data, '\n')); err != nil {
		log.Printf("Error writing to log file: %v", err)
		return err
	}

	log.Printf("Log saved successfully: %s", entry.LinkID)
	return nil
}

// readLogs читает все строки из файл logs.json и парсит каждую как JSON
func readLogs() ([]LogEntry, error) {
	mu.Lock()
	defer mu.Unlock()

	// Если файла нет, возвращаем пустой массив
	if _, err := os.Stat(logFile); os.IsNotExist(err) {
		return []LogEntry{}, nil
	}

	data, err := os.ReadFile(logFile)
	if err != nil {
		return nil, err
	}

	var logs []LogEntry
	lines := splitLines(string(data))
	for _, line := range lines {
		if line == "" {
			continue
		}
		var entry LogEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			// Пропускаем некорректные строки
			continue
		}
		logs = append(logs, entry)
	}

	return logs, nil
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
```

## Альтернативный вариант: быстрое исправление через sed

Если не хотите заменять весь файл, можно внести минимальные исправления:

```bash
cd /var/maf-guides/server

# 1. Добавить импорт net
sed -i '2a\\t"net"' main.go

# 2. Исправить getClientIP для IPv6 (сложно через sed, лучше заменить файл)

# 3. Пересобрать и перезапустить
go build -o logserver
chmod +x logserver
sudo systemctl restart logserver
```

## После исправления
1. Обновите страницу в браузере
2. Проверьте запрос POST /api/log во вкладке Network
3. Должен вернуться статус 201 Created
4. Проверьте логи сервера: `sudo journalctl -u logserver -n 10`

## Если проблема осталась
Проверьте:
1. Токен ipinfo.io: `curl -v "https://ipinfo.io/json?token=36682665571ba2"`
2. Права на файл: `ls -la /var/maf-guides/server/logs.json`
3. Свободное место на диске: `df -h /var/maf-guides`
4. Логи Nginx: `sudo tail -n 20 /var/log/nginx/error.log`