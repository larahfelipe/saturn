"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
class Database {
    static setConnection() {
        mongoose_1.default
            .connect(process.env.DB_ACCESS, {
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
exports.Database = Database;
