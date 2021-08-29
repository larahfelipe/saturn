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
    static async setConnection() {
        try {
            console.log('\n[Saturn] Requesting access to database ...\n');
            mongoose_1.default.connect(config_1.default.dbAccess, (err) => {
                if (err) {
                    throw new Error(err);
                }
            });
            this.hasConnection = true;
            console.log('[Saturn] Database connection established.\n');
        }
        catch (err) {
            console.error(err);
        }
    }
}
exports.default = Database;
