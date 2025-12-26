import React, { createContext, useContext } from "react";

let DataContext = createContext('')

export function useData(){
    return useContext(DataContext)
} 

export function DataWrapper({children}){
    
    const [ws,setWs] = React.useState(null)
    const wsRef = React.useRef(null);

    let values ={
        ws,setWs,wsRef
    }
    return (
        //@ts-ignore
        <DataContext.Provider value={values}>
            {children}
        </DataContext.Provider>
    )
}