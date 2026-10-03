const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});