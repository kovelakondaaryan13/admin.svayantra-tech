/**
 * Structured logging. JSON lines with a stable shape so logs are queryable in any
 * aggregator (and ready for Sentry/PostHog wiring). Never logs secrets.
 */
type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, scope: string, message: string, fields?: LogFields) {
  const line = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...fields,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export function logger(scope: string) {
  return {
    debug: (message: string, fields?: LogFields) => emit("debug", scope, message, fields),
    info: (message: string, fields?: LogFields) => emit("info", scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit("warn", scope, message, fields),
    error: (message: string, fields?: LogFields) => emit("error", scope, message, fields),
  };
}
