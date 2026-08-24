export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private namespace: string;
  private static globalLevel: LogLevel = Logger.getInitialLevel();
  private static readonly noop = () => {};

  private static getInitialLevel(): LogLevel {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem("ORCA_LOG_LEVEL");
      if (stored) {
        const level = LogLevel[stored as keyof typeof LogLevel];
        if (level !== undefined) return level;
      }
    }
    return LogLevel.ERROR;
  }

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

  private getPrefixArgs(levelStr: string): any[] {
    const timestamp = new Date().toLocaleTimeString();
    return [
      `%c[${timestamp}] [${this.namespace}] [${levelStr}]`,
      this.getStyle(this.getLevelEnum(levelStr)),
    ];
  }

  private getLevelEnum(levelStr: string): LogLevel {
    switch (levelStr) {
      case "DEBUG":
        return LogLevel.DEBUG;
      case "INFO":
        return LogLevel.INFO;
      case "WARN":
        return LogLevel.WARN;
      case "ERROR":
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  public child(subNamespace: string): Logger {
    return new Logger(`${this.namespace}:${subNamespace}`);
  }

  get debug() {
    if (this.shouldLog(LogLevel.DEBUG)) {
      return console.debug.bind(console, ...this.getPrefixArgs("DEBUG"));
    }
    return Logger.noop;
  }

  get info() {
    if (this.shouldLog(LogLevel.INFO)) {
      return console.info.bind(console, ...this.getPrefixArgs("INFO"));
    }
    return Logger.noop;
  }

  get warn() {
    if (this.shouldLog(LogLevel.WARN)) {
      return console.warn.bind(console, ...this.getPrefixArgs("WARN"));
    }
    return Logger.noop;
  }

  get error() {
    if (this.shouldLog(LogLevel.ERROR)) {
      return console.error.bind(console, ...this.getPrefixArgs("ERROR"));
    }
    return Logger.noop;
  }
}

export const globalLogger = new Logger("global");
