"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
class CommandHandler {
    constructor(bot) {
        this.bot = bot;
    }
    resolveAndSet(foo) {
        let TargetCommand;
        if (foo.length === 3) {
            TargetCommand =
                require(`../commands/${foo[0]}/${foo[1]}/${foo[2]}`).default;
        }
        else {
            TargetCommand = require(`../commands/${foo[0]}/${foo[1]}`).default;
        }
        const resolvedCommand = new TargetCommand(this.bot);
        this.bot.commands.set(resolvedCommand.name, resolvedCommand);
    }
    async loadCommands() {
        try {
            const commandsDir = fs_1.readdirSync(path_1.join(__dirname, '../commands'));
            for (const categorySection of commandsDir) {
                const currCategoryChildren = fs_1.readdirSync(path_1.join(__dirname, '../commands', categorySection));
                CommandHandler.modulesLength.push(categorySection.length);
                currCategoryChildren.forEach((child) => {
                    if (child.endsWith('.js') || child.endsWith('.ts')) {
                        this.resolveAndSet([categorySection, child]);
                    }
                    else {
                        const secondChildSection = fs_1.readdirSync(path_1.join(__dirname, `../commands/${categorySection}`, child));
                        for (const elmt of secondChildSection) {
                            this.resolveAndSet([categorySection, child, elmt]);
                        }
                    }
                });
            }
        }
        catch (err) {
            console.error(err);
        }
    }
}
CommandHandler.modulesLength = [];
exports.default = CommandHandler;
