const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
//const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server);


app.use(express.static(path.join(__dirname, 'public')));

// Gestión de salas en memoria RAM del servidor
const rooms = {};

// Función para leer y parsear el archivo CSV de palabras
async function loadWordsFromCSV() {
    const results = [];
    const filePath = path.join(__dirname, 'words.csv');

    if (!fs.existsSync(filePath)) {
        // Datos por defecto si no existe el CSV aún
        return [
            { word: "안녕하세요", meaning: "Hola" },
            { word: "감사합니다", meaning: "Gracias" },
            { word: "사랑해요", meaning: "Te amo" }
        ];
    }

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
            results.push({
                word: parts[0].trim(),
                meaning: parts.slice(1).join(',').trim()
            });
        }
    }
    return results;
}

app.get('/api/words', async (req, res) => {
    try {
        const words = await loadWordsFromCSV();
        res.json(words);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al leer el archivo de palabras' });
    }
});

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

// Crear una sala nueva
    socket.on('create-room', (callback) => {
        // CORRECCIÓN: Se aplica .substring() al string resultante, no al número 36
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = { players: [socket.id] };
        socket.join(roomCode);
        callback({ success: true, roomCode });
    });

    // Unirse a una sala existente
    socket.on('join-room', (roomCode, callback) => {
        const room = rooms[roomCode];
        if (room && room.players.length < 2) {
            room.players.push(socket.id);
            socket.join(roomCode);
            callback({ success: true });
            
            // Avisar al otro jugador que ya se conectó su compañero
            socket.to(roomCode).emit('partner-joined');
        } else {
            callback({ success: false, message: 'Sala llena o no encontrada' });
        }
    });

    // Recibir el tecleo de un jugador y retransmitirlo a su compañero en la sala
    socket.on('player-typing', (data) => {
        // data = { roomCode, typedText, currentWord }
        socket.to(data.roomCode).emit('partner-typing', data);
    });

    socket.on('disconnect', () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        // Opcional: limpiar salas vacías
    });
});


// ¡IMPORTANTE!: Usa server.listen en lugar de app.listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});