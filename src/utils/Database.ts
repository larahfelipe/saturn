import mongoose from 'mongoose';

import config from '../config';

class Database {
  private static hasConnection: boolean;

  static get isConnected() {
    return this.hasConnection;
  }

  static async setConnection() {
    try {
      console.log('\n[Saturn] Requesting access to database ...\n');
      mongoose.connect(config.dbAccess!, (err) => {
        if (err) {
          throw new Error(err as any);
        }
      });
      this.hasConnection = true;
      console.log('[Saturn] Database connection established.\n');
    } catch (err) {
      console.error(err);
    }
  }
}

export default Database;
