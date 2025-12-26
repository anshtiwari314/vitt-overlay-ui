import React,{createContext,useContext, useState} from 'react'
import {v4 as uuidv4} from 'uuid'

const Auth = createContext('Auth')

export function useAuth(){
    return useContext(Auth)
}

export default function AuthContext({children}:{children:React.ReactNode}) {
  
    const [currentUser,setCurrentUser] = useState({userid:'vois',sessionuid:uuidv4()})
   //const [currentUser,setCurrentUser] = useState(null)
   const [isAuthenticated,setIsAuthenticated] = useState(false)

  let values = {
    currentUser,setCurrentUser,
    isAuthenticated,setIsAuthenticated
  }
  return (
    // @ts-ignore
    <Auth.Provider value={values}>
        {children}
    </Auth.Provider>
  )
}