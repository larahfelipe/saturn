import type { Interaction } from 'discord.js';

export const GUILD_ID = '123456789012345678';
export const OTHER_GUILD_ID = '876543210987654321';
export const USER_ID = '100000000000000001';
export const VOICE_CHANNEL_ID = '200000000000000001';

export type ResponseCall =
  | { readonly method: 'deferReply' }
  | { readonly method: 'reply' | 'editReply'; readonly options: unknown };

/**
 * Records how an interaction is acknowledged and enforces Discord's rules:
 * one initial response, and edits only after one.
 */
abstract class FakeRepliableInteraction {
  readonly id = '300000000000000001';
  readonly user = { id: USER_ID };
  readonly guildId: string | null;
  readonly responses: ResponseCall[] = [];
  deferred = false;
  replied = false;
  failResponsesWith: Error | undefined;
  /** When set, `deferReply` completes once it settles, like a slow request to Discord. */
  acknowledgement: Promise<void> | undefined;

  constructor(guildId: string | null) {
    this.guildId = guildId;
  }

  isChatInputCommand(): boolean {
    return false;
  }

  isButton(): boolean {
    return false;
  }

  async deferReply(): Promise<void> {
    this.#acknowledge();
    this.responses.push({ method: 'deferReply' });
    await this.acknowledgement;
    this.deferred = true;
  }

  reply(options: unknown): Promise<void> {
    this.#acknowledge();
    this.responses.push({ method: 'reply', options });
    this.replied = true;
    return Promise.resolve();
  }

  editReply(options: unknown): Promise<void> {
    if (!this.deferred && !this.replied) throw new Error('Interaction was not acknowledged');
    this.#fail();
    this.responses.push({ method: 'editReply', options });
    this.replied = true;
    return Promise.resolve();
  }

  asInteraction(): Interaction {
    return this as unknown as Interaction;
  }

  #acknowledge(): void {
    if (this.deferred || this.replied) throw new Error('Interaction already acknowledged');
    this.#fail();
  }

  #fail(): void {
    if (this.failResponsesWith !== undefined) throw this.failResponsesWith;
  }
}

export interface CommandInteractionOptions {
  readonly options?: Readonly<Record<string, string>>;
  readonly guildId?: string | null;
  readonly voiceChannelId?: string | null;
  readonly cached?: boolean;
}

export class FakeCommandInteraction extends FakeRepliableInteraction {
  readonly commandName: string;
  readonly member: { readonly voice: { readonly channelId: string | null } };
  readonly options: { getString(name: string): string | null };
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
    this.options = { getString: (name) => values[name] ?? null };
    this.#cached = init.cached ?? true;
  }

  override isChatInputCommand(): boolean {
    return true;
  }

  inCachedGuild(): boolean {
    return this.#cached;
  }
}

export class FakeButtonInteraction extends FakeRepliableInteraction {
  readonly customId: string;

  constructor(customId: string, guildId: string | null = GUILD_ID) {
    super(guildId);
    this.customId = customId;
  }

  override isButton(): boolean {
    return true;
  }
}

/** An interaction type the handler does not route, such as autocomplete. */
export class FakeOtherInteraction extends FakeRepliableInteraction {
  constructor() {
    super(GUILD_ID);
  }
}
