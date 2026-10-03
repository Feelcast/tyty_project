const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper function to load words from CSV file
async function loadWordsFromCSV() {
    const words = [];
    const csvPath = path.join(__dirname, 'words.csv');
    
    if (!fs.existsSync(csvPath)) {
        // Fallback sample data if words.csv doesn't exist yet
        return [
            { korean: '안녕하세요', meaning: 'Hola' },
            { korean: '감사합니다', meaning: 'Gracias' },
            { korean: '사랑해요', meaning: 'Te quiero / Te amo' },
            { korean: '물', meaning: 'Agua' },
            { korean: '책', meaning: 'Libro' },
            { korean: '컴퓨터', meaning: 'Computadora' }
        ];
    }

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        // Assuming CSV format: korean,meaning (handling basic commas or tabs)
        const parts = line.split(',');
        if (parts.length >= 2) {
            const korean = parts[0].trim().replace(/^["']|["']$/g, '');
            const meaning = parts[1].trim().replace(/^["']|["']$/g, '');
            if (korean && meaning) {
                words.push({ korean, meaning });
            }
        }
    }

    return words.length > 0 ? words : [
        { korean: '안녕', meaning: 'Hola (informal)' }
    ];
}

// API endpoint to fetch words
app.get('/api/words', async (req, res) => {
    try {
        const words = await loadWordsFromCSV();
        res.json(words);
    } catch (err) {
        console.error('Error loading words:', err);
        res.status(500).json({ error: 'Could not load words' });
    }
});

// Serve frontend HTML page
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Práctica de Escritura Coreana - MVP</title>
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #ffffff;
            color: #212529;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .word-display {
            font-size: 3.5rem;
            color: #6c757d; /* Gris claro */
            font-weight: bold;
            transition: color 0.2s ease;
        }
        .word-display.success {
            color: #198754 !important; /* Verde éxito */
        }
        .input-display {
            font-size: 2rem;
            color: #6c757d;
            min-height: 3rem;
            font-family: monospace;
        }
        .input-display.success {
            color: #198754 !important;
        }
        .card-box {
            max-width: 600px;
            width: 100%;
            border: none;
        }
    </style>
</head>
<body>

    <div class="container text-center">
        <div class="card card-box p-4 mx-auto shadow-sm">
            <h1 class="h4 mb-4 text-secondary">Práctica de Teclado Coreano</h1>
            
            <!-- Palabra a adivinar (Gris claro) -->
            <div id="targetWord" class="word-display mb-3">Cargando...</div>
            
            <!-- Significado que aparece al acertar -->
            <div id="wordMeaning" class="text-success fw-bold fs-5 mb-4" style="visibility: hidden;"></div>

            <!-- Campo de entrada invisible pero funcional para capturar escritura -->
            <input type="text" id="userInput" class="form-control form-control-lg text-center mb-3" placeholder="Escribe aquí..." autofocus autocomplete="off" autocapitalize="off" spellcheck="false">

            <!-- Lo que vas escribiendo en tiempo real -->
            <div id="liveInputDisplay" class="input-display mb-3"></div>

            <!-- Cronómetro / Feedback -->
            <div id="timerDisplay" class="text-muted fs-6 mb-3">Tiempo: 0.0s</div>

            <!-- Botones necesarios -->
            <div class="d-flex justify-content-center gap-2">
                <button id="skipBtn" class="btn btn-outline-secondary btn-sm">Saltar palabra</button>
            </div>
        </div>
    </div>

    <script>
        let wordsList = [];
        let currentWord = {};
        let startTime = null;
        let isCompleted = false;

        const targetWordEl = document.getElementById('targetWord');
        const wordMeaningEl = document.getElementById('wordMeaning');
        const userInputEl = document.getElementById('userInput');
        const liveInputDisplayEl = document.getElementById('liveInputDisplay');
        const timerDisplayEl = document.getElementById('timerDisplay');
        const skipBtn = document.getElementById('skipBtn');

        // Cargar palabras del servidor
        async function fetchWords() {
            try {
                const response = await fetch('/api/words');
                wordsList = await response.json();
                nextWord();
            } catch (error) {
                targetWordEl.textContent = 'Error cargando palabras';
            }
        }

        function nextWord() {
            if (wordsList.length === 0) return;
            const randomIndex = Math.floor(Math.random() * wordsList.length);
            currentWord = wordsList[randomIndex];

            targetWordEl.textContent = currentWord.korean;
            targetWordEl.classList.remove('success');
            
            userInputEl.value = '';
            userInputEl.disabled = false;
            liveInputDisplayEl.textContent = '';
            liveInputDisplayEl.classList.remove('success');
            
            wordMeaningEl.style.visibility = 'hidden';
            wordMeaningEl.textContent = '';
            
            timerDisplayEl.textContent = 'Tiempo: 0.0s';
            
            isCompleted = false;
            startTime = performance.now();
            userInputEl.focus();
        }

        // Mantener el foco en el input siempre
        document.addEventListener('click', () => {
            if (!isCompleted) userInputEl.focus();
        });

        userInputEl.addEventListener('input', (e) => {
            if (isCompleted) return;

            const typedValue = e.target.value;
            liveInputDisplayEl.textContent = typedValue;

            // Condición de coincidencia exacta
            if (typedValue === currentWord.korean) {
                isCompleted = true;
                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);

                // Poner ambas palabras en verde
                targetWordEl.classList.add('success');
                liveInputDisplayEl.classList.add('success');
                
                // Mostrar significado en español
                wordMeaningEl.textContent = 'Significado: ' + currentWord.meaning;
                wordMeaningEl.style.visibility = 'visible';

                timerDisplayEl.textContent = \`¡Correcto! Tiempo: \${duration} segundos\`;
                userInputEl.disabled = true;

                // Pausa breve de 1.5 segundos y pasar automáticamente a la siguiente palabra
                setTimeout(() => {
                    nextWord();
                }, 1800);
            }
        });

        skipBtn.addEventListener('click', () => {
            nextWord();
        });

        // Inicializar
        fetchWords();
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(\`Servidor corriendo en http://localhost:\${PORT}\`);
});