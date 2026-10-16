let words = [];
let currentWord = null;
let currentMeaning = '';
let startTime = null;
let timerInterval = null;
let isFinished = false;

// --- RASTREO PRECISO DE BACKSPACES POR CAMBIO DE LONGITUD ---
let backspaceCount = 0;
let previousInputValue = '';
// Variables de estado global del juego
let totalScore = 0;
let perfectStreak = 0;

//cosas locales
const targetWordEl = document.getElementById('targetWord');
const liveInputDisplayEl = document.getElementById('liveInputDisplay');
const userInputEl = document.getElementById('userInput');
const wordMeaningEl = document.getElementById('wordMeaning');
const timerDisplayEl = document.getElementById('timerDisplay');
const skipBtn = document.getElementById('skipBtn');
const keypressSound = new Audio('audio/keypress_edit.mp3');
const successSound = new Audio('audio/success.mp3');

//cosas del socket
// Inicializar conexión de Socket.io
const socket = io();
let currentRoomCode = null;

const lobbyContainer = document.getElementById('lobbyContainer');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const roomStatus = document.getElementById('roomStatus');
const partnerCardContainer = document.getElementById('partnerCardContainer');
const partnerTargetWordEl = document.getElementById('partnerTargetWord');
const partnerLiveInputEl = document.getElementById('partnerLiveInput');

async function fetchWords() {
    try {
        const response = await fetch('/api/words');
        words = await response.json();
        loadNewWord();
    } catch (error) {
        targetWordEl.textContent = 'Error al cargar';
        console.error('Error fetching words:', error);
    }
}

// Reiniciar la memoria al cargar una nueva palabra
function resetBackspaceTracker() {
    backspaceCount = 0;
    previousInputValue = '';
}

function loadNewWord() {
    resetBackspaceTracker();
    if (words.length === 0) return;
    
    isFinished = false;
    userInputEl.value = '';
    userInputEl.disabled = false;
    
    targetWordEl.classList.remove('success');
    liveInputDisplayEl.classList.remove('success');
    liveInputDisplayEl.classList.add('input-display-placeholder');
    liveInputDisplayEl.textContent = 'Escribe aquí...';
    
    wordMeaningEl.style.visibility = 'hidden';
    wordMeaningEl.textContent = '';
    
    const randomIndex = Math.floor(Math.random() * words.length);
    currentWord = words[randomIndex].word;
    currentMeaning = words[randomIndex].meaning;
    
    targetWordEl.innerHTML = currentWord.split('').map(char => `<span>${char}</span>`).join('');
    
    clearInterval(timerInterval);
    startTime = null;
    timerDisplayEl.textContent = 'Tiempo: 0.0s';
    
    userInputEl.focus();
}

function startTimer() {
    if (!startTime) {
        startTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            timerDisplayEl.textContent = `Tiempo: ${elapsed}s`;
        }, 100);
    }
}

// Contar Jamos ignorando espacios intermedios y contabilizando correctamente sílabas Hangul y caracteres latinos
function countHangulJamos(text) {
    let jamoCount = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // Ignoramos los espacios en blanco para el cómputo de velocidad por Jamo
        if (char === ' ' || char === '\t') continue;

        const code = char.charCodeAt(0);
        // Verificar si es un bloque de sílabas Hangul (AC00 - D7A3)
        if (code >= 0xAC00 && code <= 0xD7A3) {
            const syllableIndex = code - 0xAC00;
            const jongIndex = syllableIndex % 28;
            // Inicial + Medial + Final (si tiene batchim)
            jamoCount += (jongIndex > 0) ? 3 : 2;
        } else {
            // Letras sueltas, caracteres latinos (Romaji/Español) o símbolos cuentan como 1
            jamoCount += 1;
        }
    }
    return jamoCount;
}


function evaluateWordPerformance(targetText, finalTimeSeconds, totalBackspaces) {
    const totalJamos = countHangulJamos(targetText);
    const avgTimePerJamo = totalJamos > 0 ? (finalTimeSeconds / totalJamos) : 0;

    // Contar cuántas palabras componen la frase (separadas por espacios)
    const wordCount = targetText.trim().split(/\s+/).length;

    // Límite dinámico de backspaces basado en el número de palabras (ej. máx 1 o 2 por palabra)
    const maxBackspacesForS = 0;                  // S siempre exige 0 backspaces
    const maxBackspacesForA = wordCount * 1;      // Máximo 1 backspace por palabra en promedio para A
    const maxBackspacesForB = wordCount * 2;      // Máximo 2 backspaces por palabra en promedio para B

    let tier = 'C';
    let tierMultiplier = 1;

    // Criterios ajustados con umbrales dinámicos para frases multi-palabra
    if (totalBackspaces === maxBackspacesForS && avgTimePerJamo <= 0.5) {
        tier = 'S';
        tierMultiplier = 2;
    } else if (totalBackspaces <= maxBackspacesForA && avgTimePerJamo <= 0.8) {
        tier = 'A';
        tierMultiplier = 1.5;
    } else if (totalBackspaces <= maxBackspacesForB && avgTimePerJamo <= 1.0) {
        tier = 'B';
        tierMultiplier = 1.3;
    } else {
        tier = 'C';
        tierMultiplier = 1;
    }

    return {
        totalJamos,
        wordCount,
        avgTimePerJamo: avgTimePerJamo.toFixed(2),
        backspaces: totalBackspaces,
        tier,
        tierMultiplier
    };
}

