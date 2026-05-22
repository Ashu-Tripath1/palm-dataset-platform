import pino from 'pino';

// ============================================================
// Application Logger (Pino)
// In production: JSON structured logs
// In development: pretty-printed with colors
// Never use console.log in application code — use this instead
// ============================================================

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: structured JSON, ready for Vercel log drains
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

// Child loggers for specific modules
export const apiLogger = logger.child({ module: 'api' });
export const dbLogger = logger.child({ module: 'db' });
export const s3Logger = logger.child({ module: 's3' });
export const authLogger = logger.child({ module: 'auth' });
