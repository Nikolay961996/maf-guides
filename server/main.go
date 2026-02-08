package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
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

// getClientIP извлекает реальный IP клиента из запроса
func getClientIP(r *http.Request) string {
	// Проверяем X-Forwarded-For (список IP через запятую)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// Берем первый IP из списка
		ips := strings.Split(forwarded, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Проверяем X-Real-IP
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Используем RemoteAddr (может содержать порт)
	remoteAddr := r.RemoteAddr
	if remoteAddr != "" {
		// Убираем порт, если есть
		if idx := strings.LastIndex(remoteAddr, ":"); idx != -1 {
			return remoteAddr[:idx]
		}
		return remoteAddr
	}

	return "unknown"
}

// getGeoFromIP запрашивает геолокацию по IP у ipinfo.io
func getGeoFromIP(ip string) (GeoInfo, error) {
	token := getEnv("IPINFO_TOKEN", "")
	url := "https://ipinfo.io/" + ip + "/json"
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
	if entry.IPAddress != "" && entry.IPAddress != "unknown" {
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
			log.Printf("Failed to get geo info for IP %s: %v", entry.IPAddress, err)
		}
	}

	// Сохраняем лог
	if err := saveLog(entry); err != nil {
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
		return err
	}

	// Открываем файл для добавления (создаем если нет)
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	// Записываем JSON строку с новой строки
	if _, err := f.Write(append(data, '\n')); err != nil {
		return err
	}

	return nil
}

// readLogs читает все строки из файла logs.json и парсит каждую как JSON
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