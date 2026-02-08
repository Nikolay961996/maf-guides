# Исправление проблемы с правами доступа

Проблема: `open logs.json: permission denied` при записи в файл логов.

## Проверить текущие права

```bash
cd /var/maf-guides/server

# 1. Проверить права файла и директории
ls -la
stat logs.json
stat .

# 2. Проверить контекст SELinux (если используется)
ls -Z logs.json
ls -Z .

# 3. Проверить, кто владелец процесса
ps aux | grep logserver

# 4. Проверить доступ root к файлу
sudo -u root touch test_root.txt && echo "Root can write" && rm test_root.txt
```

## Решения проблемы

### Вариант 1: Изменить владельца файла на того же пользователя, что и процесс

```bash
# Узнать пользователя процесса
ps aux | grep logserver | grep -v grep

# Если процесс запущен от root:
sudo chown root:root logs.json
sudo chmod 644 logs.json
```

### Вариант 2: Создать новый файл с правильными правами

```bash
cd /var/maf-guides/server

# Удалить старый файл (создать резервную копию)
cp logs.json logs.json.backup
rm logs.json

# Создать новый файл от имени root
sudo -u root touch logs.json
sudo chmod 644 logs.json

# Проверить
ls -la logs.json
```

### Вариант 3: Изменить права на запись для всех (небезопасно, но для теста)

```bash
cd /var/maf-guides/server
sudo chmod 666 logs.json
ls -la logs.json
```

### Вариант 4: Проверить и исправить SELinux

```bash
# Если SELinux включен
getenforce

# Проверить контекст
ls -Z logs.json

# Если нужно изменить контекст
sudo chcon -t httpd_sys_content_t logs.json
sudo chcon -t httpd_sys_rw_content_t logs.json
```

### Вариант 5: Использовать другую директорию для логов

```bash
cd /var/maf-guides/server

# Создать директорию для логов с правильными правами
sudo mkdir -p /var/log/maf-guides
sudo chown root:root /var/log/maf-guides
sudo chmod 755 /var/log/maf-guides

# Изменить путь к файлу логов в коде
sed -i 's/logFile = "logs.json"/logFile = "\/var\/log\/maf-guides\/logs.json"/' main.go

# Пересобрать сервер
go build -o logserver
sudo systemctl restart logserver
```

## Быстрое исправление (рекомендуется)

```bash
cd /var/maf-guides/server

# 1. Удалить старый файл и создать новый
sudo rm -f logs.json
sudo touch logs.json
sudo chown root:root logs.json
sudo chmod 644 logs.json

# 2. Проверить
ls -la logs.json

# 3. Тестовый запрос
curl -X POST -H "Content-Type: application/json" -d '{"linkId":"test-perm"}' http://localhost:3002/api/log -v

# 4. Проверить логи
sudo journalctl -u logserver -n 10 --no-pager
tail -n 3 logs.json
```

## Если не работает: Диагностика

```bash
# 1. Проверить, может ли процесс писать
strace -p $(pidof logserver) -e open,openat,write 2>&1 | grep logs.json

# 2. Проверить inotify
sudo tail -f /var/log/audit/audit.log | grep logs.json

# 3. Проверить диск
df -h .
lsblk

# 4. Проверить файловую систему
mount | grep /var/maf-guides

# 5. Проверить, не переполнен ли inode
df -i .
```

## После исправления

```bash
# 1. Проверить сервис
sudo systemctl status logserver

# 2. Тестовый запрос
curl -X POST -H "Content-Type: application/json" \
  -d '{"linkId":"test-working"}' http://localhost:3002/api/log

# 3. Проверить содержимое файла
tail -n 5 logs.json

# 4. Проверить веб-сайт в браузере
```

## Предотвращение проблемы в будущем

Изменить конфигурацию systemd сервиса `/etc/systemd/system/logserver.service`:

```ini
[Service]
# Убедиться, что WorkingDirectory установлен
WorkingDirectory=/var/maf-guides/server

# Установить правильные права при запуске
ExecStartPre=/bin/chown root:root /var/maf-guides/server/logs.json
ExecStartPre=/bin/chmod 644 /var/maf-guides/server/logs.json
```

Или добавить в Go код создание файла при отсутствии:

```go
func ensureLogFile() error {
    if _, err := os.Stat(logFile); os.IsNotExist(err) {
        f, err := os.Create(logFile)
        if err != nil {
            return err
        }
        f.Close()
        os.Chmod(logFile, 0644)
    }
    return nil
}
```