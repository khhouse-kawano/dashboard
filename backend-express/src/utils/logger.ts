/**
 * 最小限のロガー。
 * 将来 pino / winston に差し替える場合も、呼び出し側はこの logger を使い続ければよい。
 */

type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: unknown): void => {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (meta === undefined) {
    console[level](line);
  } else {
    console[level](line, meta);
  }
};

export const logger = {
  info: (message: string, meta?: unknown): void => write('info', message, meta),
  warn: (message: string, meta?: unknown): void => write('warn', message, meta),
  error: (message: string, meta?: unknown): void => write('error', message, meta),
};
