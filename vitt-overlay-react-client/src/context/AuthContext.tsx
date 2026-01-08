import axios from 'axios';
import React,{createContext,useContext, useEffect, useState} from 'react'
import {v4 as uuidv4} from 'uuid'


const Auth = createContext('Auth')

export function useAuth(){
    return useContext(Auth)
}

export default function AuthContext({children}:{children:React.ReactNode}) {
  
   const [currentUser,setCurrentUser] = useState({userid:'vois',sessionuid:uuidv4()})
  // const [currentUser,setCurrentUser] = useState<any>(null);
   const [isAuthenticated,setIsAuthenticated] = useState(false)
   const [access_token,setaccess_token]=useState("")
   const [loading,setLoading]=useState(true)
     useEffect(() => {
  console.log("jaa rha")
  const refresh = async () => {
    console.log("andar aaya");
    try {
     
      const res = await axios.get("http://localhost:5000/refresh", { withCredentials: true });
      setaccess_token(res.data.access_token);
      setCurrentUser(res.data.user);
      
    } catch (err:any) {
      console.log("problem in refresh kuch sussy hai");
    }finally{
      setLoading(false)
    }
  };
  refresh();
}, []);

  let values = {
    currentUser,setCurrentUser,
    isAuthenticated,setIsAuthenticated,
    setaccess_token
  }
  return (
    // @ts-ignore
    <Auth.Provider value={values}>
        {children}
    </Auth.Provider>
  )
}