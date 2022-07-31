export class MissingRequiredCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingRequiredCredentialsError';
  }
}
