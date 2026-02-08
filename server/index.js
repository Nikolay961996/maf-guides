import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const LOG_FILE = path.join(__dirname, 'logs', 'logs.txt');
const LOG_DIR = path.dirname(LOG_FILE);

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist'))); // serve frontend static files

// Helper to write log to file
function writeLog(level, message, timestamp) {
  const line = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

// POST endpoint for receiving logs from client
app.post('/api/log', (req, res) => {
  console.log('Received log request:', req.body);
  try {
    const { logs, level, message, timestamp = new Date().toISOString() } = req.body;

    // Support both single log and batch
    if (Array.isArray(logs)) {
      logs.forEach(log => {
        const { level = 'log', message, timestamp = new Date().toISOString() } = log;
        if (message) {
          writeLog(level, message, timestamp);
        }
      });
    } else {
      const singleLevel = level || 'log';
      const singleMessage = message || logs; // backward compatibility
      if (!singleMessage) {
        return res.status(400).json({ error: 'Missing message' });
      }
      writeLog(singleLevel, singleMessage, timestamp);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error writing log:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to view logs as HTML page
app.get('/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Logs</title>
            <meta charset="utf-8">
            <style>
              body { font-family: monospace; margin: 20px; background: #111; color: #0f0; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
              h1 { color: #fff; }
            </style>
          </head>
          <body>
            <h1>Logs</h1>
            <p>No logs yet.</p>
          </body>
        </html>
      `);
    }
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const escaped = logContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Logs</title>
          <meta charset="utf-8">
          <style>
            body { font-family: monospace; margin: 20px; background: #111; color: #0f0; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
            h1 { color: #fff; }
            a { color: #0af; }
          </style>
        </head>
        <body>
          <h1>Logs</h1>
          <p><a href="/api/logs/raw">Download raw log file</a></p>
          <pre>${escaped}</pre>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error reading logs:', err);
    res.status(500).send('Internal server error');
  }
});

// Raw log file download
app.get('/api/logs/raw', (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.status(404).send('Log file not found');
    }
    res.download(LOG_FILE, 'logs.txt');
  } catch (err) {
    console.error('Error serving raw log:', err);
    res.status(500).send('Internal server error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Log server running on port ${PORT}`);
  console.log(`Log file: ${LOG_FILE}`);
});