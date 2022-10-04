import type {
  CacheType,
  CommandInteraction,
  GuildMember,
  Interaction
} from 'discord.js';

import {
  APP_COMMAND_ERROR_DESCRIPTION,
  APP_COMMAND_ERROR_TITLE,
  APP_ERROR_COLOR,
  APP_MAIN_COLOR,
  APP_MUSIC_PLAYBACK_PHRASE,
  APP_MUSIC_PLAYBACK_TITLE,
  APP_QUEUE_TITLE,
  APP_SKIP_TRACK_DESCRIPTION,
  APP_SKIP_TRACK_TITLE,
  APP_STOP_MUSIC_PLAYBACK_DESCRIPTION,
  APP_STOP_MUSIC_PLAYBACK_TITLE,
  APP_SUCCESS_COLOR,
  APP_WARNING_COLOR,
  CD_GIF_URL
} from '@/constants';
import { Embed } from '@/structures/Embed';
import type { BroadcastData, Queue } from '@/types';

import { getImagePaletteColors } from './GetImagePaletteColors';

type AudioPlayerQueueCreationPayload = {
  broadcastData: BroadcastData;
  queue: Queue;
};

type AudioPlayerQueueCreationProps = {
  interaction: CommandInteraction;
  payload: AudioPlayerQueueCreationPayload;
};

type AudioPlayerPlayingProps = {
  interaction: CommandInteraction;
  payload: BroadcastData;
};

const embed = Embed.getInstance();

export class ChannelMessagingUtils {
  static async makeBotCommandErrorEmbed(interaction: Interaction<CacheType>) {
    await embed.build(interaction, {
      author: {
        name: APP_COMMAND_ERROR_TITLE
      },
      description: APP_COMMAND_ERROR_DESCRIPTION,
      color: APP_ERROR_COLOR
    });
  }

  static async makeVCConnectionSignallingEmbed(
    interaction: CommandInteraction
  ) {
    await embed.build(interaction, {
      title: APP_MUSIC_PLAYBACK_TITLE,
      description: `Joining channel \`${
        (interaction.member as GuildMember).voice.channel!.name
      }\``,
      color: APP_SUCCESS_COLOR
    });
  }

  static async makeAudioPlayerQueueCreationEmbed({
    interaction,
    payload
  }: AudioPlayerQueueCreationProps) {
    const { broadcastData, queue } = payload;

    await embed.build(interaction, {
      title: APP_QUEUE_TITLE,
      description: `Got it! [${broadcastData.track.data.title}](${
        broadcastData.track.data.url
      }) was added to the queue and his current position is \`${
        queue.indexOf(broadcastData) + 1
      }\``,
      footer: {
        text: `Added by ${interaction.member?.user.username}`
      },
      timestamp: new Date(),
      color: APP_MAIN_COLOR
    });
  }

  static async makeAudioPlayerTrackPlayingEmbed({
    interaction,
    payload
  }: AudioPlayerPlayingProps) {
    const { track, requesterId } = payload;

    const thumbnailPredominantColors = await getImagePaletteColors(
      track.data.thumbnail
    );

    await embed.build(interaction, {
      author: {
        name: APP_MUSIC_PLAYBACK_PHRASE,
        iconURL: CD_GIF_URL
      },
      thumbnail: track.data.thumbnail,
      description: `Now playing **[${track.data.title}](${track.data.url})** requested by <@${requesterId}>`,
      footer: {
        text: `Track duration: ${track.data.duration}`
      },
      color: thumbnailPredominantColors.LightVibrant ?? APP_MAIN_COLOR
    });
  }

  static async makeAudioPlayerTrackSkippedEmbed(
    interaction: CommandInteraction
  ) {
    await embed.build(interaction, {
      title: APP_SKIP_TRACK_TITLE,
      description: APP_SKIP_TRACK_DESCRIPTION,
      color: APP_MAIN_COLOR
    });
  }

  static async makeAudioPlayerStoppedEmbed(interaction: CommandInteraction) {
    await embed.build(interaction, {
      title: APP_STOP_MUSIC_PLAYBACK_TITLE,
      description: APP_STOP_MUSIC_PLAYBACK_DESCRIPTION,
      color: APP_WARNING_COLOR
    });
  }
}
