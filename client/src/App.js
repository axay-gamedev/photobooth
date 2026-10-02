import { Route, Routes } from "react-router-dom"
import "./App.css"
import { SocketProvider } from "./providers/Socket";
import Home from "./components/Home";
import React from "react";
  
const SocketContext = React.createContext(null);

export const useSocket = () =>{
  return React.useContext(SocketContext)
}
function App() {
  return (
    <>

      <div className="App">
        <Routes>
          <SocketProvider>
          <Route path="/" element={<Home></Home>}/>      
          </SocketProvider>
        </Routes>

      </div>









    </>
  );
}

export default App;
