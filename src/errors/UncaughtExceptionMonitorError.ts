export class UncaughtExceptionMonitorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UncaughtExceptionMonitorError';
  }
}
