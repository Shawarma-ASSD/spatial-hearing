import { asyncGet } from "../../../modules/http.js";
import { Plotter } from "./graph.js";
import { SpatialIRContainer } from "../../../modules/spatial.js";
import { AngularProcessorNode } from "./AngularProcessor.js";

// Wrapper para el manejo de un AudioBufferSourceNode
function myAudioBufferNode(context, options) {

    this.start = function() {
        if(!this.playing) {
            this.sound.start();
        }
        this.playing = true;
    }

    this.stop = function() {
        if(this.playing) {
            this.sound.stop();
        }
        this.playing = false;
    }

    this.connect = function(node) {
        this.sound.connect(node);
    }

    this.setBuffer = function(audioBuffer) {
        this.sound.buffer = audioBuffer;
    }

    this.setOnEnded = function(callback) {
        this.sound.onended = callback;
    }

    this.clearOnEnded = function() {
        this.sound.onended = null;
    }

    this.sound = new AudioBufferSourceNode(context, options);
    this.playing = false;

}


/*********************************/
/* Recursos de la aplicación web */
/*********************************/
const _WAV_URL_ = "https://shawarma-assd.github.io/resources/samples/mixfinal.wav";
const _HRTF_URL_ = "https://shawarma-assd.github.io/resources/hrir/HRIR1HUTUBS.json";

/************************/
/* Ejecución de rutinas */
/************************/
document.body.onload = async function onLoad() {
    await initAudioSystem();
}

/****************************************/
/* Variables de procesamiento de sonido */
/****************************************/
var HRIRcontainer = null;
var audioContext = null;
var spatializer = null;
var userSound = null;
var userSoundBuffer = null;
var fileReader = null;
var recorder = null;

/****************************************/
/*    Variables para la animacion       */
/****************************************/
var step = 0;
var startTime = null;
var plotter = null;
let timeout = null;
let animating = false;

/******************************/
/* Configuracion de callbacks */
/******************************/
document.getElementById("volume").onchange = event => onVolumeChange(event.target.value);
document.getElementById("azimuth").onchange = event => onAzimuthChange(event.target.value);
document.getElementById("elevation").onchange = event => onElevationChange(event.target.value);
document.getElementById("offAnimationButton").onclick = event => onStopMoving(event);
document.getElementById("animationButton").onclick = event => onStartMoving(event);
document.getElementById("playButton").onclick = event => onPlayButton(event);
document.getElementById("stopButton").onclick = event => onStopButton(event);
document.getElementById("wavSelector").onchange = event => onWavLoad(event);

/************************/
/* Callbacks de eventos */
/************************/

// onExportWav
// Creo un elemento de reproducción y descarga del .wav grabado
function onExportWav(blob) {
    var url = URL.createObjectURL(blob);
    var li = document.createElement('li');
    var au = document.createElement('audio');
    var hf = document.createElement('button');
    au.controls = true;
    au.src = url;
    hf.href = url;
    hf.download = new Date().toISOString() + '.wav';
    hf.innerHTML = 'Descargar';
    hf.className = 'control-style';
    hf.onclick = function download() {location.href = url;};
    li.appendChild(au);
    li.appendChild(hf);
    document.getElementById('recordings').appendChild(li);
}


// Conecto los botones para controlar el sistema de procesamiento de sonido
// para poder decidir cuando parar o continuar la reproducción del sonido
function onPlayButton(event) {
    if(!userSound) {
        initUserSound();
        userSound.start();
    }
    audioContext.resume();
    resumeAnimation();
    recorder?.clear();
    recorder?.record();
};

function onStopButton(event) {
    audioContext.suspend();
    pauseAnimation();
    recorder?.stop();
    recorder?.exportWAV(onExportWav);
};

// Agrego un controlador del volumen, que modifica de forma abrupta
// el volumen que controla la amplitud de las muestras de sonido
function onVolumeChange(currentVolume) {
    document.getElementById("volumeText").textContent = currentVolume;
    spatializer.setVolume(currentVolume / 100);
};

// Controladores de las coordenadas de la HRTF
function onAzimuthChange(currentAzimuth) {
    spatializer.setPosition(currentAzimuth, spatializer.elevation, spatializer.distance);
    updateHRTFInfo();
};

function onElevationChange(currentElevation) {
    spatializer.setPosition(spatializer.azimutal, currentElevation, spatializer.distance);
    updateHRTFInfo();
};

function onRadiusChange(currentRadius) {
    spatializer.setPosition(spatializer.azimutal, spatializer.elevation, Number(currentRadius));
    updateHRTFInfo();
};

function onStartMoving(event) {
    if(initAnimation(event)) {
        disableSliders();
    }
}

function onStopMoving(event) {
    enableSliders();
    stopAnimation();
}

