import axios, { AxiosError, AxiosResponse } from 'axios';

import yts, { SearchResult, VideoMetadataResult, VideoSearchResult } from 'yt-search';
import ytdl from 'ytdl-core';

import { Message, MessageEmbed, VoiceConnection, StreamDispatcher } from 'discord.js';
import { Bot } from '../../..';

import { Reaction } from '../../../utils/ReactionsHandler';
import { dropBotQueueConnection } from '../../../utils/DropBotQueueConnection';

type Song = VideoMetadataResult | VideoSearchResult;
type SearchError = Error | string | null | undefined;

export interface IQueue {
  connection: VoiceConnection;
  songs: [{
    title: string;
    timestamp: string;
    seconds: number;
  }];
  authors: string[];
  volume: number;
  dispatcher: StreamDispatcher | null;
}

async function run (bot: Bot, msg: Message, args: string[]) {
  let querySong = args.join(' ');
  let song: Song;
  try {
    if (ytdl.validateURL(querySong)) {
      song = await yts({ videoId: ytdl.getURLVideoID(querySong) });
      handlePlaySong();
    } else {
      if (querySong.startsWith('https://open.spotify.com/track/')) {
        await axios
          .get(querySong)
          .then(({ data }: AxiosResponse<string>) => {
            const htmlData = data;
            querySong = htmlData.substring(htmlData.indexOf('<ti') + 7, htmlData.indexOf('|') - 1);
          })
          .catch((err: AxiosError) => {
            console.log('Error search');
            throw err;
          });
      }

      yts(querySong, (err: SearchError, res: SearchResult) => {
        if (err) return console.error(err);

        if (res && res.videos.length > 0) {
          song = res.videos[0];
          handlePlaySong();
        } else return msg.reply('Sorry!, I couldn\'t find any song related to your search.');
      });
    }
  } catch (err) {
    console.error(err);
    msg.reply('You need to give me a song in order to play it!');
  }


  function handlePlaySong() {
    const queueExists = bot.queues.get(msg.guild!.id);
    if (!queueExists) {
      setSong(bot, msg, song, msg.author.id);

      const embed = new MessageEmbed();
      embed
        .setTitle('🎵  Music Playback')
        .setDescription(`Joining channel \`${msg.member!.voice.channel!.name}\``)
        .setColor('#6E76E5');
      msg.channel.send({ embed });
    } else {
      queueExists.songs.push(song);
      queueExists.authors.push(msg.author.id);
      bot.queues.set(msg.guild!.id, queueExists);

      const embed = new MessageEmbed();
      embed
        .setTitle('📃  Queue')
        .setDescription(`Got it! [${song.title}](${song.url}) was added to the queue and his current position is \`${queueExists.songs.indexOf(song)}\`.\n\nYou can see the guild's queue anytime using \`.queue\``)
        .setFooter(`Added by ${msg.author.username}`, msg.author.displayAvatarURL())
        .setTimestamp(new Date())
        .setColor('#6E76E5');
      msg.channel.send({ embed });
    }
  }
}

export async function setSong (bot: Bot, msg: Message, song: any, msgAuthor: string) {
  let queue: IQueue = bot.queues.get(msg.guild!.id);

  if (!song) {
    if (queue) {
      queue.connection.disconnect();
      return bot.queues.delete(msg.guild!.id);
    }
  }

  if (!msg.member?.voice.channel) return msg.reply('You need to be in a voice channel in order to play a song!');

  if (!queue) {
    const botConnection = await msg.member.voice.channel.join();

    queue = {
      connection: botConnection,
      songs: [song],
      authors: [msgAuthor],
      volume: 10,
      dispatcher: null
    };
  }

  try {
    queue.dispatcher = queue.connection.play(
      ytdl(song.url, {
        filter: 'audioonly',
        quality: 'highestaudio'
      })
    );

    const embed = new MessageEmbed();
    embed
      .setAuthor('We hear you 💜', 'https://raw.githubusercontent.com/felpshn/saturn-bot/master/assets/cd.gif')
      .setThumbnail(song.thumbnail)
      .setDescription(`Now playing **[${song.title}](${song.url})** requested by <@${queue.authors[0]}>`)
      .setFooter(`Song duration: ${song.timestamp}`)
      .setColor('#6E76E5');

    msg.channel.send({ embed })
      .then((sentMsg) => { Reaction.handleMusicControls(bot, msg, sentMsg) });

    queue.dispatcher.on('finish', () => {
      queue.songs.shift();
      queue.authors.shift();
      Reaction.handleDeletion(true);

      setSong(bot, msg, queue.songs[0], queue.authors[0]);
    });

    bot.queues.set(msg.guild!.id, queue);
  } catch (err) {
    dropBotQueueConnection(bot, msg);
    console.error(err);
  }
}

export default {
  name: `${process.env.BOT_PREFIX}play`,
  help: 'Plays song from YouTube or Spotify',
  permissionLvl: 0,
  run
};
