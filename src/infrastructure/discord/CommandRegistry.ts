import type { CommandDefinition, CommandName } from './commandDefinitions.ts';
import type { CommandHandler } from './commands.ts';

export interface Command extends CommandHandler {
  readonly definition: CommandDefinition;
}

/** The subset of discord.js `ApplicationCommandManager` used to synchronize commands. */
export interface ApplicationCommandSink {
  set(commands: readonly CommandDefinition[]): Promise<unknown>;
}

/** Pairs each slash command definition with the handler that executes it. */
export class CommandRegistry {
  readonly #commands = new Map<string, Command>();

  constructor(
    definitions: readonly CommandDefinition[],
    handlers: Readonly<Record<CommandName, CommandHandler>>,
  ) {
    for (const definition of definitions) {
      if (this.#commands.has(definition.name)) {
        throw new Error(`Duplicate command definition "${definition.name}"`);
      }
      this.#commands.set(definition.name, { ...handlers[definition.name], definition });
    }
  }

  get definitions(): CommandDefinition[] {
    return [...this.#commands.values()].map(({ definition }) => definition);
  }

  get(name: string): Command | undefined {
    return this.#commands.get(name);
  }

  /** Overwrites the application's global commands, removing any that are no longer defined. */
  async sync(sink: ApplicationCommandSink): Promise<void> {
    await sink.set(this.definitions);
  }
}
