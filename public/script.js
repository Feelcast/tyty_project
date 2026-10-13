let words = [];
let currentWord = null;
let currentMeaning = '';
let startTime = null;
let timerInterval = null;
let isFinished = false;

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

function loadNewWord() {
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

// Lectura estándar y limpia del input oculto con soporte IME coreano
userInputEl.addEventListener('input', (e) => {
    if (isFinished) return;

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

            

            targetWordEl.classList.add('success');
            liveInputDisplayEl.classList.add('success');
            //userInputEl.disabled = true;
            userInputEl.value = ''; // Limpiamos el input al instante para evitar entradas extra
            userInputEl.blur();     // Quitamos el foco con elegancia sin romper el DOM

            wordMeaningEl.textContent = `${currentMeaning} (${finalTime}s)`;
            wordMeaningEl.style.visibility = 'visible';

            successSound.pause();
            successSound.currentTime = 0;
            successSound.play();

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