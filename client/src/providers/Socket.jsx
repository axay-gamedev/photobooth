import React, { createContext , useMemo} from 'react'
import {io} from "socket.io-client"

const SocketContext = React.createContext(null);

export const SocketProvider = (props) =>{

    const socket= useMemo(()=>io({
        host: 'localhost',
        port: 8001

    }),[])
    return(
        <>
        <SocketContext.Provider value={socket}>

        {props.children}

        </SocketContext.Provider>
        </>

    )
}