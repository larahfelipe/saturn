async function execute(bot, msg, args) {
  let concatHelpStr = '';
  bot.commands.forEach(command => {
    if (command.help) {
      concatHelpStr += `\`${command.name}\` → ${command.help}.\n`;
    };
  });

  msg.channel.send({
    embed: {
      author: {
        name: 'UNITY Commands List',
        icon_url: bot.user.avatarURL()
      },
      description: concatHelpStr,
      color: 'C1FF00'
    }
  });
};

module.exports = {
  name: '.help',
  help: 'Commands help',
  execute
};
