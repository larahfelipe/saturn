import { PrismaClient as DPrismaClient } from '@prisma/client';

import config from '@/config';
import {
  APP_DATABASE_CONNECTED,
  APP_FOUND_DATABASE_ACCESS_URL
} from '@/constants';

export class PrismaClient extends DPrismaClient {
  private static INSTANCE: PrismaClient;
  private isClientConnected: boolean;

  private constructor() {
    super();
    this.isClientConnected = false;
  }

  static getInstance() {
    if (!this.INSTANCE) this.INSTANCE = new PrismaClient();
    return this.INSTANCE;
  }

  isConnected() {
    return this.isClientConnected;
  }

  setIsConnected(value: boolean) {
    this.isClientConnected = value;
  }

  async createConnection() {
    if (!config.dbAccessUrl) return;
    console.log(APP_FOUND_DATABASE_ACCESS_URL);

    try {
      await this.$connect();
      this.setIsConnected(true);
      console.log(APP_DATABASE_CONNECTED);
    } catch (e) {
      console.error(e);
    }
  }

  async closeConnection() {
    try {
      await this.$disconnect();
      this.setIsConnected(false);
    } catch (e) {
      console.error(e);
    }
  }
}
