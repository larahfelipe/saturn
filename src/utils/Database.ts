import mongoose from 'mongoose';

export class Database {
  static isConnected: boolean;

  static setConnection () {
    mongoose
      .connect(process.env.DB_ACCESS!, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, (err) => {
        if (err) {
          return console.log('[Saturn] There was a problem while trying to connect to database!\nThis is probably related to the given access link settled in .env\nBy now, moving forward without establishing relation with the database.\n');
        }

        this.isConnected = true;
        console.log('[Saturn] Database connection established.\n');
      });
  }
}
