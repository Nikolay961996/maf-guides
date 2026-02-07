import axios from 'axios';

const LOG_ENDPOINT = import.meta.env.VITE_LOG_ENDPOINT || '/api/log';
const ENABLED = import.meta.env.VITE_APP_ENV !== 'test'; // можно добавить фlag

// Очередь для батчинга логов
let logQueue: any[] = [];
let flushTimeout: any = null;
const FLUSH_DELAY = 2000; // 2 секунды
const MAX_QUEUE_SIZE = 10;

// Отправка логов на сервер
async function sendLogs(logs: any[]) {
  if (!ENABLED || !LOG_ENDPOINT) {
    originalConsole.log('Logging disabled or no endpoint', { ENABLED, LOG_ENDPOINT });
    return;
  }

  try {
    originalConsole.log('Sending logs:', logs);
    await axios.post(LOG_ENDPOINT, { logs });
    originalConsole.log('Logs sent successfully');
  } catch (error) {
    // Если ошибка, выводим в оригинальную консоль
    originalConsole.error('Failed to send logs:', error);
  }
}

// Функция добавления лога в очередь
function queueLog(level: string, args: any[]) {
  if (!ENABLED) return;

  const timestamp = new Date().toISOString();
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');

  logQueue.push({ level, message, timestamp });

  // Если очередь достигла максимального размера, сразу отправить
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    flushLogs();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, FLUSH_DELAY);
  }
}

// Отправка очереди
function flushLogs() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (logQueue.length > 0) {
    const logsToSend = [...logQueue];
    logQueue = [];
    sendLogs(logsToSend);
  }
}

// Сохраняем оригинальные методы консоли
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Debug
originalConsole.log('Logger config:', { LOG_ENDPOINT, ENABLED, env: import.meta.env });

// Переопределяем console.log
console.log = function(...args) {
  originalConsole.log(...args);
  queueLog('log', args);
};

console.error = function(...args) {
  originalConsole.error(...args);
  queueLog('error', args);
};

console.warn = function(...args) {
  originalConsole.warn(...args);
  queueLog('warn', args);
};

console.info = function(...args) {
  originalConsole.info(...args);
  queueLog('info', args);
};

console.debug = function(...args) {
  originalConsole.debug(...args);
  queueLog('debug', args);
};

// Экспортируем функцию для ручного логирования
export const logger = {
  log: (...args: any[]) => {
    originalConsole.log(...args);
    queueLog('log', args);
  },
  error: (...args: any[]) => {
    originalConsole.error(...args);
    queueLog('error', args);
  },
  warn: (...args: any[]) => {
    originalConsole.warn(...args);
    queueLog('warn', args);
  },
  info: (...args: any[]) => {
    originalConsole.info(...args);
    queueLog('info', args);
  },
  debug: (...args: any[]) => {
    originalConsole.debug(...args);
    queueLog('debug', args);
  },
  flush: flushLogs,
};

// При разгрузке страницы отправляем оставшиеся логи
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushLogs);
  window.addEventListener('pagehide', flushLogs);
}

// Для тестирования
if (import.meta.env.DEV) {
  logger.log('Logger initialized');
}