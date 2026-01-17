export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private namespace: string;
  private static globalLevel: LogLevel = LogLevel.INFO;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  static setGlobalLevel(level: LogLevel) {
    Logger.globalLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= Logger.globalLevel;
  }

  private getStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return "color: #888;";
      case LogLevel.INFO:
        return "color: #007acc;";
      case LogLevel.WARN:
        return "color: #fb8c00;";
      case LogLevel.ERROR:
        return "color: #d32f2f; font-weight: bold;";
      default:
        return "";
    }
  }

  private formatMessage(levelStr: string, message: any[]): any[] {
    const timestamp = new Date().toLocaleTimeString();
    return [
      `%c[${timestamp}] [${this.namespace}] [${levelStr}]`,
      this.getStyle(this.getLevelEnum(levelStr)),
      ...message,
    ];
  }

  private getLevelEnum(levelStr: string): LogLevel {
      switch(levelStr) {
          case "DEBUG": return LogLevel.DEBUG;
          case "INFO": return LogLevel.INFO;
          case "WARN": return LogLevel.WARN;
          case "ERROR": return LogLevel.ERROR;
          default: return LogLevel.INFO;
      }
  }


  debug(...args: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...this.formatMessage("DEBUG", args));
    }
  }

  info(...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage("INFO", args));
    }
  }

  warn(...args: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage("WARN", args));
    }
  }

  error(...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage("ERROR", args));
    }
  }
}
