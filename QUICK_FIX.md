# Быстрое исправление сервера (выполнить на сервере через SSH)

## Выполните эти команды последовательно:

```bash
cd /var/maf-guides/server

# 1. Создать резервную копию
cp main.go main.go.backup.$(date +%Y%m%d_%H%M%S)

# 2. Заменить файл main.go исправленной версией
cat > main.go << 'EOF'
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
	if len(addr) > 2 && addr[0] == '[' && addr[len(addr)-1] == ']' {
		return addr[1 : len(addr)-1]
	}
	return addr
}

// getClientIP извлекает реальный IP клиента из запроса
func getClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		ips := strings.Split(forwarded, ",")
		if len(ips) > 0 {
			return normalizeIPv6Address(strings.TrimSpace(ips[0]))
		}
	}

	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return normalizeIPv6Address(realIP)
	}

	remoteAddr := r.RemoteAddr
	if remoteAddr != "" {
		if strings.Contains(remoteAddr, "]") {
			if bracketIdx := strings.LastIndex(remoteAddr, "]"); bracketIdx != -1 {
				ipPart := remoteAddr[:bracketIdx+1]
				return normalizeIPv6Address(ipPart)
			}
		} else {
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
	if isLocalIP(ip) {
		return GeoInfo{}, fmt.Errorf("skip local IP: %s", ip)
	}

	token := getEnv("IPINFO_TOKEN", "")
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

	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	clientIP := getClientIP(r)
	if clientIP != "unknown" {
		entry.IPAddress = clientIP
	}

	if entry.IPAddress != "" && entry.IPAddress != "unknown" && !isLocalIP(entry.IPAddress) {
		geoInfo, err := getGeoFromIP(entry.IPAddress)
		if err == nil {
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
			if !strings.Contains(err.Error(), "skip local IP") {
				log.Printf("Failed to get geo info for IP %s: %v", entry.IPAddress, err)
			}
		}
	}

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

	data, err := json.Marshal(entry)
	if err != nil {
		log.Printf("Error marshaling log entry: %v", err)
		return err
	}

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Error opening log file %s: %v", logFile, err)
		return err
	}
	defer f.Close()

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
EOF

# 3. Пересобрать сервер
go build -o logserver
chmod +x logserver

# 4. Перезапустить сервис
sudo systemctl restart logserver

# 5. Проверить статус
sudo systemctl status logserver

# 6. Тестовый запрос
echo "Тестирование сервера..."
curl -X POST -H "Content-Type: application/json" -d '{"linkId":"test-fixed","timestamp":"2026-02-08T10:30:00Z"}' http://localhost:3002/api/log -v

# 7. Проверить логи
echo -e "\n\nЛоги сервиса:"
sudo journalctl -u logserver -n 10 --no-pager

# 8. Проверить файл логов
echo -e "\n\nСодержимое logs.json:"
tail -n 5 /var/maf-guides/server/logs.json
```

## После выполнения:

1. **Обновите страницу** в браузере
2. **Проверьте запрос** `POST /api/log` во вкладке Network
3. **Должен вернуться статус 201 Created**
4. **Ошибка 500 должна исчезнуть**

## Если не работает:

```bash
# Проверить токен ipinfo.io
curl -v "https://ipinfo.io/json?token=36682665571ba2"

# Проверить доступ к файлу
ls -la /var/maf-guides/server/logs.json

# Проверить логи подробнее
sudo journalctl -u logserver -n 30 --no-pager | grep -E "(error|fail|panic)"
```