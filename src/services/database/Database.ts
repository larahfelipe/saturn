import mongoose from 'mongoose';

import config from '@/config';

export class Database {
  private static hasConnection = false;

  static get isConnected() {
    return this.hasConnection;
  }

  static async setConnection() {
    try {
      console.log('\n[Saturn] Requesting access to database ...\n');
      mongoose.connect(config.dbAccess!, (err) => {
        if (err) throw err;

        this.hasConnection = true;
        console.log('[Saturn] Database connection established.\n');
      });
    } catch (err) {
      console.error(err);
    }
  }
}
