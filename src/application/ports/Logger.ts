export interface Logger {
  child(bindings: Record<string, unknown>): Logger;
  debug(context: object, message?: string): void;
  error(context: object, message?: string): void;
  info(context: object, message?: string): void;
  warn(context: object, message?: string): void;
}
