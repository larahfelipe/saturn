"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
class Database {
    static get isConnected() {
        return this.hasConnection;
    }
    static setConnection() {
        mongoose_1.default.connect(config_1.default.dbAccess, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        }, (err) => {
            if (err) {
                return console.log('[Saturn] There was a problem while trying to connect to database!\nThis is probably related to the given access link settled in .env\nBy now, moving forward without establishing relation with the database.\n');
            }
            this.hasConnection = true;
            console.log('[Saturn] Database connection established.\n');
        });
    }
}
exports.default = Database;
