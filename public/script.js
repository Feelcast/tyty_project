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
const keypressSound = new Audio('audio/keypress_edit.mp3');
const successSound = new Audio('audio/success.mp3');

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
    
    targetWordEl.textContent = currentWord;
    
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