export class UnhandledPromiseRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnhandledPromiseRejectionError';
  }
}
