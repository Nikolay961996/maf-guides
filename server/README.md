# Log Server (Go)

Простой HTTP сервер для приема и хранения логов аналитики.

## Запуск

```bash
cd server
go run main.go
```

Сервер запустится на порту 3002 (по умолчанию). Можно изменить порт через переменную окружения `PORT`:

```bash
PORT=3003 go run main.go
```

## API

### `POST /api/log`

Принимает JSON с данными лога:

```json
{
  "linkId": "123",
  "timestamp": "2026-02-08T10:00:00Z",
  "ipAddress": "192.168.1.1",
  "country": "Russia",
  "countryCode": "RU",
  "region": "Moscow",
  "city": "Moscow",
  "userAgent": "Mozilla/5.0...",
  "referrer": "https://example.com",
  "screenResolution": "1920x1080",
  "language": "ru"
}
```

Все поля опциональны, кроме `linkId`. Если `timestamp` не указан, будет использовано текущее время.

Ответ: `{"status":"ok"}`

### `GET /logs`

Возвращает массив всех сохраненных логов в формате JSON.

## Хранение

Логи сохраняются в файл `logs.json` в текущей директории. Каждая запись - JSON объект на новой строке.

## Интеграция с клиентом

Клиентское приложение отправляет логи через `VITE_LOG_ENDPOINT` (см. `.env.local`).