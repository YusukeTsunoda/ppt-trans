/**
 * ログユーティリティ
 * エラーログの記録と管理を行う
 */

import { AppError } from './errors/AppError';
import { ErrorCode, getErrorCategory } from './errors/ErrorCodes';

/**
 * ログレベル定義
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/**
 * ログエントリーの型定義
 */
interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  code?: ErrorCode;
  category?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

/**
 * ログ設定
 */
interface LoggerConfig {
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  minLevel: LogLevel;
  maxEntries: number;
}

/**
 * Logger クラス
 */
class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enableConsole: process.env.NODE_ENV !== 'production',
      enableFile: false,
      enableRemote: process.env.NODE_ENV === 'production',
      minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      maxEntries: 100,
      ...config,
    };
  }

  /**
   * エラーログを記録
   */
  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, error, metadata);
    this.log(entry);
  }

  /**
   * 警告ログを記録
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, undefined, metadata);
    this.log(entry);
  }

  /**
   * 情報ログを記録
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, undefined, metadata);
    this.log(entry);
  }

  /**
   * デバッグログを記録
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, undefined, metadata);
    this.log(entry);
  }

  /**
   * AppErrorをログに記録
   */
  logAppError(error: AppError, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: error.timestamp,
      level: this.getLogLevelFromStatusCode(error.statusCode),
      message: error.message,
      code: error.code as ErrorCode,
      category: getErrorCategory(error.code as ErrorCode),
      metadata: {
        ...metadata,
        ...error.details,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        userMessage: error.userMessage,
      },
      stack: error.stack,
    };

    this.log(entry);
  }

  /**
   * ログエントリーを作成
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata,
    };

    if (error instanceof AppError) {
      entry.code = error.code as ErrorCode;
      entry.category = getErrorCategory(error.code as ErrorCode);
      entry.stack = error.stack;
      entry.metadata = {
        ...entry.metadata,
        ...error.details,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
      };
    } else if (error instanceof Error) {
      entry.stack = error.stack;
      entry.metadata = {
        ...entry.metadata,
        errorName: error.name,
        errorMessage: error.message,
      };
    } else if (error) {
      entry.metadata = {
        ...entry.metadata,
        error: String(error),
      };
    }

    return entry;
  }

  /**
   * ログを出力
   */
  private log(entry: LogEntry): void {
    // レベルチェック
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // バッファに追加
    this.addToBuffer(entry);

    // コンソール出力
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // ファイル出力（実装は省略）
    if (this.config.enableFile) {
      this.logToFile(entry);
    }

    // リモートログ送信（実装は省略）
    if (this.config.enableRemote) {
      this.logToRemote(entry);
    }
  }

  /**
   * ログレベルをチェック
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const minLevelIndex = levels.indexOf(this.config.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex <= minLevelIndex;
  }

  /**
   * バッファに追加
   */
  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    
    // バッファサイズを制限
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-this.config.maxEntries);
    }
  }

  /**
   * コンソールに出力
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, entry.metadata || '', entry.stack || '');
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata || '');
        break;
      case LogLevel.INFO:
        console.info(message, entry.metadata || '');
        break;
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata || '');
        break;
    }
  }

  /**
   * ファイルに出力（実装は省略）
   */
  private logToFile(entry: LogEntry): void {
    // ファイル出力の実装
    // 本番環境では適切なログファイルシステムを使用
  }

  /**
   * リモートログサービスに送信（実装は省略）
   */
  private logToRemote(entry: LogEntry): void {
    // リモートログサービスへの送信実装
    // 例: Sentry, LogRocket, DataDog など
  }

  /**
   * ステータスコードからログレベルを取得
   */
  private getLogLevelFromStatusCode(statusCode: number): LogLevel {
    if (statusCode >= 500) return LogLevel.ERROR;
    if (statusCode >= 400) return LogLevel.WARN;
    return LogLevel.INFO;
  }

  /**
   * 最近のログエントリーを取得
   */
  getRecentLogs(count: number = 50, level?: LogLevel): LogEntry[] {
    let logs = [...this.buffer];
    
    if (level) {
      logs = logs.filter(entry => entry.level === level);
    }
    
    return logs.slice(-count);
  }

  /**
   * エラーログのみを取得
   */
  getErrorLogs(count: number = 20): LogEntry[] {
    return this.getRecentLogs(count, LogLevel.ERROR);
  }

  /**
   * ログバッファをクリア
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * ログ設定を更新
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// シングルトンインスタンス
const logger = new Logger();

// エクスポート
export default logger;

/**
 * HTTPリクエストログ用のヘルパー関数
 */
export function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  userId?: string,
  error?: Error
): void {
  const level = statusCode >= 500 ? LogLevel.ERROR : 
                statusCode >= 400 ? LogLevel.WARN : 
                LogLevel.INFO;

  const message = `${method} ${url} - ${statusCode} (${duration}ms)`;
  
  const metadata = {
    method,
    url,
    statusCode,
    duration,
    userId,
  };

  if (error) {
    logger.error(message, error, metadata);
  } else if (level === LogLevel.ERROR) {
    logger.error(message, undefined, metadata);
  } else if (level === LogLevel.WARN) {
    logger.warn(message, metadata);
  } else {
    logger.info(message, metadata);
  }
}

/**
 * パフォーマンスログ用のヘルパー関数
 */
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO;
  const message = `Performance: ${operation} took ${duration}ms`;
  
  if (level === LogLevel.WARN) {
    logger.warn(message, { duration, ...metadata });
  } else {
    logger.info(message, { duration, ...metadata });
  }
}

/**
 * セキュリティイベントログ用のヘルパー関数
 */
export function logSecurityEvent(
  event: string,
  userId?: string,
  metadata?: Record<string, unknown>
): void {
  logger.warn(`Security Event: ${event}`, {
    event,
    userId,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}