/*******************************/
/* Funciones de inicialización */
/*******************************/

// initAudioSystem()
// Inicialización de los nodos del sistema de procesamiento de audio,
// realizando las conexiones pertinentes y dejándo todo listo para empezar
// a funcionar.
// ¡Atención! Esta función se encarga de ejecutar:
//   initSoundSource(), initImpulsiveResponse() e initAudioContext()
async function initAudioSystem() {
    initAudioContext(44100.0);
    await initSoundSource(_WAV_URL_);
    await initImpulsiveResponse(_HRTF_URL_);

    spatializer = new AngularProcessorNode(audioContext);
    spatializer.setHRIRContainer(HRIRcontainer);
    spatializer.connect(audioContext.destination);

    plotter = new Plotter('plot');
    updateHRTFInfo();
    setHRTFvalues();
}

// initAudioContext()
// Inicialización del audio context para el WebAudio API
function initAudioContext(rate) {
    if (audioContext == null) {
        audioContext = new AudioContext(
            {
                latencyHint: 'interactive',
                sampleRate: rate
            }
        );
        audioContext.resume();
    }
}

// initSoundSource()
// Inicialización de la fuente de sonido, descargando el .WAV
// y cargándolo en un AudioBufferSourceNode global para conectarlo
// al sistema de procesamiento de sonido.
// @param url: Dirección de la fuente de sonido .wav
async function initSoundSource(url) {
    let wavResponse = await asyncGet(url);
    let wavBuffer = await wavResponse.arrayBuffer();
    let buffer = await audioContext.decodeAudioData(wavBuffer);
    userSoundBuffer = await audioContext.createBuffer(2, buffer.length, audioContext.sampleRate);
    userSoundBuffer = buffer;
    // Creo un FileReader para controlar la carga de los archivos de sonido
    // utilizando las Promises de forma asincrónica
    fileReader = new FileReader();
}

// initImpulsiveResponse()
// Inicialización de las respuesta impulsivas obtenidas de la base de datos
// para la construcción de los filtros FIR correspondientes
// @param url: Dirección para descargar las HRTF's
async function initImpulsiveResponse(url) {
    let hrirResponse = await asyncGet(url);
    let hrirJson = await hrirResponse.text();
    HRIRcontainer = SpatialIRContainer.FromJson(JSON.parse(hrirJson));
}

function initUserSound(save = false) {
    let ret = false;
    if(userSoundBuffer && spatializer) {
        if(userSound) {
            userSound.stop();
        }
        userSound = new myAudioBufferNode(audioContext,
            {
                loop: false
            }
        );
        userSound.connect(spatializer.input()); 
        userSound.setBuffer(userSoundBuffer);

        /* Creo y conecto el audio recorder */
        if (save)
            recorder?.exportWAV(onExportWav);
        recorder = new Recorder(spatializer.output());
        recorder.record();

        ret = true;
    }
    return ret;
}


/*******************************/
/* Funciones de la animacion   */
/*******************************/

function initAnimation(event) {
    let ret = false;
    // si habia una animacion la freno y va a arrancar de nuevo
    if(userSound) {
        userSound.clearOnEnded();
    }
    if(timeout) {
        window.clearInterval(timeout);
        timeout = null;
    }
    if(initUserSound() && spatializer.container) {
        userSound.start();
        spatializer.setPosition(0, 0, spatializer.distance);
        animating = true;
        // hacemos pasos de 0.1 sec
        step = 1/10.0*1000;
        startTime = audioContext.currentTime;
        // 3 veces por segundo movemos 10 grados a la derecha
        timeout = window.setInterval(animation, step);
        userSound.setOnEnded(initAnimation);
        ret = true;
    }
    else {
        alert('Espere mientras se cargan los archivos :)');
    }
    return ret;
}

function stopAnimation() {
    if(animating) {
        if(timeout) {
            window.clearInterval(timeout);
            timeout = null;
        }
        animating = false;
        userSound.clearOnEnded();
        initUserSound(true);
        userSound.start();
    }
}

function pauseAnimation() {
    if(animating) {
        if(timeout) {
            window.clearInterval(timeout);
            timeout = null;
        }
        userSound.clearOnEnded();
    }
}

function resumeAnimation() {
    if(animating) {
        // Si no esta corriendo ya la animacion
        if(!timeout) {
            timeout = window.setInterval(animation, step);
            userSound.setOnEnded(initAnimation);
        }
    }
}

