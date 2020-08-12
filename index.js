const Discord = require("discord.js");
const fs = require('fs');
const {EventEmitter} = require('events');
const {Readable}=require('stream')
const {env}=require('process');
const encode_voice=require('./encode_voice/encode_voice.js')
const Mixer=require('audio-mixer');
require('dotenv').config();

const config = require('./auth.json');

class Silence extends Readable{
  _read(){this.push(Buffer.from([0xF8,0xFF,0xFE]))}
}

class MixSave{
  constructor(rs_list,filename){
    this.filename=filename;
    this.mixer = new Mixer.Mixer({
      channels: 2,
      bitDepth: 16,
      sampleRate: 48000,
      clearInterval: 250
    });
    for (var i = 0; i < rs_list.length; i++) {
      this.add_rs(rs_list[i]);
    }
    this.ws=fs.createWriteStream(this.filename);
    this.mixer.pipe(this.ws);
  }
  add_rs(rs){
    var new_in=this.mixer.input({})
    rs.on('end',(()=>{
      this.mixer.removeInput(new_in);
      if(this.mixer.inputs.length==0) this.close();
    }).bind(this))
    .on('close',(()=>{
      this.mixer.removeInput(new_in);
      if(this.mixer.inputs.length==0) this.close();
    }).bind(this))
    .pipe(new_in);
  }
  close(){
    this.mixer.unpipe();
    this.mixer.close();
    this.mixer.destroy();
    this.ws.destroy();
    encode_voice(this.filename);
  }
}

class FileSave extends EventEmitter{
  constructor(audioStream,filename){
    super();
    this.rs=audioStream;
    this.filename=filename;
    this.ws=fs.createWriteStream(this.filename);
    this.rs.pipe(this.ws);
    this.rs.on('end',(()=>this.emit('end')).bind(this));
    this.rs.on('error',((e)=>this.emit({'err':e,'obj':this.rs,'obj_name':'FileSave.rs'})).bind(this));
    this.ws.on('error',((e)=>this.emit({'err':e,'obj':this.ws,'obj_name':'FileSave.ws'})).bind(this));
  }
  encode(){
    if(this.filename) encode_voice(this.filename).catch(console.log);
  }
}

class Bot{
  generateDirPath(channel){
    this.dirpath=`./recordings/${channel.name}-${Date.now()}`;
    fs.mkdir(this.dirpath,()=>{});
  }
  generateOutName(channel, member) {
    //if(!this.dirpath)generateDirPath(channel);
    //return `${this.dirpath}/${member.id}-${Date.now()}.pcm`;
    return `./recordings/${channel.name}-${Date.now()}.pcm`;
  }

  constructor(id){
    this.client = new Discord.Client();

    this.id=id;
    this.rec_users=new Set();
    this.filesaves=new Set();
    this.dirpath=''
    this.mixsave=null;

    this.client.on('message', (msg => {
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
        //this.generateDirPath(voiceChannel);
        voiceChannel.join()
          .then(conn => {
            msg.reply('ready!');
            conn.play(new Silence,{type:'opus'});
            //conn.on('speaking',(user,speaking)=>{console.log(`Speaking: ${user}, ${speaking}`)});
            conn.on('speaking', (user, speaking) => {
              if (speaking && !this.rec_users.has(user.id)) {
                console.log(`Speaking: ${user}`)
                msg.channel.send(`I'm listening to ${user}`);
                if(!this.mixsave)this.mixsave=new MixSave(
                  [conn.receiver.createStream(user,{mode:'pcm',end:'manual'})],
                  this.generateOutName(voiceChannel, user));
                else this.mixsave.add_rs(conn.receiver.createStream(user,{mode:'pcm',end:'manual'}));
                this.rec_users.add(user.id);
                /*var filesave=new FileSave(conn.receiver.createStream(user,{mode:'pcm',end:'manual'}),this.generateOutName(voiceChannel, user));
                filesave.on('end', (() => {
                  console.log(`End Speaking: ${user}`);
                  this.rec_users.delete(user.id);
                  this.filesaves.delete(filesave);
                }).bind(this));
                this.filesaves.add(filesave);*/
              }
            });
          })
          .catch(console.log);
      }
      if(msg.content.startsWith(config.prefix+'leave')) {
        let [command, ...channelName] = msg.content.split(" ");
        let voiceChannel = msg.guild.channels.cache.find(ch => ch.name === channelName.join(" "));
        voiceChannel.leave();
        this.rec_users.clear()
        for(var item of this.filesaves){item.encode();}
        this.filesaves.clear();
        this.mixsave.close();
        this.dirpath='';
      }
    }).bind(this));

    this.client.login(env[`DISCORD_TOKEN_${this.id+1}`]);

    this.client.on('ready', () => {
      console.log('ready!');
    });
  }
}

var bots=[...Array(env.NUM_BOTS)].map((_,i)=>new Bot(i));
