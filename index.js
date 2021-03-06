const Discord = require("discord.js");
const fs = require('fs');
const {EventEmitter} = require('events');
const {Readable}=require('stream')
const {env}=require('process');
const encode_voice=require('./encode_voice/encode_voice.js');
const Mixer=require('audio-mixer');
const {formatToTimeZone}=require('date-fns-timezone');
require('dotenv').config();

const config = require('./auth.json');

const outputDir=('OUTPUT_DIR' in env)?env.OUTPUT_DIR.replace(/\/$/,''):'./recordings';

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
    console.log(`${this.filename} created`);
    this.mixer.pipe(this.ws);
    this.recording=true;
  }
  add_rs(rs){
    var new_in=this.mixer.input({})
    rs.on('end',(()=>{
      this.mixer.removeInput(new_in);
      //if(this.mixer.inputs.length==0) this.close();
    }).bind(this))
    .on('close',(()=>{
      this.mixer.removeInput(new_in);
      //if(this.mixer.inputs.length==0) this.close();
    }).bind(this))
    .pipe(new_in);
  }
  close(){
    if(!this.recording) return;
    this.mixer.unpipe();
    this.mixer.close();
    this.mixer.destroy();
    this.ws.destroy();
    this.recording=false;
    encode_voice(this.filename);
  }
}

/*class FileSave extends EventEmitter{
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
}*/

class Bot{
  static num_bots=0;
  static channels=[];
  static ch2bot=new Map();
  static bot_ids=new Set();

  generateDirPath(channel){
    this.dirpath=`./recordings/${channel.name}-${Date.now()}`;
    fs.mkdir(this.dirpath,()=>{});
  }
  async generateOutName(name,channel) {
    //if(!this.dirpath)generateDirPath(channel);
    //return `${this.dirpath}/${member.id}-${Date.now()}.pcm`;
    //return `./recordings/${channel.name}-${Date.now()}.pcm`;
    let arr_name=name.split('_');
    let flg_dir=await new Promise((resolve,reject)=>{
      fs.access(`${outputDir}/${arr_name[0]}`,(err)=>{
        if(!err){
          resolve(true);
          return;
        }else if(err.code==='ENOENT'){
          resolve(false);
          return;
        }else{
          console.log(`Error on fig_dir: ${err.message}`);
          resolve(false);
          return;
        }
      })
    });
    if(flg_dir){
      console.log(arr_name);
      name=`${arr_name.shift()}/${arr_name.join('_')}`;
    }else{
      console.log('failed: '+arr_name);
      name=arr_name.join('_');
    }
    var format='YYYYMMDDHHmmss';
    return `${outputDir}/${name}_${channel.name}_`+formatToTimeZone(new Date(), format, { timeZone: 'Asia/Tokyo' })+'.pcm';
  }

  sel_bot=(ch_id,flg_con)=>{
    if(flg_con && Bot.channels[this.id]) return false;
    if(Bot.ch2bot.has(ch_id)) {
      return Bot.ch2bot.get(ch_id)==this.id;
    }
    for (var i = 0; i < this.id; i++) {
      if(!Bot.channels[i]) return false;
    }
    if(!flg_con) return false;
    Bot.channels[this.id]=ch_id;
    Bot.ch2bot.set(ch_id,this.id);
    return true;
  }

