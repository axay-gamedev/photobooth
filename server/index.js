const express = require("express");
const {Server} = require("socket.io");
const bodyParser = require("body-parser");



const app = express();
const io = new Server();




app.use(bodyParser.json());

const emailToSocketMapping = new Map();

io.on("connection",(socket)=>{

    socket.on('join-room',data=>{
        console.log(`User ${emailId} Joined room ${roomId}`);
        const {roomId,emailId} = data;
        emailToSocketMapping.set(emailId,socket.id);
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("user-joined",{emailId});
    });
});


app.listen(8000,()=>console.log("Server started"));
io.listen(8001);