import fs from "node:fs";
import path from "node:path";
import type { LogLevel } from "./log.types";

export class LogService {
  private logFile: string;

  constructor(logDir: string = path.join(__dirname, "logs")) {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFile = path.join(logDir, `app.log`);
  }

  log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage, "utf8");
  }

  info(message: string): void {
    this.log("INFO", message);
  }

  error(message: string): void {
    this.log("ERROR", message);
  }

  debug(message: string): void {
    this.log("DEBUG", message);
  }
}

export const logService = new LogService();
