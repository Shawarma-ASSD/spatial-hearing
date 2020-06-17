/**************************************************/
/* Variables utilizadas para el sistema de sonido */
/**************************************************/
var context = null;
var merger = null;
var generator = null;
var amplitude = null;
var delays = null;
var gains = null;

/***************************/
/* Constantes del programa */
/***************************/
const _DEFAULT_FREQUENCY_ = 100;
const _DEFAULT_AMPLITUDE_ = 0;
const _DEFAULT_ITD_ = 0;
const _DEFAULT_IID_ = 0;

/************************/
/* Ejecución y bindings */
/************************/
var iidRange = document.getElementById("iidRange");
var itdRange = document.getElementById("itdRange");
var iidText = document.getElementById("iidText");
var itdText = document.getElementById("itdText");
var amplitudeText = document.getElementById("amplitudeText");
var frequencyText = document.getElementById("frequencyText");

document.getElementById("playButton").onclick = onPlay;
document.getElementById("stopButton").onclick = onStop;
document.getElementById("resetButton").onclick = onReset;
document.getElementById("frequency").onchange = onFrequencyChange;
document.getElementById("amplitude").onchange = onAmplitudeChange;
document.getElementById("iidRange").onchange = onIIDChange;
document.getElementById("itdRange").onchange = onITDChange;

initAudioSystem();

/**********************/
/* Funciones callback */
/**********************/

// onPlay()
// Reproducir el sonido
function onPlay(event) {
    context?.resume();
};

// onStop()
// Detener la reproducción
function onStop(event) {
    context?.suspend();
};

// onReset()
// Reiniciar ubicación a parámetros originales
function onReset(event) {
    iidRange.value = 0;
    itdRange.value = 0;
    iidText.textContent = 0;
    itdText.textContent = 0;
    setITD(0);
    setIID(0);
};

// onFrequencyChange()
// El usuario modifica la frecuencia de la senoidal
function onFrequencyChange(event) {
    let currentFrequency = event.target.value;
    generator.frequency.value = currentFrequency;
    frequencyText.textContent = currentFrequency;
};

// onAmplitudeChange()
// El usuario modifica la amplitud de la senoidal
function onAmplitudeChange(event) {
    let currentAmplitude = event.target.value;
    amplitude.gain.value = currentAmplitude / 100;
    amplitudeText.textContent = currentAmplitude;
};

// onITDChange
// El usuario modifica la presencia del ITD
function onITDChange(event) {
    // La idea es que currentITD en modulo va de 0% a 100% y con eso
    // se puede controlar del minimo al maximo valor de ITD, siendo
    // positivo o negativo para indicar si se aplica el retardo
    // del lado derecho o izquierdo respectivamente.
    let currentITD = event.target.value;
    setITD(currentITD);
};

// onIIDChange
// El usuario modifica la presencia del IID
function onIIDChange(event) {
    // La idea es que currentIID en modulo va de 0% a 100%, con esto
    // se puede controlar que la diferencia de intensidad se pueda manejar
    // de 0dB a 10dB. Según si es negativo o positivo, la atenuación se aplica
    // sobre el lado derecho o izquierdo respectivamente.
    let currentIID = event.target.value;
    setIID(currentIID);
};

/*******************************/
/* Funciones de inicialización */
/*******************************/

// setITD
// Actualiza el valor de la ITD
function setITD(itd) {
    let delay = 1.5e-3 * (Math.abs(itd) / 100);
    delays[0].delayTime.value = itd > 0 ? delay : 0;
    delays[1].delayTime.value = itd < 0 ? delay : 0;
    itdText.textContent = delay;
}

// setIID
// Actualiza el valor de la IID
function setIID(iid) {
    let dbAttenuation = (10) * (Math.abs(iid) / 100);
    let attenuation = Math.pow(10, -dbAttenuation / 20);
    gains[0].gain.value = iid > 0 ? attenuation : 1;
    gains[1].gain.value = iid < 0 ? attenuation : 1;
    iidText.textContent = dbAttenuation;
}

// initAudioSystem
// Inicialización del sistema de sonido
function initAudioSystem() {
    // Creamos todas las instancias de los elementos
    // del sistema de audio.
    context = new AudioContext();
    merger = new ChannelMergerNode(
        context, 
        {
            numberOfInputs: 2
        }
    );
    generator = new OscillatorNode(
        context, 
        {
            type: "sine",
            frequency: _DEFAULT_FREQUENCY_
        }
    );
    amplitude = new GainNode(
        context,
        {
            gain: _DEFAULT_AMPLITUDE_
        }
    );
    delays = [
        new DelayNode(context),
        new DelayNode(context)
    ];
    gains = [
        new GainNode(context),
        new GainNode(context)
    ];

    // Conectamos las mismas, según lo deseado
    generator.connect(amplitude);
    amplitude.connect(delays[0]);
    amplitude.connect(delays[1]);
    delays[0].connect(gains[0]);
    delays[1].connect(gains[1]);
    gains[0].connect(merger, 0, 0);
    gains[1].connect(merger, 0, 1);
    merger.connect(context.destination);

    // Inicio el generador
    generator.start();
    context.suspend();
}