import { readdirSync } from 'fs';
import { join } from 'path';

import Bot from '../structs/Bot';
import Command from '../structs/Command';

class CommandHandler {
  static modulesLength: number[] = [];
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  private resolveAndSet(foo: string[]) {
    let TargetCommand: any;
    if (foo.length === 3) {
      TargetCommand =
        require(`../commands/${foo[0]}/${foo[1]}/${foo[2]}`).default;
    } else {
      TargetCommand = require(`../commands/${foo[0]}/${foo[1]}`).default;
    }
    const resolvedCommand: Command = new TargetCommand(this.bot);

    this.bot.commands.set(resolvedCommand.name, resolvedCommand);
  }

  async loadCommands() {
    try {
      const commandsDir = readdirSync(join(__dirname, '../commands'));
      for (const categorySection of commandsDir) {
        const currCategoryChildren = readdirSync(
          join(__dirname, '../commands', categorySection)
        );
        CommandHandler.modulesLength.push(categorySection.length);

        currCategoryChildren.forEach((child) => {
          if (child.endsWith('.js') || child.endsWith('.ts')) {
            this.resolveAndSet([categorySection, child]);
          } else {
            const secondChildSection = readdirSync(
              join(__dirname, `../commands/${categorySection}`, child)
            );
            for (const elmt of secondChildSection) {
              this.resolveAndSet([categorySection, child, elmt]);
            }
          }
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
}

export default CommandHandler;