  start=(msg,file_prefix,voiceChannel)=>{
    if(!this.sel_bot(voiceChannel.id,true))return;
    voiceChannel.join()
    .then(conn => {
      msg.reply('ready!');
      conn.play(new Silence,{type:'opus'});
      //conn.on('speaking',(user,speaking)=>{console.log(`Speaking: ${user}, ${speaking}`)});
      conn.on('speaking', async (user, speaking) => {
        if(!user/*||user.id==this.client.user.id*/) return;
        if (speaking.has(Discord.Speaking.FLAGS.SPEAKING) && !this.rec_users.has(user.id)) {
          console.log(`Speaking: ${user}`);
          var rs=conn.receiver.createStream(user,{mode:'pcm',end:'manual'});
          if(!this.mixsave||!this.mixsave.recording)this.mixsave=new MixSave(
            [rs], await this.generateOutName(file_prefix, voiceChannel));
          else this.mixsave.add_rs(rs);
          this.rec_users.add(user.id);
          rs.on('end',(()=>{
            console.log(`end: ${user}`);
            this.rec_users.delete(user.id);
          }).bind(this));
          /*var filesave=new FileSave(conn.receiver.createStream(user,{mode:'pcm',end:'manual'}),this.generateOutName(voiceChannel, user));
          filesave.on('end', (() => {
            console.log(`End Speaking: ${user}`);
            this.rec_users.delete(user.id);
            this.filesaves.delete(filesave);
          }).bind(this));
          this.filesaves.add(filesave);*/
        }
      });
      this.check_if_empty=(old_st,new_st)=>{
        if(this.fin_timeout && new_st.channel.members.some((v,i)=>!Bot.bot_ids.has(i))){
          if(!new_st.channel || new_st.channel.id!=Bot.channels[this.id]) return;
          clearTimeout(this.fin_timeout);
          this.fin_timeout=null;
        }
        if(!old_st.channel || old_st.channel.id!=Bot.channels[this.id]) return;
        if(new_st.channel && new_st.channel.id==Bot.channels[this.id]) return;
        if(old_st.channel.members.every((v,i)=>Bot.bot_ids.has(i))){
          this.fin_timeout=setTimeout(this.stop,15000,msg,voiceChannel);
        }
      };
      this.client.on('voiceStateUpdate',this.check_if_empty);
    })
    .catch(console.log);
  }

  stop=(msg,voiceChannel)=>{
    if(!this.sel_bot(voiceChannel.id,false))return;
    voiceChannel.leave();
    Bot.channels[this.id]=0;
    Bot.ch2bot.delete(voiceChannel.id);
    this.rec_users.clear()
    //for(var item of this.filesaves){item.encode();}
    //this.filesaves.clear();
    if(this.mixsave) this.mixsave.close();
    this.dirpath='';
    this.client.off('voiceStateUpdate',this.check_if_empty);
  }

  constructor(){
    Bot.channels.push(0)
    this.client = new Discord.Client();

    this.id=(Bot.num_bots++);
    this.rec_users=new Set();
    //this.filesaves=new Set();
    this.dirpath=''
    this.mixsave=null;
    this.fin_timeout=null;

    this.client.on('message', (msg => {
      if (msg.content.startsWith(config.prefix+'start')) {
        let [prefix, command, ...args] = msg.content.split(" ");
        if (!msg.guild) {
          return msg.reply('no private service is available in your area at the moment. Please contact a service representative for more details.');
        }
        let ch_name='';
        let voiceChannel=null;
        if(command=='start_ch'){
          ch_name=args.shift();
          voiceChannel = msg.guild.channels.cache.find(ch => ch.name === ch_name);
          if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply(`I couldn't find the channel ${ch_name}.`);
        }else if(command=='start'){
          voiceChannel=msg.member.voice.channel;
          if(!voiceChannel) return msg.reply('You must join a voice channel first!');
          ch_name=voiceChannel.name;
        }
        //console.log(voiceChannel.id);
        const file_prefix=args.join('_');
        if(file_prefix.indexOf('"')!==-1){
          return msg.reply('You cannot use double quotation mark.');
        }
        //this.generateDirPath(voiceChannel);
        this.start(msg,file_prefix,voiceChannel);
      }
      if(msg.content.startsWith(config.prefix+'stop')) {
        let [prefix, command, ...ch_name] = msg.content.split(" ");
        let voiceChannel = null;
        if(ch_name.length){
          voiceChannel=msg.guild.channels.cache.find(ch => ch.name === ch_name.join(" "));
          if(!voiceChannel||voiceChannel.type!=='voice'){
            if(this.id==0) msg.reply(`I couldn't find the channel ${ch_name}.`);
            return;
          }
        }else{
          voiceChannel=msg.member.voice.channel;
          if(!voiceChannel){
            if(this.id==0) msg.reply('You must join voiceChannel.');
            return;
          }
        }
        this.stop(msg,voiceChannel);
      }
    }).bind(this));

    this.client.login(env[`DISCORD_TOKEN_${this.id+1}`]);

    this.client.on('ready', () => {
      Bot.bot_ids.add(this.client.user.id);
    });
  }
}

var bots=[...Array(parseInt(env.NUM_BOTS))].map((_,i)=>new Bot(i));
