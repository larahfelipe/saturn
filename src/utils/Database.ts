import mongoose from 'mongoose';

import config from '../config';

class Database {
  private static hasConnection: boolean;

  static get isConnected() {
    return this.hasConnection;
  }

  static setConnection() {
    mongoose
      .connect(config.dbAccess!, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, (err) => {
        if (err) {
          return console.log('[Saturn] There was a problem while trying to connect to database!\nThis is probably related to the given access link settled in .env\nBy now, moving forward without establishing relation with the database.\n');
        }

        this.hasConnection = true;
        console.log('[Saturn] Database connection established.\n');
      });
  }
}

export default Database;
