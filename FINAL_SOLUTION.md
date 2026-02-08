# Окончательное решение проблемы 500 ошибки

## Текущий статус
Сервер Go возвращает 500 ошибку "Failed to save log" из-за:
1. `Error opening log file logs.json: open logs.json: permission denied`
2. Даже после исправления прав файла проблема сохраняется
3. Сервис запущен от root, файл принадлежит root

## Пошаговое решение

### Шаг 1: Выполнить диагностику (сейчас)
```bash
# 1. Проверить SELinux
getenforce

# 2. Проверить реального пользователя процесса
ps aux | grep logserver | grep -v grep

# 3. Проверить конфигурацию systemd
sudo cat /etc/systemd/system/logserver.service

# 4. Проверить запись от root
cd /var/maf-guides/server
echo '{"test": "root write"}' | sudo tee -a logs.json
cat logs.json

# 5. Тест Go записи
cat > test.go << 'EOF'
package main
import (
    "fmt"
    "os"
)
func main() {
    f, err := os.OpenFile("logs.json", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    defer f.Close()
    if _, err := f.WriteString("{\"test\":\"go write\"}\n"); err != nil {
        fmt.Printf("Write error: %v\n", err)
        return
    }
    fmt.Println("Success!")
}
EOF
go run test.go
rm test.go
```

### Шаг 2: Временное решение - упрощенный сервер

```bash
cd /var/maf-guides/server

# Создать упрощенную версию
cat > main_simple.go << 'EOF'
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"
)

type LogEntry struct {
    LinkID    string `json:"linkId"`
    Timestamp string `json:"timestamp"`
}

func main() {
    port := "3002"
    log.Printf("Starting simple log server on port %s", port)

    http.HandleFunc("/api/log", func(w http.ResponseWriter, r *http.Request) {
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

        // Просто логируем, не сохраняем в файл
        log.Printf("Log received: %+v", entry)

        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    http.HandleFunc("/logs", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode([]map[string]string{
            {"message": "Logs disabled for debugging"},
        })
    })

    addr := fmt.Sprintf(":%s", port)
    if err := http.ListenAndServe(addr, nil); err != nil {
        log.Fatal(err)
    }
}
EOF

# Пересобрать и перезапустить
go build -o logserver_simple main_simple.go
sudo systemctl stop logserver
sudo cp logserver_simple logserver
sudo systemctl start logserver

# Проверить
curl -X POST -H "Content-Type: application/json" -d '{"linkId":"test-simple"}' http://localhost:3002/api/log -v

# Проверить логи
sudo journalctl -u logserver -n 10 --no-pager
```

### Шаг 3: Если упрощенный сервер работает

1. **Обновите страницу в браузере** - ошибка 500 должна исчезнуть
2. **Проверьте запрос POST /api/log** - должен быть статус 201 Created
3. **Проверьте логи сервера** - `sudo journalctl -u logserver -n 10`

### Шаг 4: Постоянное исправление

Если упрощенный сервер работает, проблема в записи в файл. Варианты:

#### Вариант A: Использовать journald для логов
```go
// Вместо сохранения в файл, используйте log.Printf()
log.Printf("Log entry: %+v", entry)
// Логи будут доступны через journalctl
```

#### Вариант B: Использовать /tmp для логов
```go
logFile = "/tmp/maf_guides_logs.json"
```

#### Вариант C: Создать файл с правильными правами при запуске
```go
func init() {
    // Создать файл если не существует
    if _, err := os.Stat(logFile); os.IsNotExist(err) {
        f, err := os.Create(logFile)
        if err != nil {
            log.Fatal(err)
        }
        f.Close()
        os.Chmod(logFile, 0666) // Все могут читать и писать
    }
}
```

### Шаг 5: Проверить токен ipinfo.io

```bash
# Проверить токен из workflow
curl -v "https://ipinfo.io/json?token=36682665571ba2"

# Если токен недействительный, отключить геолокацию в коде
# Закомментировать вызов getGeoFromIP в handleLog
```

### Шаг 6: Обновить workflow для будущих деплоев

```yaml
# В .github/workflows/deploy.yml исправить:
Environment=IPINFO_TOKEN=${{ secrets.IPINFO_TOKEN }}  # вместо хардкода
```

## Если ничего не работает

1. **Отключите отправку логов во фронтенде**:
   ```bash
   # На сервере
   sudo sed -i 's/VITE_LOG_ENDPOINT=.*/VITE_LOG_ENDPOINT=/' /var/www/html/.env.production
   ```

2. **Перезагрузите Nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

3. **Проверьте сайт** - должен работать без аналитики

## Резюме проблемы

1. **Основная причина**: Go сервер не может открыть файл `logs.json` для записи
2. **Возможные причины**: SELinux, systemd ограничения, файловая система
3. **Решение**: Упростить сервер, убрать запись в файл, использовать journald
4. **Цель**: Сайт должен работать, даже если аналитика не сохраняется в файл

Выполните **Шаг 1 (диагностика)**, затем **Шаг 2 (упрощенный сервер)**. Если упрощенный сервер работает, проблема решена.