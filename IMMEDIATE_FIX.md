# Немедленное исправление проблемы

Выполните команды последовательно:

## Шаг 1: Проверить базовую информацию

```bash
# 1. Проверить SELinux
getenforce

# 2. Проверить реального пользователя процесса
ps aux | grep logserver | grep -v grep

# 3. Проверить права директории
ls -ld /var/maf-guides /var/maf-guides/server

# 4. Проверить конфигурацию systemd
sudo cat /etc/systemd/system/logserver.service
```

## Шаг 2: Временное отключение SELinux (если включен)

```bash
# Если Enforcing, временно отключить
if [ "$(getenforce)" = "Enforcing" ]; then
    echo "Отключаю SELinux..."
    sudo setenforce 0
    echo "SELinux отключен. Тестируем..."

    # Тестовый запрос
    curl -X POST -H "Content-Type: application/json" \
        -d '{"linkId":"test-selinux-off"}' http://localhost:3002/api/log -v
fi
```

## Шаг 3: Создать тестовую среду в /tmp

```bash
# Остановить текущий сервис
sudo systemctl stop logserver

# Копировать в /tmp и запустить там
sudo cp -r /var/maf-guides/server /tmp/test_server
cd /tmp/test_server

# Запустить сервер вручную
PORT=3002 ./logserver &

# Тестовый запрос
sleep 2
curl -X POST -H "Content-Type: application/json" \
    -d '{"linkId":"test-tmp"}' http://localhost:3002/api/log -v

# Проверить файл логов
ls -la logs.json
cat logs.json

# Убить тестовый процесс
pkill -f "logserver"
```

## Шаг 4: Изменить путь логов в коде

```bash
# Вернуться в рабочую директорию
cd /var/maf-guides/server

# Создать резервную копию
cp main.go main.go.original

# Изменить путь логов на /tmp
sed -i 's/logFile = "logs.json"/logFile = "\/tmp\/maf_guides_logs.json"/' main.go

# Пересобрать
go build -o logserver

# Запустить тест
./logserver &
sleep 2
curl -X POST -H "Content-Type: application/json" \
    -d '{"linkId":"test-new-path"}' http://localhost:3002/api/log -v

pkill -f "logserver"
ls -la /tmp/maf_guides_logs.json
cat /tmp/maf_guides_logs.json
```

## Шаг 5: Исправить конфигурацию systemd

```bash
# Создать упрощенную версию сервиса
sudo tee /etc/systemd/system/logserver-fixed.service << 'EOF'
[Unit]
Description=Fixed Log Server for Maf Guides
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/var/maf-guides/server
ExecStart=/var/maf-guides/server/logserver
Restart=always
RestartSec=10
Environment=PORT=3002
Environment=IPINFO_TOKEN=36682665571ba2

# Отключить ограничения
NoNewPrivileges=no
PrivateTmp=no
ProtectSystem=no
ReadWritePaths=/var/maf-guides/server

[Install]
WantedBy=multi-user.target
EOF

# Включить новый сервис
sudo systemctl daemon-reload
sudo systemctl stop logserver
sudo systemctl start logserver-fixed
sudo systemctl status logserver-fixed

# Тестовый запрос
curl -X POST -H "Content-Type: application/json" \
    -d '{"linkId":"test-fixed-service"}' http://localhost:3002/api/log -v

# Проверить логи
sudo journalctl -u logserver-fixed -n 10 --no-pager
ls -la /var/maf-guides/server/logs.json
```

## Шаг 6: Проверка веб-сайта

```bash
# После исправления обновите страницу в браузере и проверьте:
# 1. Запрос POST /api/log должен возвращать 201 Created
# 2. В браузере не должно быть ошибок 500
# 3. Файл логов должен пополняться

# Если работает, сделать постоянное исправление
sudo systemctl disable logserver
sudo systemctl enable logserver-fixed
sudo systemctl stop logserver
sudo systemctl start logserver-fixed

# Переименовать сервис
sudo mv /etc/systemd/system/logserver-fixed.service /etc/systemd/system/logserver.service
sudo systemctl daemon-reload
sudo systemctl restart logserver
```

## Шаг 7: Если ничего не помогает - переустановка

```bash
# Полная переустановка
cd /var/maf-guides/server

# Удалить всё и заново
rm -f logserver logs.json main.go

# Восстановить оригинальный main.go (если есть)
if [ -f "main.go.original" ]; then
    cp main.go.original main.go
fi

# Пересобрать
go build -o logserver

# Создать пустой файл логов
touch logs.json
chmod 644 logs.json

# Перезапустить
sudo systemctl restart logserver

# Проверить
curl -X POST -H "Content-Type: application/json" \
    -d '{"linkId":"fresh-install"}' http://localhost:3002/api/log -v
```

## Экстренное решение: временное отключение сервера логов

```bash
# Если нужно быстро запустить сайт, можно временно отключить отправку логов
# Изменить frontend/.env.production на сервере:
sudo sed -i 's/VITE_LOG_ENDPOINT=.*/VITE_LOG_ENDPOINT=/' /var/www/html/.env.production

# Или закомментировать вызов sendLogToServer в коде
# /var/www/html/assets/...js - найти и закомментировать строку с axios.post
```

Выполняйте команды по порядку. **Начните с Шага 1** и отправьте вывод.