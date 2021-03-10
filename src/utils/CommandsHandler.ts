import fs from 'fs';
import path from 'path';

import { Bot } from '..';

export class Commands {
  static readonly modulesLength: number[] = [];

  static loadAndSet(bot: Bot) {
    const commandsDirectory = fs.readdirSync(path.join(__dirname, '../commands'));

    for (const section of commandsDirectory) {
      const parentSection = fs.readdirSync(path.join(__dirname, '../commands', section));
      this.modulesLength.push(parentSection.length);

      parentSection.forEach(elmt => {
        if (elmt.endsWith('.js') || elmt.endsWith('.ts')) {
          const getCommand = require(`../commands/${section}/${elmt}`).default;
          bot.commands.set(getCommand.name, getCommand);
        } else {
          const childSection = fs.readdirSync(path.join(__dirname, `../commands/${section}`, elmt));

          for (const file of childSection) {
            const getCommand = require(`../commands/${section}/${elmt}/${file}`).default;
            bot.commands.set(getCommand.name, getCommand);
          }
        }
      });
    }
  }
}
