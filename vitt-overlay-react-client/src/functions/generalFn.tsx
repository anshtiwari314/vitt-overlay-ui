import { PostReq } from "./requests"

import { utils } from "@ricky0123/vad-react"
import WavToMp3 from './wavToMp3'

export function getTimeStamp(){

    let dateOb = new Date()

    let dateFormat= `${dateOb.getDate()}.${dateOb.getMonth()+1}.${dateOb.getUTCFullYear()}` 
    let timeFormat = `${dateOb.getHours()}.${dateOb.getMinutes()}.${dateOb.getSeconds()}.${dateOb.getMilliseconds()}`

    return `${dateFormat}-${timeFormat}`
}

export function getOldTimeStamp(){

    let dateOb = new Date()

    let dateFormat= `${dateOb.getDate()}/${dateOb.getMonth()+1}/${dateOb.getUTCFullYear()}` 
    let timeFormat = `${dateOb.getHours()}:${dateOb.getMinutes()}:${dateOb.getSeconds()}:${dateOb.getMilliseconds()}`

    return `${dateFormat} ${timeFormat}`
}

export function generateBase64(blob){
    return new Promise((resolve,reject)=>{

        let reader = new FileReader()
        reader.onloadend = ()=>{
            resolve(reader.result)
        }
    reader.readAsDataURL(blob)
    })
}

