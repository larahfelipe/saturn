const yts = require('yt-search');
const ytdl = require('ytdl-core-discord');

const MessageEmbed = require('discord.js').MessageEmbed;
const embed = new MessageEmbed();


async function playSong(bot, msg, song, reqSongUserId) {
  let isQueueExists = bot.queues.get(msg.member.guild.id);

  if (!song) {
    if (isQueueExists) {
      queue.connection.disconnect();
      return bot.queues.delete(msg.member.guild.id);
    };
  };

  if (!msg.member.voice.channel) {
    return msg.reply('You need to be in a voice channel in order to play a song');
  };

  if (!isQueueExists) {
    const botConnection = await msg.member.voice.channel.join();
    queue = {
      volume: 10,
      connection: botConnection,
      dispatcher: null,
      songs: [song],
      author: [reqSongUserId]
    };
  };

  embed
    .setAuthor('We hear you 💚')
    .setTitle('')
    .setThumbnail(song.thumbnail)
    .setDescription(`Now playing **[${song.title}](${song.url})** requested by <@${queue.author[0]}>`)
    .setColor('#C1FF00');
  msg.channel.send({ embed });

  queue.dispatcher = await queue.connection.play(
    await ytdl(song.url, {
      filter: 'audioonly',
      quality: 'highestaudio'
    }), {
    type: 'opus'
  });

  queue.dispatcher.on('finish', () => {
    queue.songs.shift();
    queue.author.shift();
    playSong(bot, msg, queue.songs[0], queue.author);
  });

  bot.queues.set(msg.member.guild.id, queue);
  //console.log(bot.queues);
};

async function execute(bot, msg, args) {
  try {
    let song = args.join(' ');

    if (song.startsWith('https://')) {
      const ytVideoId = song.slice(song.indexOf('=') + 1, song.length);
      song = await yts({ videoId: ytVideoId });
      handlePlaySong();
    } else {
      yts(song, (err, res) => {
        if (err) {
          throw err;
        } else if (res && res.videos.length > 0) {
          //console.log(res);
          song = res.videos[0];
          handlePlaySong();
        } else {
          return msg.reply('Sorry!, I couldn\'t find any song related to your search.');
        };
      });
    };

    function handlePlaySong() {
      const reqSongUserId = msg.author.id;
      const isQueueAlreadyExists = bot.queues.get(msg.guild.id);
      if (!isQueueAlreadyExists) {
        try {
          playSong(bot, msg, song, reqSongUserId);

          embed
            .setAuthor('')
            .setTitle('🎵  Music Playback')
            .setThumbnail('')
            .setDescription(`Joining channel \`${msg.member.voice.channel.name}\``)
            .setColor('#C1FF00');
          msg.channel.send({ embed });
        } catch (e) {
          console.error(e);
        };
      } else {
        queue.songs.push(song);
        queue.author.push(reqSongUserId);
        bot.queues.set(msg.guild.id, queue);

        embed
          .setAuthor('')
          .setTitle('🗒  Queue')
          .setThumbnail('')
          .setDescription(`Got it! [${song.title}](${song.url}) was added to the guild queue.`)
          .setColor('#C1FF00');
        msg.channel.send({ embed });
      };
    };
  } catch (e) {
    console.error(e);
  };
};

module.exports = {
  name: '.play',
  help: 'Plays music from YouTube',
  execute,
  playSong
};
