// Creando el contexto de audio web api para crear nuestro grafo de procesamiento de señales
const audioContext = new AudioContext();

// Creo el nodo de merge, para trabajar señales de cada lado, Left y Right 
// por separado y luego combinarlas directamente para escucharlas en el destination
const merger = audioContext.createChannelMerger(2);

// Creo la fuente del sonido, en este caso será un generador senoidal
const generator = new OscillatorNode(
    audioContext,
    {
        frequency: 100,
        type: "sine"
    }
);

// Creando las lineas de retardo y los nodos de ganancia
const beta = new GainNode(audioContext);
const leftDelay = new DelayNode(audioContext);
const rightDelay = new DelayNode(audioContext);
const leftGain = new GainNode(audioContext);
const rightGain = new GainNode(audioContext);

// Inicializando los nodos del grafo
generator.start()

// Realizando las conexiones de todos los nodos del grafo
generator.connect(beta);
beta.connect(leftDelay);
beta.connect(rightDelay);
leftDelay.connect(leftGain);
rightDelay.connect(rightGain);
leftGain.connect(merger, 0, 0);
rightGain.connect(merger, 0, 1);
merger.connect(audioContext.destination);

// Conectando los botones de control de reproducción con un 
// callback apropiado para iniciar o finalizar la reproducción
function onPlayButton(event) {
    audioContext.resume();
};

function onStopButton(event) {
    audioContext.suspend();
};

function onResetButton(event) {
    document.getElementById("iidRange").value = 0;
    document.getElementById("itdRange").value = 0;
    onIIDChange(0);
    onITDChange(0);
};

// Conectando los cambios de los valores de IID, ITD y la
// manipulación del generador de señales para analizar cambios de frecuencia
function onFrequencyChange(currentFrequency) {
    generator.frequency.value = currentFrequency;
    document.getElementById("frequencyText").textContent = currentFrequency;
};

function onAmplitudeChange(currentAmplitude) {
    beta.gain.value = currentAmplitude / 100;
    document.getElementById("amplitudeText").textContent = currentAmplitude;
};

function onITDChange(currentITD) {
    // La idea es que currentITD en modulo va de 0% a 100% y con eso
    // se puede controlar del minimo al maximo valor de ITD, siendo
    // positivo o negativo para indicar si se aplica el retardo
    // del lado derecho o izquierdo respectivamente.
    let delay = 1.5e-3 * (Math.abs(currentITD) / 100);
    leftDelay.delayTime.value = currentITD > 0 ? delay : 0;
    rightDelay.delayTime.value = currentITD < 0 ? delay : 0;

    document.getElementById("itdText").textContent = delay;
};

function onIIDChange(currentIID) {
    // La idea es que currentIID en modulo va de 0% a 100%, con esto
    // se puede controlar que la diferencia de intensidad se pueda manejar
    // de 0dB a 10dB. Según si es negativo o positivo, la atenuación se aplica
    // sobre el lado derecho o izquierdo respectivamente.
    let dbAttenuation = (10) * (Math.abs(currentIID) / 100);
    let attenuation = Math.pow(10, -dbAttenuation / 20);
    leftGain.gain.value = currentIID > 0 ? attenuation : 1;
    rightGain.gain.value = currentIID < 0 ? attenuation : 1;

    document.getElementById("iidText").textContent = dbAttenuation;
};