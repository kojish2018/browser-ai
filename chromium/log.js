const fs = require('fs');
const path = require('path');

let logFilePath = '';

function setLogFilePath(filePath) {
  logFilePath = filePath;
  // ログファイルが存在しない場合は作成
  if (!fs.existsSync(path.dirname(logFilePath))) {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  }
  fs.writeFileSync(logFilePath, ''); // ファイルをクリア
}

function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  if (logFilePath) {
    fs.appendFileSync(logFilePath, logMessage + '\n');
  }
}

module.exports = {
  setLogFilePath,
  info: (message) => log('INFO', message),
  warn: (message) => log('WARN', message),
  error: (message) => log('ERROR', message),
  fatal: (message) => log('FATAL', message)
};
