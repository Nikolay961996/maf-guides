# Глубокая диагностика проблемы с правами

## 1. Проверить SELinux

```bash
# Проверить статус SELinux
getenforce

# Если Enforcing, временно отключить для теста
sudo setenforce 0

# Проверить контекст файла и директории
ls -Z /var/maf-guides/server/logs.json
ls -Z /var/maf-guides/server/

# Посмотреть аудит SELinux
sudo ausearch -m avc -ts recent | grep logs.json
```

## 2. Проверить реального владельца процесса

```bash
# Проверить пользователя процесса
ps aux | grep logserver | grep -v grep

# Или более детально
sudo systemctl status logserver | grep "Main PID"
sudo cat /proc/$(pidof logserver)/status | grep Uid

# Проверить конфигурацию systemd
sudo cat /etc/systemd/system/logserver.service

# Проверить, запущен ли с ограничениями
sudo systemctl show logserver | grep -E "(User|Group|Capability)"
```

## 3. Проверить права директории

```bash
# Проверить права всей цепочки
ls -ld /var /var/maf-guides /var/maf-guides/server

# Проверить sticky bits и другие специальные флаги
ls -la /var/maf-guides/server/ | head -5
```

## 4. Проверить файловую систему

```bash
# Проверить точку монтирования
df -h /var/maf-guides/server/logs.json
mount | grep $(df -h /var/maf-guides/server/logs.json | tail -1 | awk '{print $1}')

# Проверить флаги монтирования
cat /proc/mounts | grep $(df -h /var/maf-guides/server/logs.json | tail -1 | awk '{print $1}')
```

## 5. Проверить блокировки файлов

```bash
# Проверить, не заблокирован ли файл
lsof /var/maf-guides/server/logs.json

# Проверить inotify
sudo inotifywatch -v /var/maf-guides/server/logs.json 2>&1 | head -20
```

## 6. Тест записи от root

```bash
# Проверить, может ли root писать в файл
cd /var/maf-guides/server
echo '{"test": "root write"}' | sudo tee -a logs.json
cat logs.json

# Проверить через Go напрямую
cat > test_write.go << 'EOF'
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

go run test_write.go
rm test_write.go
```

## 7. Проверить с strace

```bash
# Запустить сервер с strace для отладки
sudo systemctl stop logserver

# Запустить вручную с strace
cd /var/maf-guides/server
strace -f -e trace=open,openat,write,close ./logserver 2>&1 | grep -E "(logs.json|permission|denied)" &

# Или прослушивать работающий процесс
sudo strace -p $(pidof logserver) -e open,openat 2>&1 | head -20
```

## 8. Проверить AppArmor или другие системы контроля

```bash
# Проверить AppArmor
sudo aa-status

# Проверить профили
sudo aa-status | grep -i logserver

# Проверить auditd
sudo tail -n 20 /var/log/audit/audit.log | grep -i denied
```

## 9. Создать тестовую среду

```bash
# Создать тестовую директорию в /tmp
sudo mkdir -p /tmp/test_server
sudo cp /var/maf-guides/server/logserver /tmp/test_server/
cd /tmp/test_server

# Запустить сервер в тестовой директории
PORT=3003 ./logserver &

# Тестовый запрос
curl -X POST -H "Content-Type: application/json" \
  -d '{"linkId":"test-tmp"}' http://localhost:3003/api/log -v

# Проверить созданный файл
ls -la /tmp/test_server/logs.json
cat /tmp/test_server/logs.json
```

## 10. Временное решение: изменить путь к логам

```bash
# Изменить путь в коде Go на /tmp
sed -i 's/logFile = "logs.json"/logFile = "\/tmp\/maf_logs.json"/' /var/maf-guides/server/main.go

# Пересобрать
cd /var/maf-guides/server
go build -o logserver
sudo systemctl restart logserver

# Проверить
curl -X POST -H "Content-Type: application/json" \
  -d '{"linkId":"test-tmp"}' http://localhost:3002/api/log -v

ls -la /tmp/maf_logs.json
cat /tmp/maf_logs.json
```

## 11. Проверить конфигурацию systemd

```bash
# Показать полную конфигурацию сервиса
sudo systemctl cat logserver

# Проверить все параметры
sudo systemctl show logserver

# Создать упрощенный сервис
sudo tee /etc/systemd/system/logserver-simple.service << 'EOF'
[Unit]
Description=Simple Log Server for Maf Guides

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/var/maf-guides/server
ExecStart=/var/maf-guides/server/logserver
Restart=always
RestartSec=10
Environment=PORT=3002

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl stop logserver
sudo systemctl start logserver-simple
sudo systemctl status logserver-simple
```

## Если ничего не помогает

```bash
# 1. Переустановить Go сервер
cd /var/maf-guides/server

# Удалить все и создать заново
rm -f logserver logs.json
go build -o logserver
sudo systemctl restart logserver

# 2. Запустить отладчиком
sudo systemctl stop logserver
cd /var/maf-guides/server
./logserver
# (в другом терминале) curl запрос

# 3. Проверить системные лимиты
ulimit -a

# 4. Перезагрузить сервер
sudo reboot
```