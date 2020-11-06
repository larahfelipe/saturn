module.exports = {
  name: '.say',
  help: 'Repeats what user says',
  execute: async function (bot, msg, args) {
    const argsConcat = args.join(' ');
    if (argsConcat === 'im stupid' || argsConcat === 'i\'m stupid') {
      msg.reply('Yeah, we know.');
    } else {
      const argsCapitalized = argsConcat[0].toUpperCase() + argsConcat.slice(1);
      msg.reply(argsCapitalized);
    };
  }
};
