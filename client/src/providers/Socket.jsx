import React, { createContext, useContext, useMemo } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socket = useMemo(() => {
    const url = process.env.REACT_APP_SOCKET_URL || "http://localhost:8001";
    return io(url, {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
