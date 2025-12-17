import React from 'react'
import { useAuth } from '../context/AuthContext'
import {Route,redirect,Navigate} from 'react-router-dom'

//@ts-ignore
export default function GlobalRoute({component,...rest}) {
    
    //console.log("helo world")
    //@ts-ignore
    const {currentUser} = useAuth()
    
    console.log('global route',component,currentUser)

    if(currentUser === null){
        return component
    }
    else {
        // console.log("trying redirecting")
        // redirect("/")
     //  window.location.href = '/'
     return <Navigate to="/app" replace />
    }
}