import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";

const app = express();

app.set("view engine", "pug"); // 템플릿 엔진 지정
app.set("views", __dirname + "/views"); // Express에 template이 어디 있는지 지정해준다.
app.use("/public", express.static(__dirname + "/public")); // 유저가 /public으로 가게되면 __dirname + "/public" 폴더를 보여준다.
// public url을 생성해서 유저에게 파일을 공유해준다.

app.get("/", (req,res) => res.render("home")); // 홈으로 이동하면 "home" 렌더링
// home.pug를 render 해주는 route handler
app.get("/*", (req, res) => res.redirect("/")); // 어떤 url로 들어오든 홈으로 보낸다.

const httpServer = http.createServer(app); // http 서버 생성
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true,
    },
});
instrument(wsServer, {
    auth: false
});
// const wss = new WebSocket.Server({ server }) //http 서버 위에 웹소켓 서버 생성 -> http 서버와 웹소켓 서버 모두 돌릴 수 있다.
// 동일한 포트(localhost:3000)에서 http와 ws의 request 모두 처리할 수 있다.(필수사항은 아니다)

function publicRooms() {
    const {
        sockets : {
            adapter : {sids, rooms}
        },
    } = wsServer;
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined) {
            publicRooms.push(key);
        }
    });
    return publicRooms;    
}

function countRoom(roomName) {
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", socket => {
    wsServer.sockets.emit("room_change", publicRooms());
    socket["nickname"] = "Anon";
    socket.onAny((event) => {
        console.log(wsServer.sockets.adapter);
        console.log(`Socket "Event:${event}`);
    });
    socket.on("enter_room", (roomName , done) => {
        socket.join(roomName);
        done();
        wsServer.to(roomName).emit("welcome", socket.nickname ,countRoom(roomName));
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach( (room) => socket.to(room).emit("bye", socket.nickname, countRoom(room)- 1));
    });
    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());
    })
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("nickname", nickname => socket["nickname"] = nickname);
});

/* const sockets = [];
wss.on("connection", (socket) => {
    sockets.push(socket);
    socket["nickname"] = "Anon";
    console.log("Connected to Browser 🎈");
    socket.on("close", () => console.log("Disconnected from Browser ❌"));
    socket.on("message", (msg) => {
        const message = JSON.parse(msg);
        switch(message.type) {
            case "new_message" : 
                sockets.forEach((aSocket) => aSocket.send(`${socket.nickname} : ${message.payload}`));
            case "nickname" : 
                socket["nickname"] = message.payload;
        }
    });
}); */

const handleListen = () => console.log('Listening on http://localhost:3000');
httpServer.listen(3000, handleListen);