import React from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import { SocketProvider } from "./providers/Socket";
import Home from "./components/Home";

function App() {
  return (
    <SocketProvider>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </SocketProvider>
  );
}

export default App;
