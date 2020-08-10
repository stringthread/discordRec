const Discord = require("discord.js");
const fs = require('fs');
const {Readable}=require('stream')
const {env}=require('process');
require('dotenv').config();

const client = new Discord.Client();

const config = require('./auth.json');

class Silence extends Readable{
  _read(){this.push(Buffer.from([0xF8,0xFF,0xFE]))}
}

// make a new stream for each time someone starts to talk
function generateOutputFile(channel, member) {
  // use IDs instead of username cause some people have stupid emojis in their name
  const fileName = `./recordings/${channel.id}-${member.id}-${Date.now()}.pcm`;
  return fs.createWriteStream(fileName);
}

var is_recording=false

client.on('message', msg => {
  if (msg.content.startsWith(config.prefix+'join')) {
    let [command, ...channelName] = msg.content.split(" ");
    if (!msg.guild) {
      return msg.reply('no private service is available in your area at the moment. Please contact a service representative for more details.');
    }
    const voiceChannel = msg.guild.channels.cache.find(ch => ch.name === channelName.join(" "));
    //console.log(voiceChannel.id);
    if (!voiceChannel || voiceChannel.type !== 'voice') {
      return msg.reply(`I couldn't find the channel ${channelName}. Can you spell?`);
    }
    voiceChannel.join()
      .then(conn => {
        msg.reply('ready!');
        conn.play(new Silence,{type:'opus'});
        //conn.on('speaking',(user,speaking)=>{console.log(`Speaking: ${user}, ${speaking}`)});
        conn.on('speaking', (user, speaking) => {
          if (speaking && !is_recording) {
            console.log(`Speaking: ${user}`)
            msg.channel.send(`I'm listening to ${user}`);
            is_recording=true
            // this creates a 16-bit signed PCM, stereo 48KHz PCM stream.
            const audioStream = conn.receiver.createStream(user,{mode:'pcm',end:'manual'});
            // create an output stream so we can dump our data in a file
            const outputStream = generateOutputFile(voiceChannel, user);
            // pipe our audio data into the file stream
            audioStream.pipe(outputStream);
            // when the stream ends (the user stopped talking) tell the user
            audioStream.on('end', () => {
              console.log(`End Speaking: ${user}`);
              is_recording=false
            });
          }
        });
      })
      .catch(console.log);
  }
  if(msg.content.startsWith(config.prefix+'leave')) {
    let [command, ...channelName] = msg.content.split(" ");
    let voiceChannel = msg.guild.channels.cache.find(ch => ch.name === channelName.join(" "));
    voiceChannel.leave();
  }
});

client.login(env.DISCORD_TOKEN);

client.on('ready', () => {
  console.log('ready!');
});
