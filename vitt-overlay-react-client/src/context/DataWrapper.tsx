import React, { createContext, useContext } from "react";

let DataContext = createContext('')

export function useData(){
    return useContext(DataContext)
} 

export function DataWrapper({children}){
    
    const [ws,setWs] = React.useState(null)
    const wsRef = React.useRef(null);
    const authServerUrl = 'https://fb84-2401-4900-8829-9012-f44f-b9c8-c316-e49e.ngrok-free.app'

    let values ={
        ws,setWs,wsRef,authServerUrl
    }
    return (
        //@ts-ignore
        <DataContext.Provider value={values}>
            {children}
        </DataContext.Provider>
    )
}