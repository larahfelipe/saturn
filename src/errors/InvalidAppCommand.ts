export class InvalidAppCommand extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAppCommand';
  }
}