// Al crear sala exitosamente:
createRoomBtn.addEventListener('click', () => {
    socket.emit('create-room', (res) => {
        if (res.success) {
            currentRoomCode = res.roomCode;
            roomStatus.textContent = `Sala: ${currentRoomCode}`;
            document.getElementById('partnerColumn').classList.remove('d-none'); // Muestra la mitad de la pantalla del compañero
            document.getElementById('identifier').classList.remove('d-none'); // Muestra la mitad de la pantalla del compañero
        }
    });
});

// Al unirse a una sala exitosamente:
joinRoomBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) return;
    
    socket.emit('join-room', code, (res) => {
        if (res.success) {
            currentRoomCode = code;
            roomStatus.textContent = `Sala: ${currentRoomCode}`;
            document.getElementById('partnerColumn').classList.remove('d-none'); // Muestra la mitad de la pantalla del compañero
            document.getElementById('identifier').classList.remove('d-none'); // Muestra la mitad de la pantalla del compañero
        } else {
            alert(res.message);
        }
    });
});

socket.on('partner-joined', () => {
    roomStatus.textContent = `Sala: ${currentRoomCode} (Conectado)`;
});

// ESCUCHAR EL TECLEO DEL COMPAÑERO
socket.on('partner-typing', (data) => {
    // data = { currentWord, typedText }
    
    // Si la palabra objetivo cambió o se inicializó, renderizamos sus spans
    if (partnerTargetWordEl.textContent !== data.currentWord) {
        partnerTargetWordEl.innerHTML = data.currentWord.split('').map(char => `<span>${char}</span>`).join('');
    }

    if (data.typedText.length > 0) {
        partnerLiveInputEl.classList.remove('input-display-placeholder');
        partnerLiveInputEl.textContent = data.typedText;
    } else {
        partnerLiveInputEl.classList.add('input-display-placeholder');
        partnerLiveInputEl.textContent = 'Esperando escritura...';
    }

    // Aplicar el mismo pintado carácter por carácter (progreso)
    const partnerSpans = partnerTargetWordEl.querySelectorAll('span');
    partnerSpans.forEach((span, index) => {
        if (index < data.typedText.length && data.typedText[index] === data.currentWord[index]) {
            span.classList.add('progress-match');
        } else {
            span.classList.remove('progress-match');
        }
    });
});

// Opcional en tu script.js para detección de dispositivos táctiles móviles
if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0 && window.innerWidth < 768) {
    // El CSS anterior ya se encarga de mostrar el overlay, pero puedes forzarlo aquí si lo deseas
    document.getElementById('mobileWarning').classList.remove('d-none');
}

// Mantener el foco en el input oculto al hacer clic en la tarjeta
document.addEventListener('click', () => {
    if (!isFinished) {
        userInputEl.focus();
    }
});



// Iluminación del teclado virtual
document.addEventListener('keydown', (e) => {
    const keyElement = document.querySelector(`.kb-key[data-key="${e.code}"]`);
    if (keyElement) {
        keyElement.classList.add('active');
        keypressSound.pause();
        keypressSound.currentTime = 0;
        keypressSound.play();
    }
});

document.addEventListener('keyup', (e) => {
    const keyElement = document.querySelector(`.kb-key[data-key="${e.code}"]`);
    if (keyElement) {
        keyElement.classList.remove('active');
    }
});

// Escuchar los backspaces en tiempo real en el input oculto
//userInputEl.addEventListener('keydown', (e) => {
//    if(isFinished) return;
//    if (e.key === 'Backspace') {
//        backspaceCount++;
//        console.log(backspaceCount)
//    }
//});

