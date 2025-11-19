import { PostReq, sendToServer } from "./requests"
import WavToMp3 from './wavToMp3'
import { generateBase64, getTimeStamp } from "./generalFn"



export async function continuousMediaRecorder(stream,url,stopVariable,data){
    
    console.log('continuous MediaRecorder triggered')

    //let url = audioServerUrl
     let arrayofChunks:any = []

    let mediaRecorder = new MediaRecorder(stream,{
         //audioBitsPerSecond:32000,
         mimeType: 'audio/webm;codecs=opus'
    })
     
    mediaRecorder.ondataavailable = async (event)=>{ 
       if (event.data.size > 0) {
          let base64 = await generateBase64(event.data)

          data = {...data, 
            audiomessage:base64.split(',')[1],
          }
          let res = await PostReq(url,data)
          console.log("res from audio server",res)
      }
    }
     
     mediaRecorder.onstop = async ()=>{
    }

     
     //chk every second 

     let intervalId = setInterval(()=>{

     },1000)

     mediaRecorder.start()
     
   }



export async function startMediaRecorder(stream,url,time,data){
    //let url = 'https://f6p70odi12.execute-api.ap-south-1.amazonaws.com'

   // let {stream,url,time,recordingStatus,sessionid,userid,fileid,filename,timeStamp} = args
    console.log('startMediaRecorder triggered')

    //let url = audioServerUrl
     let arrayofChunks:any = []
       let mediaRecorder = new MediaRecorder(stream,{
         audioBitsPerSecond:32000
         })
     
     mediaRecorder.ondataavailable = async (event)=>{ 
       if (event.data.size > 0) {
          let base64 = await generateBase64(event.data)

          data = {...data, 
            audiomessage:base64.split(',')[1],
            audiofiletimestamp:getTimeStamp()
          }
          let res = await PostReq(url,data)
          console.log("res from start media recorder",res)
      }
    }
     
     mediaRecorder.onstop = async ()=>{
      //setMsgLoading(true)
     
      //let url = `https://asia-south1-utility-range-375005.cloudfunctions.net/save_b64_1`
     //let url = `https://0455-182-72-76-34.ngrok.io`
     //console.log(`%c just before wav to mp3 ${new Date().toLocaleTimeString()}`,'background-color:teal;color:white')
     //let mp3Blob = await WavToMp3(new Blob(arrayofChunks,{type:'audio/wav'}))
     //console.log(mp3Blob)
     //console.log(`%c just after wav to mp3 ${new Date().toLocaleTimeString()}`,'background-color:teal;color:white')
     
    //  let data = {
      
    //   mob:'vois',
    //  // uid:myId,
    //   userid,
    //   sessionid,
    //   url:window.location.href,
    //   date: '13.3.2025',
    //   time: '11.51.0.57',
    //   fileid,
    //   filename,
    //   timeStamp
    // }


     //sendToServer( mp3Blob,url,sessionid,data)
    //  let base64 = await generateBase64(mp3Blob)

    //   data = {...data, 
    //       audiomessage:base64.split(',')[1],
    //   }

    //   let resp = await PostReq(url,data)
    //   console.log("res from audio server",resp)

    //   arrayofChunks = []
  }

     //setTimeout(()=>mediaRecorder.stop(),time)
 
     //if recording true stop after 30 sec
    setTimeout(()=>{
      if(mediaRecorder.state==='recording')
      mediaRecorder.stop()
     },time)
     //chk every second 

     

    //  let timeOutId2 =setTimeout(()=>requestAnimationFrame(()=>{

    //   if(recordingStatus.current ===false){
    //     //clearInterval(intervalId) 
    //     clearTimeout(timeOutId)
    //     clearTimeout(timeOutId2)
    //    if(mediaRecorder.state==='recording')
    //     mediaRecorder.stop()  
    //   }

    //  }),1000)
     

    //  let intervalId = setInterval(
       
    //  },1000)
     mediaRecorder.start()
     
   }

   export function startMediaRecorder2(args){
    //let url = 'https://f6p70odi12.execute-api.ap-south-1.amazonaws.com'

    const {stream,url,time,recordingStatus,sessionid,userid,fileid,filename,timeStamp} =args

    console.log('startMediaRecorder triggered')

    //let url = audioServerUrl
     let arrayofChunks:any = []
       let mediaRecorder = new MediaRecorder(stream,{
         audioBitsPerSecond:32000
         })
     
     mediaRecorder.ondataavailable = (e)=>{ 
       arrayofChunks.push(e.data)
     }
     
     mediaRecorder.onstop = async ()=>{
      //setMsgLoading(true)
     
      //let url = `https://asia-south1-utility-range-375005.cloudfunctions.net/save_b64_1`
     //let url = `https://0455-182-72-76-34.ngrok.io`
     console.log(`%c just before wav to mp3 ${new Date().toLocaleTimeString()}`,'background-color:teal;color:white')
     let mp3Blob = await WavToMp3(new Blob(arrayofChunks,{type:'audio/wav'}))
     //console.log(mp3Blob)
     console.log(`%c just after wav to mp3 ${new Date().toLocaleTimeString()}`,'background-color:teal;color:white')
     
     let data = {
      
      //mob:'vois',
     // uid:myId,
      userid,
      sessionid,
      url:window.location.href,
      date: '13.3.2025',
      time: '11.51.0.57',
      fileid,
      filename,
      timeStamp
    }

     sendToServer( mp3Blob,url,sessionid,data)
      arrayofChunks = []
     }

     //setTimeout(()=>mediaRecorder.stop(),time)
 
     //if recording true stop after 30 sec
     let timeOutId = setTimeout(()=>{
      if(mediaRecorder.state==='recording')
      mediaRecorder.stop()
     },time)
     //chk every second 

     

     let timeOutId2 =setTimeout(()=>requestAnimationFrame(()=>{

      if(recordingStatus.current ===false){
        //clearInterval(intervalId) 
        clearTimeout(timeOutId)
        clearTimeout(timeOutId2)
       if(mediaRecorder.state==='recording')
        mediaRecorder.stop()
        
      }
     }),1000)
     

    //  let intervalId = setInterval(
       
    //  },1000)
     mediaRecorder.start()
     
   }