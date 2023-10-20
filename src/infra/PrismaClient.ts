import { PrismaClient as DPrismaClient } from '@prisma/client';

import config from '@/config';
import {
  APP_DATABASE_CONNECTED,
  APP_FOUND_DATABASE_ACCESS_URL
} from '@/constants';

export class PrismaClient extends DPrismaClient {
  private static INSTANCE: PrismaClient;
  private connectionEstablished: boolean;

  private constructor() {
    super();
    this.connectionEstablished = false;
  }

  static getInstance() {
    if (!this.INSTANCE) this.INSTANCE = new PrismaClient();
    return this.INSTANCE;
  }

  isConnected() {
    return this.connectionEstablished;
  }

  setIsConnected(value: boolean) {
    this.connectionEstablished = value;
  }

  async createConnection() {
    if (!config.dbAccessUrl) return;
    console.log(APP_FOUND_DATABASE_ACCESS_URL);

    await this.$connect();

    this.setIsConnected(true);
    console.log(APP_DATABASE_CONNECTED);
  }

  async closeConnection() {
    await this.$disconnect();
    this.setIsConnected(false);
  }
}