// Lectura estándar y limpia del input oculto con soporte IME coreano
userInputEl.addEventListener('input', (e) => {
    if (isFinished) return;

    const currentInputValue = userInputEl.value;

    // Si la longitud actual es menor que la anterior, el usuario borró algo (Backspacing)
    if (currentInputValue.length < previousInputValue.length) {
        // La diferencia de longitud nos dice cuántos "pasos" de borrado dio
        const diff = previousInputValue.length - currentInputValue.length;
        backspaceCount += diff; 
        console.log(backspaceCount)
    }

    // Actualizamos el valor previo para la siguiente pulsación
    previousInputValue = currentInputValue;
    
    // SI EL IME ESTÁ COMPONIendo AÚN, NO VALIDES NADA. 
    // Esto evita que el script interrumpa al teclado en el último carácter.
    requestAnimationFrame(() => {
        if (isFinished) return;
        
        let typedText = userInputEl.value;

        const targetSpans = targetWordEl.querySelectorAll('span');
        targetSpans.forEach((span, index) => {
            if (index < typedText.length && typedText[index] === currentWord[index]) {
                span.classList.add('progress-match');
            } else {
                span.classList.remove('progress-match');
            }
        });

        const maxLength = Math.max(currentWord.length * 2, 30);
        if (typedText.length > maxLength) {
            typedText = typedText.substring(0, maxLength);
            userInputEl.value = typedText;
        }

        if (typedText.length > 0 && !startTime) {
            startTimer();
        }

        if (typedText.length > 0) {
            liveInputDisplayEl.classList.remove('input-display-placeholder');
            liveInputDisplayEl.textContent = typedText;
        } else {
            liveInputDisplayEl.classList.add('input-display-placeholder');
            liveInputDisplayEl.textContent = 'Escribe aquí...';
        }

        // Justo dentro de tu input listener, donde ya calculas el typedText:
        if (currentRoomCode) {
            socket.emit('player-typing', {
                roomCode: currentRoomCode,
                typedText: typedText,
                currentWord: currentWord
            });
        }
        // Validación estricta por longitud exacta (solo si el IME ya cerró la sílaba)
        //if (e.isComposing) return;
        if (liveInputDisplayEl.textContent === currentWord) {
            isFinished = true;
            clearInterval(timerInterval);
            const finalTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // 1. Evaluar rendimiento usando las funciones creadas
            const performance = evaluateWordPerformance(currentWord, finalTime, backspaceCount);

            // 2. Calcular sistema de puntos base y multiplicador de tier
            const basePointsPerJamo = 10;
            let wordBaseScore = basePointsPerJamo * performance.totalJamos * performance.tierMultiplier;

            // 3. Sistema de rachas de perfecto (Si el tier es S, incrementa la racha; si falla o baja de tier, se rompe o se ajusta)
            if (performance.tier === 'S') {
                perfectStreak++;
            } else {
                perfectStreak = 0; // Se rompe la racha si no es S (o puedes ajustarlo según prefieras)
            }

            // Multiplicador de racha (si racha es 0 o 1, multiplica por 1; si es 5, multiplica por 5)
            const streakMultiplier = Math.max(1, perfectStreak);
            const finalWordScore = Math.round(wordBaseScore * streakMultiplier);

            totalScore += finalWordScore;

            // 4. Actualizar la interfaz visual
            //document.getElementById('scoreDisplay').textContent = totalScore;
            //document.getElementById('streakDisplay').textContent = `${perfectStreak} 🔥`;
            //document.getElementById('lastTierDisplay').textContent = performance.tier;
            // Actualizar la interfaz visual de la HUD
            document.getElementById('scoreDisplay').textContent = totalScore;

            // Actualizar Racha en la esquina inferior izquierda
            //const streakMultiplier = Math.max(1, perfectStreak);
            const streakDisplay = document.getElementById('streakDisplay');
            streakDisplay.textContent = `x${streakMultiplier}`;
            //`<img src="/images/flame.png" alt="Flama" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 2px;"> x${streakMultiplier}`;

            // Actualizar Tier con colores e icono de corona si es S
            const tierDisplay = document.getElementById('lastTierDisplay');
            tierDisplay.className = 'tier-badge fw-bold px-2 py-0 rounded-2'; // Limpiar clases anteriores

            if (performance.tier === 'S') {
                tierDisplay.classList.add('tier-s');
                tierDisplay.innerHTML = `S 👑`;
            } else if (performance.tier === 'A') {
                tierDisplay.classList.add('tier-a');
                tierDisplay.textContent = `A`;
            } else if (performance.tier === 'B') {
                tierDisplay.classList.add('tier-b');
                tierDisplay.textContent = `B`;
            } else {
                tierDisplay.classList.add('tier-c');
                tierDisplay.textContent = `C`;
            }


            targetWordEl.classList.add('success');
            liveInputDisplayEl.classList.add('success');
            //userInputEl.disabled = true;
            userInputEl.value = ''; // Limpiamos el input al instante para evitar entradas extra
            userInputEl.blur();     // Quitamos el foco con elegancia sin romper el DOM

            wordMeaningEl.textContent = `${currentMeaning} (${finalTime}s) | Tier: ${performance.tier} (+${finalWordScore}pts)`;
            wordMeaningEl.style.visibility = 'visible';

            successSound.pause();
            successSound.currentTime = 0;
            successSound.play();

            // 5. Reiniciar el contador de backspace para la siguiente palabra
            backspaceCount = 0;

            setTimeout(() => {
                loadNewWord();
            }, 1800);
        }
    });
});

skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadNewWord();
});


fetchWords();

