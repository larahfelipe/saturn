import type { Interaction } from 'discord.js';

export const GUILD_ID = '123456789012345678';
export const OTHER_GUILD_ID = '876543210987654321';
export const USER_ID = '100000000000000001';
export const VOICE_CHANNEL_ID = '200000000000000001';

export interface CommandInteractionOptions {
  readonly cached?: boolean;
  readonly guildId?: string | null;
  readonly options?: Readonly<Record<string, number | string>>;
  readonly voiceChannelId?: string | null;
}

export type ResponseCall =
  | { readonly method: 'deferReply' }
  | { readonly method: 'editReply' | 'reply'; readonly options: unknown };

abstract class FakeRepliableInteraction {
  acknowledgement: Promise<void> | undefined;
  deferred = false;
  failResponsesWith: Error | undefined;
  readonly guildId: string | null;
  readonly id = '300000000000000001';
  replied = false;
  readonly responses: ResponseCall[] = [];
  readonly user = { id: USER_ID };

  constructor(guildId: string | null) {
    this.guildId = guildId;
  }

  asInteraction(): Interaction {
    return this as unknown as Interaction;
  }

  async deferReply(): Promise<void> {
    this.#acknowledge();
    this.responses.push({ method: 'deferReply' });
    await this.acknowledgement;
    this.deferred = true;
  }

  editReply(options: unknown): Promise<void> {
    if (!this.deferred && !this.replied) throw new Error('Interaction was not acknowledged');
    this.#fail();
    this.responses.push({ method: 'editReply', options });
    this.replied = true;
    return Promise.resolve();
  }

  isButton(): boolean {
    return false;
  }

  isChatInputCommand(): boolean {
    return false;
  }

  reply(options: unknown): Promise<void> {
    this.#acknowledge();
    this.responses.push({ method: 'reply', options });
    this.replied = true;
    return Promise.resolve();
  }

  #acknowledge(): void {
    if (this.deferred || this.replied) throw new Error('Interaction already acknowledged');
    this.#fail();
  }

  #fail(): void {
    if (this.failResponsesWith !== undefined) throw this.failResponsesWith;
  }
}

export class FakeButtonInteraction extends FakeRepliableInteraction {
  readonly customId: string;
  readonly member: { readonly voice: { readonly channelId: string | null } };

  constructor(
    customId: string,
    guildId: string | null = GUILD_ID,
    voiceChannelId: string | null = VOICE_CHANNEL_ID,
  ) {
    super(guildId);
    this.customId = customId;
    this.member = { voice: { channelId: voiceChannelId } };
  }

  inCachedGuild(): boolean {
    return this.guildId !== null;
  }

  override isButton(): boolean {
    return true;
  }
}

export class FakeCommandInteraction extends FakeRepliableInteraction {
  readonly commandName: string;
  readonly member: { readonly voice: { readonly channelId: string | null } };
  readonly options: {
    getInteger(name: string): number | null;
    getString(name: string): string | null;
  };

  readonly #cached: boolean;

  constructor(commandName: string, init: CommandInteractionOptions = {}) {
    super(init.guildId === undefined ? GUILD_ID : init.guildId);
    const values = init.options ?? {};
    this.commandName = commandName;
    this.member = {
      voice: {
        channelId: init.voiceChannelId === undefined ? VOICE_CHANNEL_ID : init.voiceChannelId,
      },
    };
    this.options = {
      getInteger: (name) => {
        const value = values[name];
        return typeof value === 'number' ? value : null;
      },
      getString: (name) => {
        const value = values[name];
        return typeof value === 'string' ? value : null;
      },
    };
    this.#cached = init.cached ?? true;
  }

  inCachedGuild(): boolean {
    return this.#cached;
  }

  override isChatInputCommand(): boolean {
    return true;
  }
}

export class FakeOtherInteraction extends FakeRepliableInteraction {
  constructor() {
    super(GUILD_ID);
  }
}
