"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Commands = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Commands {
    static loadAndSet(bot) {
        const commandsDirectory = fs_1.default.readdirSync(path_1.default.join(__dirname, '../commands'));
        for (const section of commandsDirectory) {
            const parentSection = fs_1.default.readdirSync(path_1.default.join(__dirname, '../commands', section));
            this.modulesLength.push(parentSection.length);
            parentSection.forEach(elmt => {
                if (elmt.endsWith('.js') || elmt.endsWith('.ts')) {
                    const getCommand = require(`../commands/${section}/${elmt}`).default;
                    bot.commands.set(getCommand.name, getCommand);
                }
                else {
                    const childSection = fs_1.default.readdirSync(path_1.default.join(__dirname, `../commands/${section}`, elmt));
                    for (const file of childSection) {
                        const getCommand = require(`../commands/${section}/${elmt}/${file}`).default;
                        bot.commands.set(getCommand.name, getCommand);
                    }
                }
            });
        }
    }
}
exports.Commands = Commands;
Commands.modulesLength = [];
