"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Command {
    constructor(bot, description) {
        this.bot = bot;
        this.description = description;
        this.name = description.name;
    }
}
exports.default = Command;
