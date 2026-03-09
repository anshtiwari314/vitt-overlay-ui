import {v4 as uuidv4} from 'uuid'

export function handleData(data:any){
    console.log('handleData',data)
    //setMsgLoading(false)
    let arr:Data[] =[]
    //@ts-ignore
    let obj:Data = {}
// "sessionid": <str>, "audiofiletimestamp": <str>
    let audiourl = null

    if(data?.loading){
        return ;
    }
    if(data?.audio_url!==null){
        //audioUrlRef.current = data.audiourl
       // setAudioUrlFlag(prev=>!prev)
        //setAudioUrl('https://files.gospeljingle.com/uploads/music/2023/04/Taylor_Swift_-_August.mp3')
       // setAudioUrl(data.audiourl)
       audiourl = data.audio_url
      }
    if(data?.audiobase64 && data?.audiobase64!==null){
        audiourl = `data:audio/wav;base64,${data.audiobase64}`
        //setAudioUrl(`data:audio/mpeg;base64,${data.audiobase64}`)
    }
    if(data?.imageurl){
        //@ts-ignore
        obj["id"]= uuidv4()
        obj["type"]="ImageMsg"
        obj["imageUrl"] = data.imageurl;
        obj["iconName"] = 'fa-solid fa-forward-fast'
        obj["similarity_query"] = data.similarity_query;
        obj["color"]= data.color;
        obj["iconColor"] = data.iconColor 
        obj["sessionid"] = data.sessionid;
        obj["audiofiletimestamp"]=data.audiofiletimestamp
        obj["istranscription"] = data.istranscription
        //arr.push(obj)
        arr = [...arr,obj]
        //@ts-ignore
        obj = {}
    }
    if(data?.value){
        //@ts-ignore
        obj["id"]= uuidv4()
        obj["type"]="InputForm"
        obj["iconName"] = "fa-regular fa-pen-to-square"
        obj["value"] = data.value 
        obj["label"] = data.label 
        obj["color"] = data.color 
        obj["iconColor"] = data.iconColor 
        obj["similarity_query"] = data.similarity_query;
        obj["sessionid"] = data.sessionid
        obj["audiofiletimestamp"]=data.audiofiletimestamp
        obj["istranscription"] = data.istranscription
        //arr.push(obj)
        arr = [...arr,obj]
        //@ts-ignore
        obj = {}
    }
    if(data?.radio){
        //@ts-ignore
        obj["id"]= uuidv4()
        obj["type"]="RadioForm"
        obj["iconName"] = 'fa-regular fa-pen-to-square'
        obj["label"] = data.label 
        obj["radio"] = data.radio
        obj["color"] = data.color
        obj["iconColor"] = data.iconColor 
        obj["similarity_query"] = data.similarity_query;
        obj["sessionid"] = data.sessionid
        obj["audiofiletimestamp"]=data.audiofiletimestamp
        obj["istranscription"] = data.istranscription
        //arr.push(obj)
        arr = [...arr,obj]
        //@ts-ignore
        obj={}
    }
    if(data?.content){
        data.content.map((e:any,i:number)=>{
            //@ts-ignore
            obj["id"]= uuidv4()
            obj["type"]="TextMsg"
            obj["content"] = e 
            obj["is_outgoing"] = false
            obj["iconName"] = 'fa-solid fa-circle-question'
            obj["color"]= data.color 
            obj["iconColor"] = data.iconColor
            obj["similarity_query"] = data.similarity_query;
            obj["sessionid"] = data.sessionid
            obj["audiofiletimestamp"]=data.audiofiletimestamp
            obj["istranscription"] = data.istranscription
            //arr.push(obj)
            arr = [...arr,obj]
            //@ts-ignore
            obj={}
        })
        
    }
    // if(data?.initquery.length>"1"){
    //         obj["id"]= uuidv4()
    //         obj["type"]="TextMsg"
    //         obj["content"] = data.initquery
    //         obj["iconName"] = 'fa-solid fa-circle-question'
    //         obj["color"]= data.color 
    //         obj["iconColor"] = data.iconColor
    //         obj["similarity_query"] = "Transcription captured";
    //         obj["sessionid"] = data.sessionid
    //         obj["audiofiletimestamp"]=data.audiofiletimestamp
    //         obj["initquery"] = true
    //         //arr.push(obj)
    //         arr = [...arr,obj]
    //         //@ts-ignore
    //         obj={}
    // }
    if(data?.replies){
        //@ts-ignore
        obj["id"]= uuidv4()
        obj["type"] = "SuggestiveMsg"
        obj["replies"] = data.replies
        obj["color"] = data.color
        obj["iconColor"] = data.iconColor 
        obj["similarity_query"] = data.similarity_query;
        obj["iconName"] = 'fa-solid fa-forward-fast'
        obj["sessionid"] = data.sessionid
        obj["audiofiletimestamp"]=data.audiofiletimestamp
        obj["istranscription"] = data.istranscription
        //arr.push(obj)
        arr = [...arr,obj]
        //@ts-ignore
        obj={}
       
    } 
    if(data?.isOutgoing){
        obj["id"]= uuidv4()
        obj["type"] = "SuggestiveMsg"
        //obj["replies"] = data.replies
        //obj["color"] = data.color
        //obj["iconColor"] = data.iconColor 
        obj["similarity_query"] = data.similarity_query;
        //obj["iconName"] = 'fa-solid fa-forward-fast'
        obj["sessionid"] = data.sessionid
        obj["content"] = '' 
        obj["is_outgoing"] = true
        //obj["audiofiletimestamp"]=data.audiofiletimestamp
        //obj["istranscription"] = data.istranscription

        arr = [...arr,obj]
        obj = {}

    }
   console.log(arr)

   return {arr,audiourl} ;
   //setData(prev=>[...arr,...prev])
   //console.log(obj)
}