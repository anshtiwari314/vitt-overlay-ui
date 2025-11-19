import {v4 as uuidv4} from 'uuid'
import { getTimeStamp } from './generalFn';

// this logic has chunkSize , & used to send a very large file 
export function xhrUploadFile(uploadFileparam:Blob) {
    let uid = uuidv4()
    const chunkSize = 1 * 1024 * 1024;
    let filesUploaded = 0;
    let totalFiles = 1;
    const totalChunks = Math.ceil(uploadFileparam.size / chunkSize);
    let currentChunk = 0;
    let uploadUrl = 'https://qhpv9mvz1h.execute-api.ap-south-1.amazonaws.com/prod/postfacto-upload-test'
    // Chunk uploading function

    function uploadChunk(chunkStart:Number) {
        const chunk = uploadFileparam.slice(chunkStart, chunkStart + chunkSize);
        
        let date = new Date()
        let datelocale = `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`
        let timelocale = `${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}.${date.getMilliseconds()}`

        // filename = `${currentUser.sessionid}-${datelocale}-${timelocale}-${currentUser.sessionuid}`
       
        const chunkFormData = new FormData();
        chunkFormData.append('original_file_name', uploadFileparam.name);
        chunkFormData.append('file', chunk);
        // with .ext
        chunkFormData.append('filename', `${uid}.${ uploadFileparam.name.split('.')[1]}`);
        //chunkFormData.append('filename', `${filename}.${ uploadFileparam.name.split('.')[1]}`);
        // without .ext
        chunkFormData.append('fileid', `${uid}`);
        chunkFormData.append('chunk', currentChunk);
        chunkFormData.append('sessionuid',currentUser.sessionuid);
        chunkFormData.append('agent_username',currentUser.sessionid);
        chunkFormData.append('totalChunks', totalChunks);
        chunkFormData.append('date',datelocale)
        chunkFormData.append('time',timelocale)

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = ((currentChunk * chunkSize + event.loaded) / uploadFileparam.size) * 100;
                
                let num=Math.round(percentComplete)
                if(num<100){

                }
                //setProgress({uploaded:num,hidden:false})
                else {
                  //setProgress({uploaded:100,hidden:false})
                  // setTimeout(()=>{
                  //   setProgress({uploaded:0,hidden:true})
                  // },2000)
                }
                //progressBarFill.style.width = percentComplete + '%';
                //progressBarFill.textContent = Math.round(percentComplete) + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                currentChunk++;
                if (currentChunk < totalChunks) {
                    uploadChunk(currentChunk * chunkSize);
                } else {
                    filesUploaded++;
                    if (filesUploaded === totalFiles) { 

                      let ob = {
                        original_file_name:uploadFileparam.name,
                        filename:`${uid}.${uploadFileparam.name.split('.')[1]}`,
                        fileid:uid
                      }
                        //setUploadedFiles([ob])
                        
                        //message.textContent = 'All files successfully uploaded!';
                        //message.style.color = 'green';
                        //progressBar.classList.add('hidden');
                    }
                }
            } else {
              //  message.textContent = 'Error uploading files.';
              //  message.style.color = 'red';

                console.error('Error:', xhr.responseText);
            }
        };

        xhr.onerror = () => {
            console.log('Network error or request failed');
        };

        //xhr.open('POST', 'http://127.0.0.1:5000/upload');
        xhr.open('POST', `${uploadUrl}`, true);
        //xhr.open('POST', 'http://35.200.139.251/upload', true);
        xhr.send(chunkFormData);
    }

    uploadChunk(0);
}



export  function sendToServer(blob:any,url:string,SESSION_ID,data){
    //console.log(blob)
    let reader = new FileReader()
    reader.onloadend = ()=>{
      let base64data:any = reader.result;
     // console.log(`base64`,base64data)
     

     console.log(data)
     
     
     data = {...data, 
        audiomessage:base64data.split(',')[1],
        
     }
     
    let audioData = JSON.stringify(data)
    console.log(`%c just before sending data ${new Date().toLocaleTimeString()}`,'background-color:teal;color:white')
    
    //socket.emit('audiomessagefromclient',audioData)
    fetch(url,{
      method:'POST',
      headers:{
         'Accept':'application.json',
         'Content-Type':'application/json',
         //'mode': 'no-cors'
      },
      body:audioData,
      cache:'default',}).then(res=>res.json())
      .then(result=>console.log("res from audio server",result))
    }
   reader.readAsDataURL(blob)
  }

  export function PostReq(url,data){
    
    return new Promise((resolve,reject)=>{
        fetch(url,{
            method:'POST',
            headers:{
               'Accept':'application.json',
               'Content-Type':'application/json',
               //'mode': 'no-cors'
            },
    
            body:JSON.stringify(data),
            cache:'default',})
            .then(res=>{
               console.log("res from server",res)
               return res.json()
            }).then((result)=>{
              
              console.log(result)
              // if(result.error!==null)
              //   reject(result.error)
              // if(result.result===true){
              //  // console.log(result)
              //     resolve(result.data)
              // }
              resolve(result)
            })
        
    })
    
  }