"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = {
    botPrefix: process.env.BOT_PREFIX,
    botToken: process.env.BOT_TOKEN,
    botDevToken: process.env.BOT_DEVTOKEN,
    dbAccess: process.env.DB_ACCESS,
    openWeatherToken: process.env.OPENWEATHER_TOKEN,
};
