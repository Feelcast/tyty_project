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

async function provideWordsLangType(type, language) {
    // type puede ser: un string ('sustantivo'), una lista separada por comas ('sustantivo,verbo'), un arreglo (['sustantivo', 'verbo']), o 'todo'
    // language puede ser: 'coreano', 'espanol' (o el idioma que corresponda), o 'todo'
    
    const matchingFiles = [];
    const filePath = path.join(__dirname, 'dicts_lang_type.csv');
    
    if (!fs.existsSync(filePath)) {
        return [];
    }

    // Normalizar 'type' a un arreglo de minúsculas para facilitar la validación múltiple
    let targetTypes = [];
    if (Array.isArray(type)) {
        targetTypes = type.map(t => t.toLowerCase().trim());
    } else if (typeof type === 'string') {
        targetTypes = type.toLowerCase().split(',').map(t => t.trim());
    } else {
        targetTypes = ['todo'];
    }

    const targetLang = (language || 'todo').toLowerCase().trim();

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (!line.trim()) continue;
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
            const csvType = parts[0].toLowerCase();
            const csvLang = parts[1].toLowerCase();
            const csvFileName = parts[2];

            const matchesLanguage = (targetLang === 'todo' || csvLang === targetLang);
            
            // Comprueba si el tipo del CSV está incluido en la lista de tipos solicitados (o si se pidió 'todo')
            const matchesType = (targetTypes.includes('todo') || targetTypes.includes(csvType));

            if (matchesLanguage && matchesType) {
                // Evitar duplicados en caso de que un archivo mapee varias veces
                if (!matchingFiles.includes(csvFileName)) {
                    matchingFiles.push(csvFileName);
                }
            }
        }
    }

    const results = [];
    
    // Toma todos los nombres de los archivos únicos, los lee y junta toda la información
    for await (const filename of matchingFiles) {
        const content = await loadWordsFromCSV(filename);
        results.push(...content);
    }
    
    return results;
}

async function loadWordsFromCSV(filename) {
    const results = [];
    const filePath = path.join(__dirname, filename);

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
        else{
            results.push({
                word: parts[0].trim()
            })
        }
    }
    return results;
}

app.get('/api/words', async (req, res) => {
    try {
        // req.query.type puede venir como string ("sustantivo,verbo") o array si se envía repetido (?type=sustantivo&type=verbo)
        let type = req.query.type || 'todo';
        if (Array.isArray(req.query.type)) {
            type = req.query.type; // Express ya lo maneja como array
        }

        const language = req.query.language || 'todo';

        const words = await provideWordsLangType(type, language);
        
        res.json(words);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al procesar el vocabulario' });
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