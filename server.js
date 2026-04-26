const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ─── ESTADO DEL SERVIDOR ─────────────────────────────────────────────────────
const users = {};      // socketId → { name, tag }
const messages = {};   // "id1-id2" → [ ...msgs ]

function roomKey(a, b) {
  return [a, b].sort().join("-");
}

// ─── CONEXIÓN ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[+] Conectado: ${socket.id}`);

  // El cliente manda su nombre al conectarse
  socket.on("register", ({ name, tag }) => {
    users[socket.id] = { name, tag, id: socket.id };
    console.log(`[register] ${name}${tag}`);

    // Mandá la lista de usuarios conectados a todos
    io.emit("user_list", Object.values(users));
  });

  // Mensaje directo entre dos usuarios
  socket.on("dm", ({ toId, text }) => {
    const from = users[socket.id];
    if (!from) return;

    const key = roomKey(socket.id, toId);
    if (!messages[key]) messages[key] = [];

    const msg = {
      fromId: socket.id,
      fromName: from.name,
      text,
      time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
    };

    messages[key].push(msg);

    // Mandá el mensaje al destinatario y al remitente
    io.to(toId).emit("dm", { ...msg, roomKey: key });
    socket.emit("dm", { ...msg, roomKey: key });
  });

  // Pedir historial de mensajes con alguien
  socket.on("get_history", ({ withId }) => {
    const key = roomKey(socket.id, withId);
    socket.emit("history", { key, msgs: messages[key] || [] });
  });

  // Desconexión
  socket.on("disconnect", () => {
    console.log(`[-] Desconectado: ${socket.id}`);
    delete users[socket.id];
    io.emit("user_list", Object.values(users));
  });
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Litecord server OK"));

// ─── ARRANCAR ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Litecord server corriendo en puerto ${PORT}`);
});
