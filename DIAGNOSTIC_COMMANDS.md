# Команды для диагностики сервера

Выполните эти команды через SSH на сервере `tiles-guides.fun` (45.135.233.197).

## 1. Проверить статус сервиса Go
```bash
sudo systemctl status logserver
```

## 2. Посмотреть логи сервиса (последние 50 строк)
```bash
sudo journalctl -u logserver -n 50 --no-pager
```

## 3. Проверить, работает ли сервер на порту 3002
```bash
sudo netstat -tlnp | grep :3002
```
или
```bash
sudo ss -tlnp | grep :3002
```

## 4. Проверить права доступа к директории сервера
```bash
ls -la /var/maf-guides/server/
```

## 5. Проверить содержимое файла логов
```bash
tail -n 20 /var/maf-guides/server/logs.json
```

## 6. Проверить конфигурацию сервиса systemd
```bash
sudo cat /etc/systemd/system/logserver.service
```

## 7. Проверить переменные окружения сервиса
```bash
sudo systemctl show logserver | grep Environment
```

## 8. Проверить, может ли сервер писать в файл
```bash
sudo -u root touch /var/maf-guides/server/test.txt && echo "Файл создан успешно" && rm /var/maf-guides/server/test.txt
```

## 9. Проверить доступ к ipinfo.io с сервера
```bash
curl -v "https://ipinfo.io/json?token=36682665571ba2"
```

## 10. Проверить конфигурацию Nginx (если используется)
```bash
sudo nginx -t
```
```bash
sudo cat /etc/nginx/sites-available/your-site
```
или найти конфиг:
```bash
sudo find /etc/nginx -name "*.conf" -exec grep -l "tiles-guides" {} \;
```

## 11. Проверить логи Nginx
```bash
sudo tail -n 20 /var/log/nginx/error.log
```
```bash
sudo tail -n 20 /var/log/nginx/access.log | grep "POST /api/log"
```

## 12. Перезапустить сервис и посмотреть ошибки
```bash
sudo systemctl restart logserver
sudo systemctl status logserver
```

## 13. Запустить сервер вручную для отладки
```bash
cd /var/maf-guides/server
PORT=3002 ./logserver
```

## Дополнительная проверка:
### Проверить CORS заголовки
```bash
curl -X OPTIONS -H "Origin: https://tiles-guides.fun" -H "Access-Control-Request-Method: POST" -v https://tiles-guides.fun/api/log
```

### Проверить POST запрос напрямую к серверу
```bash
curl -X POST -H "Content-Type: application/json" -d '{"linkId":"test","timestamp":"2026-02-08T10:30:00Z"}' http://localhost:3002/api/log -v
```

### Проверить доступ к логам через GET
```bash
curl http://localhost:3002/logs
```

---

**После выполнения команд пришлите вывод.** Особенно важно:
- Статус сервиса (п.1)
- Логи сервиса (п.2)
- Ответ от ipinfo.io (п.9)
- Результат тестового POST запроса (п.14)