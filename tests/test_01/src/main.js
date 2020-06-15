// Creo el contexto de Web Audio API que contiene mi grafo de procesamiento de sonido
const audioContext = new AudioContext();

// Creo un FileReader para controlar la carga de los archivos de sonido
// utilizando las Promises de forma asincrónica
const fileReader = new FileReader();

// Creo un nodo de entrada proveniente de un oscilador armónico!
const oscillator = new OscillatorNode(audioContext,
    {
        type: "sine",
        frequency: 100
    }
);

const oscillatorAmplitude = new GainNode(audioContext,
    {
        gain: 0
    }
);

// Aquí viene lo bueno jóvenes, agreguemos una entrada proveniente de un buffer
// de memoria, cargado con la muestra de algún .WAV del usuario
const userSound = new AudioBufferSourceNode(audioContext,
    {
        loop: true
    }
);

// Agreguemos un poco de control de volumen con un nodo de ganancia!
const gain = new GainNode(audioContext,
    {
        gain: 0
    }
);

// Realizo las conexiones del sistema de procesamiento
userSound.connect(gain);
oscillator.connect(oscillatorAmplitude);
oscillatorAmplitude.connect(gain);
gain.connect(audioContext.destination);

// Inicializo todos los nodos para que empiecen a funcionar
oscillator.start();
userSound.start();

// Conecto los botones para controlar el sistema de procesamiento de sonido
// para poder decidir cuando parar o continuar la reproducción del sonido
function onPlayButton(event) {
    audioContext.resume();
};

function onStopButton(event) {
    audioContext.suspend();
};

// Agrego un controlador del volumen, que modifica de forma abrupta
// el volumen que controla la amplitud de las muestras de sonido
function onVolumeChange(currentVolume) {
    document.getElementById("volumeText").textContent = currentVolume;
    gain.gain.value = currentVolume / 100;
};

// Controladores del generador de senoidal pura
function onFrequencyChange(currentFrequency) {
    document.getElementById("frequencyText").textContent = currentFrequency;
    oscillator.frequency.value = currentFrequency;
};

function onAmplitudeChange(currentAmplitude) {
    document.getElementById("oscillatorAmplitudeText").textContent = currentAmplitude;
    oscillatorAmplitude.gain.value = currentAmplitude / 100;
};

// Ante los cambios en la carga de un archivo, lo vuelvo a leer
// para que luego cuando termine de ser procesado por el reader,
// esté disponible como buffer en memoria para cargar al sistema
// de procesamiento de audio context.
function onFileLoad(event) {
    let file = event.target.files[0];
    fileReader.readAsArrayBuffer(file);
};

fileReader.onload = function (event) {
    audioContext.decodeAudioData(event.target.result, function(buffer) {
            userSound.buffer = buffer;
        }
    );
};
