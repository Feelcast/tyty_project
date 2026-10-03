let words = [];
let currentWord = null;
let currentMeaning = '';
let startTime = null;
let timerInterval = null;
let isFinished = false;

const targetWordEl = document.getElementById('targetWord');
const liveInputDisplayEl = document.getElementById('liveInputDisplay');
const userInputEl = document.getElementById('userInput');
const wordMeaningEl = document.getElementById('wordMeaning');
const timerDisplayEl = document.getElementById('timerDisplay');
const skipBtn = document.getElementById('skipBtn');

// Cargar palabras desde el servidor Node.js
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
    
    // Resetear clases y estilos visuales
    targetWordEl.classList.remove('success');
    liveInputDisplayEl.classList.remove('success');
    liveInputDisplayEl.classList.add('input-display-placeholder');
    liveInputDisplayEl.textContent = 'Escribe aquí...';
    
    wordMeaningEl.style.visibility = 'hidden';
    wordMeaningEl.textContent = '';
    
    // Seleccionar palabra aleatoria
    const randomIndex = Math.floor(Math.random() * words.length);
    currentWord = words[randomIndex].word;
    currentMeaning = words[randomIndex].meaning;
    
    targetWordEl.textContent = currentWord;
    
    // Reiniciar temporizador
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

// Mantener el input oculto enfocado al hacer clic en cualquier parte de la tarjeta
document.addEventListener('click', () => {
    if (!isFinished) {
        userInputEl.focus();
    }
});

// ILUMINACIÓN DEL TECLADO VIRTUAL SEGÚN LA TECLA FÍSICA PRESIONADA
document.addEventListener('keydown', (e) => {
    // Buscar la tecla en el teclado virtual mediante su código físico (ej. 'KeyQ', 'KeyA', etc.)
    const keyElement = document.querySelector(`.kb-key[data-key="${e.code}"]`);
    if (keyElement) {
        keyElement.classList.add('active');
    }
});

document.addEventListener('keyup', (e) => {
    const keyElement = document.querySelector(`.kb-key[data-key="${e.code}"]`);
    if (keyElement) {
        keyElement.classList.remove('active');
    }
});

let ticking = false; // Bandera para controlar el ciclo de animación de forma estricta

userInputEl.addEventListener('input', () => {
    if (isFinished) return;

    // Si ya hay un cuadro de animación pendiente, evitamos saturar el DOM en ráfagas rápidas
    if (!ticking) {
        ticking = true;

        requestAnimationFrame(() => {
            if (isFinished) {
                ticking = false;
                return;
            }

            let typedText = userInputEl.value;

            // Límite razonable para evitar spam de longitud
            const maxLength = Math.max(currentWord.length * 2, 30);
            if (typedText.length > maxLength) {
                typedText = typedText.substring(0, maxLength);
                userInputEl.value = typedText;
            }

            if (typedText.length > 0 && !startTime) {
                startTimer();
            }

            // Actualizar la zona visual de manera inmediata pero controlada
            if (typedText.length > 0) {
                liveInputDisplayEl.classList.remove('input-display-placeholder');
                liveInputDisplayEl.textContent = typedText;
            } else {
                liveInputDisplayEl.classList.add('input-display-placeholder');
                liveInputDisplayEl.textContent = 'Escribe aquí...';
            }

            // Validación estricta por longitud exacta
            if (typedText.length === currentWord.length) {
                if (typedText === currentWord) {
                    isFinished = true;
                    clearInterval(timerInterval);
                    const finalTime = ((Date.now() - startTime) / 1000).toFixed(1);

                    targetWordEl.classList.add('success');
                    liveInputDisplayEl.classList.add('success');
                    userInputEl.disabled = true;

                    wordMeaningEl.textContent = `${currentMeaning} (${finalTime}s)`;
                    wordMeaningEl.style.visibility = 'visible';

                    setTimeout(() => {
                        loadNewWord();
                    }, 1800);
                }
            }

            ticking = false; // Liberamos el cerrojo para el siguiente cuadro
        });
    }
});

skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadNewWord();
});

// Inicializar la aplicación
fetchWords();