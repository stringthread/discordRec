const fs=require('fs')

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

//in_path: input file name
const encode_wav=async function(in_path){
  if(!((/\.pcm$/i).test(in_path))){
    console.log('encode_wav - Invalid type input. Only PCM file is supported.')
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
  out_path=in_path.replace(/\.pcm/,'.wav');
  var ws=fs.createWriteStream(out_path);
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
  rs.pipe(ws);
  rs.on('error',(e)=>{
    ws.destroy();
    console.log(e);
  });
  rs.on('end',()=>{
    console.log(`encode_wav - Successfully encoded: ${out_path}`)
  });
};

module.exports=encode_wav
