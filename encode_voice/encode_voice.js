const fs=require('fs');
const ffmpeg=require('./basicFFmpeg.js');

const get_filesize=function(path){
  return new Promise((resolve,reject)=>{
    fs.stat(path,(e,stats)=>{
      if(e){
        rs.close()
        reject(e);
      }
      resolve(stats.size);
    });
  })
}

const copy_stream=function(rs,ws,out_path){
  return new Promise((resolve,reject)=>{
    rs.pipe(ws);
    rs.on('error',(e)=>{
      ws.destroy();
      console.log(e);
      reject(e);
    });
    rs.on('end',()=>{
      console.log(`encode_voice - Successfully encoded: ${out_path}`);
      resolve(0);
    });
  })
}

const encode_mp3=function(in_path){
  return new Promise((resolve,reject)=>{
    var rs=fs.createReadStream(in_path)
      .on('error', e=>console.log('input stream exception: ' + e));

    out_path=in_path.replace(/\.wav$/i,'.mp3');
    var ws=fs.createWriteStream(out_path)
      .on('error', e=>console.log('output stream error: ' + e));

    var processor =ffmpeg.createProcessor({
      inputStream: rs, //read from readable stream
      outputStream: ws, //write to writable stream
      emitInputAudioCodecEvent: true, //inputAudioCodec event will not be fired if this is not set to true
      emitInfoEvent: false, //info events will not be fired if this is not set to true
      emitProgressEvent: true, //progress events will not be fired if this is not set to true
      niceness: 10, //set child process niceness to 10
      timeout: 10 * 60 * 1000, //fire timeout event after 10 minutes, does not actually stop process
      arguments: {
        '-ac': '2',
        '-ab': '256k',
        '-acodec': 'libmp3lame',
        '-f': 'mp3'
      }
    }).on('inputAudioCodec', function (codec) {
      console.log('input audio codec is: ' + codec);
    }).on('success', function (retcode, signal) {
      console.log('process finished successfully with retcode: ' + retcode + ', signal: ' + signal);
      rs.close();
      ws.close();
      resolve(0);
    }).on('failure', function (retcode, signal) {
      console.log('process failure, retcode: ' + retcode + ', signal: ' + signal);
      rs.close();
      ws.close();
      reject(retcode);
    }).on('timeout', function (processor) {
      console.log('timeout event fired, stopping process.');
      processor.terminate();
      rs.close();
      ws.close();
      reject(-1);
    })
      .execute();
  });
}

//in_path: input file name
const encode_voice=async function(in_path){
  if(!((/\.pcm$/i).test(in_path))){
    console.log('encode_voice - Invalid type input. Only PCM file is supported.')
    return;
  }
  var rs;
  try{
    rs=fs.createReadStream(in_path)
  }catch(e){
    console.log(e);
    return;
  }
  const size=await get_filesize(in_path).catch(console.log);
  wav_path=in_path.replace(/\.pcm/,'.wav');
  var ws=fs.createWriteStream(wav_path);
  var head=Buffer.from([
    0x52,0x49,0x46,0x46,//'RIFF'
    0x00,0x00,0x00,0x00,//chunk size(4-byte): setup later
    0x57,0x41,0x56,0x45,//'WAVE'
    0x66,0x6D,0x74,0x20,//'fmt '
    0x10,0x00,0x00,0x00,//fmt chunk byte size (16)
    0x01,0x00,//format id (1)
    0x02,0x00,//channel num (2)
    0x80,0xBB,0x00,0x00,//sumpling rate (48000Hz)
    0x00,0xEE,0x02,0x00,//Bytes per sec (192000)
    0x04,0x00,//Block size (4)
    0x10,0x00,// bits per sample (16)
    0x64,0x61,0x74,0x61,//'data'
    0x00,0x00,0x00,0x00//data size(4-byte): setup later
  ]);
  head.writeUInt32LE(size+head.length-8,4);
  head.writeUInt32LE(size,40);
  ws.write(head);
  var res=await copy_stream(rs,ws,wav_path);
  if(res){
    console.log(`encode_voice: ${res} at copy_stream`);
    return;
  }
  fs.unlink(in_path,e=>{console.log(`encode_voice: ${e?e:'success'} at ${in_path} delete`)});
  var res=await encode_mp3(wav_path);
  if(res){
    console.log(`encode_voice: ${res} at encode_mp3`);
    return;
  }
  fs.unlink(wav_path,e=>{console.log(`encode_voice: ${e?e:'success'} at ${wav_path} delete`)});
};

module.exports=encode_voice