function animation() {
    let elapsed = audioContext.currentTime - startTime;
    // muevo del centro a la izquierda por 1 sec
    if ((elapsed >= 3) && (elapsed < 4)) {
        spatializer.setPosition( spatializer.azimutal + step*90/1000, spatializer.elevation, spatializer.distance);
    }
    // de la izquierda a la derecha en 1 sec
    else if ((elapsed >= 4) && (elapsed <= 5)) {
        spatializer.setPosition( spatializer.azimutal - step*180/1000, spatializer.elevation, spatializer.distance);
    }
    // muevo de la derecha a la izquierda por 2 sec
    else if ((elapsed >= 6) && (elapsed < 8)) {
        spatializer.setPosition( spatializer.azimutal + step*90/1000, spatializer.elevation, spatializer.distance);
    }
    // de la izquierda a la derecha en 1 sec
    else if ((elapsed >= 8) && (elapsed <= 9)) {
        spatializer.setPosition( spatializer.azimutal - step*180/1000, spatializer.elevation, spatializer.distance);
    }
    // del medio para abajo en 1 sec
    else if ((elapsed >= 11) && (elapsed <= 12)) {
        spatializer.setPosition( spatializer.azimutal, spatializer.elevation - step*70/1000, spatializer.distance);  
    }
    // de derecha a izquierda todo por abajo
    else if ((elapsed >= 14) && (elapsed <= 15)) {
        spatializer.setPosition( spatializer.azimutal - step*180/1000, spatializer.elevation, spatializer.distance);
    }
    // sube
    else if ((elapsed >= 18.5) && (elapsed <= 20)) {
        spatializer.setPosition( spatializer.azimutal, spatializer.elevation + step*140/1.5/1000, spatializer.distance);  
    }
    // baja
    else if ((elapsed >= 21-1.1*step/1000) && (elapsed <= 21)) {
        spatializer.setPosition( spatializer.azimutal, -70, spatializer.distance);  
    }
    // sube
    else if ((elapsed >= 21) && (elapsed <= 22)) {
        spatializer.setPosition( spatializer.azimutal, spatializer.elevation + step*140/1000, spatializer.distance);  
    }
    // baja
    else if ((elapsed >= 23-1.1*step/1000) && (elapsed <= 23)) {
        spatializer.setPosition( spatializer.azimutal, -70, spatializer.distance);   
    }
    // sube
    else if ((elapsed >= 23.5) && (elapsed <= 24.5)) {
        spatializer.setPosition( spatializer.azimutal, spatializer.elevation + step*140/1000, spatializer.distance);  
    }
    // baja
    else if ((elapsed >= 25.5-1.1*step/1000) && (elapsed <= 25.5)) {
        spatializer.setPosition( spatializer.azimutal, -70, spatializer.distance);   
    }
    // sube
    else if ((elapsed >= 27-1.1*step/1000) && (elapsed <= 27)) {
        spatializer.setPosition( spatializer.azimutal, +70, spatializer.distance);   
    }
    // baja
    else if ((elapsed >= 28-1.1*step/1000) && (elapsed <= 28)) {
        spatializer.setPosition( spatializer.azimutal, -70, spatializer.distance);   
    }
    // sube
    else if ((elapsed >= 29-1.1*step/1000) && (elapsed <= 29)) {
        spatializer.setPosition( spatializer.azimutal, +70, spatializer.distance);   
    }
    updateHRTFInfo();
}

function updateHRTFInfo() {
    document.getElementById("azimuthText").textContent = spatializer.azimutal;
    document.getElementById("elevationText").textContent = Math.round(spatializer.elevation);    
    document.getElementById("radiusText").textContent = spatializer.distance;
    let resp = spatializer.getImpulseResponses();
    plotter.plot([resp.getChannelData(0), resp.getChannelData(1)]);
}

function setHRTFvalues() {
    document.getElementById("azimuth").value = spatializer.azimutal;
    document.getElementById("elevation").value = spatializer.elevation;    
}

function disableSliders() {
    document.getElementById("azimuth").disabled = true;
    document.getElementById("elevation").disabled = true;    
}

function enableSliders() {
    document.getElementById("azimuth").disabled = false;
    document.getElementById("elevation").disabled = false;    
}


// Ante los cambios en la carga de un archivo, lo vuelvo a leer
// para que luego cuando termine de ser procesado por el reader,
// esté disponible como buffer en memoria para cargar al sistema
// de procesamiento de audio context.
function onWavLoad(event) {
    let file = event.target.files[0];
    let extension = file.name.split('.').pop().toLowerCase();
    if (extension == "wav") {
        fileReader.onload = function (event) {
            audioContext.decodeAudioData(event.target.result, function(buffer) {
                    userSoundBuffer = audioContext.createBuffer(2, buffer.length, audioContext.sampleRate);
                    userSoundBuffer = buffer;
                    initUserSound();
                }
            );
        };
        fileReader.readAsArrayBuffer(file);
    }
    else {
        alert('Se debe ingresar un archivo WAV!');
    }
};