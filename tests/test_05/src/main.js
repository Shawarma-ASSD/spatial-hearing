 import { asyncGet } from "../../../modules/http.js";
 import { SpatialIRContainer } from "../../../modules/spatial.js";
 import {  SchroederReverberatorNode } from "../../../modules/sound.js";
 import {SuperReverberatorNode} from "./SuperReverberator.js"

/*********************************/
/* Recursos de la aplicación web */
/*********************************/
const _REVERBERATOR_ = [
    {
        name: "Studio",
        url: "https://shawarma-assd.github.io/resources/brir/BRIR_4.json",
        container: null
    },
    {
        name: "Chamber Hall",
        url: "https://shawarma-assd.github.io/resources/brir/chamber_hall.json",
        container: null
    },
    {
        name: "Conference Room",
        url: "https://shawarma-assd.github.io/resources/brir/conference_room.json",

        container: null
    },
    {
        name:"Schroeder",
        url: null,
        container: null
    }
];
const _BRIR_DEFAULT_ = "Conference Room";
const _WAV_ = [
    {
        name: "Discurso (Hombre)",
        supported: ["Studio", "Schroeder"],
        url: "https://shawarma-assd.github.io/resources/samples/indian_48000.wav",
        rate: 48000,
        buffer: null
    },
    {
        name: "Discurso II (Mujer)",
        supported: ["Chamber Hall","Conference Room", "Schroeder"],
        url: "https://shawarma-assd.github.io/resources/samples/female.wav",
        rate: 44100,
        buffer: null
    },
    {
        name: "Discurso I (Mujer)",
        supported: ["Chamber Hall","Conference Room", "Schroeder"],
        url: "https://shawarma-assd.github.io/resources/samples/woman_44100.wav",
        rate: 44100,
        buffer: null
    },
    {
        name: "Discurso I (Mujer)",
        supported: ["Studio", "Schroeder"],
        url: "https://shawarma-assd.github.io/resources/samples/woman_48000.wav",
        rate: 48000,
        buffer: null
    }
];

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

/************************/
/* Ejecución de rutinas */
/************************/
document.body.onload = async function onLoad() {
     /* Agregamos las opciones de bases de datos disponibles para seleccionar */
     for (let i = 0 ; i < _REVERBERATOR_.length ; i++) {
        let option = document.createElement('option');
        option.innerHTML = _REVERBERATOR_[i].name;
        option.value = i;
        document.getElementById('reverberator').appendChild(option);
    }

    /* Valores por defecto de posibles muestras de sonido */
    onBRIRSelected(0);

    disableControl();
}
document.getElementById('run').onclick = onRun;
document.getElementById('play').onclick = onPlay;
document.getElementById('stop').onclick = onStop;
document.getElementById("volume").onchange = event => onVolumeChange(event.target.value);
document.getElementById("distance").onchange = event => onDistanceChange(event.target.value);
document.getElementById("reverberator").onchange = event => onBRIRSelected(event.target.value);
document.getElementById("azimuth").onchange = event => onAzimuthChange(event.target.value);

/****************************************/
/* Variables de procesamiento de sonido */
/****************************************/

var reverberator = null;
var context = null;
var source = null;
var recorder = null;
var volume = null;
var brirContainer = null;
/************************/
/* Callbacks de eventos */
/************************/

// Agrego un controlador del volumen, que modifica de forma abrupta
// el volumen que controla la amplitud de las muestras de sonido
function onVolumeChange(currentVolume) {
    document.getElementById("volumeText").textContent = currentVolume;
    volume.gain.value = currentVolume/100;
};
// onExportWav
// Creo un elemento de reproducción y descarga del .wav grabado
function onExportWav(blob) {
    var url = URL.createObjectURL(blob);
    var li = document.createElement('li');
    var au = document.createElement('audio');
    var hf = document.createElement('a');
    au.controls = true;
    au.src = url;
    hf.href = url;
    hf.download = new Date().toISOString() + '.wav';
    hf.innerHTML = 'Download .WAV';
    li.appendChild(au);
    li.appendChild(hf);
    document.getElementById('recordings').appendChild(li);
}

// onPlay()
// Se busca iniciar la reproducción.
function onPlay() {
    document.getElementById('status').textContent = "Grabando...";
    document.getElementById('play').disabled = true;
    document.getElementById('stop').disabled = false;
    context?.resume();
    recorder?.clear();
    recorder?.record();
}
// onStop()
// Se busca parar la reproducción.
function onStop() {
    document.getElementById('status').textContent = "Grabación finalizada.";
    document.getElementById('play').disabled = false;
    document.getElementById('stop').disabled = true;
    context?.suspend();
    recorder?.stop();
    recorder?.exportWAV(onExportWav);
}

// onRun()
// Se mandaron a cargar las configuraciones deseadas de HRTF y muestra wav.
async function onRun() {
    disableControl();
    document.getElementById('run').disabled = true;

    /* Si hay instancias previas, las cierro */
    if (context !== null) {
        context.close();
        reverberator = null;
        context = null;
        source = null;
    }
    

    /* Busco opciones elegidas */
    let sampleSelected = document.getElementById('sample').value;
    let reverberatorSelected = document.getElementById('reverberator').value;
    initAudioContext(_WAV_[sampleSelected].rate);
    await initSoundSource(sampleSelected);
    /* Inicializando, cargandos cosas... */
    if (_REVERBERATOR_[reverberatorSelected].name == "Schroeder") {
        reverberator = new SchroederReverberatorNode(context);
        reverberator.setParameters(0.05, 0.015);
    } else  {
        let brirContainer = await initRoomImpulsiveResponse(_REVERBERATOR_[reverberatorSelected].name);
        reverberator = new  SuperReverberatorNode(context);
        reverberator.setSpatialIRContainer(brirContainer);
    }
    

    /* Instanciando nodos y conectando el grafo de procesamiento */
    volume = new GainNode(context, {gain: 10.0});

    
    source.connect(reverberator.input());
    reverberator.connect(volume);
    volume.connect(context.destination);

    /* Creo y conecto el audio recorder */
    recorder = new Recorder(reverberator.output());

    /* Habilito botones */
    enableControl();
}

//onDistanceChange()
//cambia la distancia a la que se escucha la fuente de sonido en el reverberador
function onDistanceChange(currentDistance) {
    document.getElementById("distanceText").textContent = Math.round(((currentDistance-1)/3)*100);
    reverberator?.setPosition(reverberator.azimutal, reverberator.elevation, Number(currentDistance));
};

// Controladores de las coordenadas de la HRTF
function onAzimuthChange(currentAzimuth) {
    reverberator?.setPosition(currentAzimuth, reverberator.elevation, reverberator.distance);
    document.getElementById("azimuthText").textContent = reverberator.azimutal;
};

/*******************************/
/* Funciones de inicialización */
/*******************************/
// initAudioContext()
// Inicialización del audio context para el WebAudio API
// @param rate: Frecuencia de muestreo
function initAudioContext(rate) {
    if (context == null) {
        context = new AudioContext(
            {
                latencyHint: 'interactive',
                sampleRate: rate
            }
        );
        context.suspend();
    }
}

// initRoomImpulsiveResponse()
// Inicialización de las respuesta impulsivas para reverberacion obtenidas de la base de datos
// para la construcción de los filtros FIR correspondientes para la habitación
// @param name: Nombre de la BRIR seleccionada
async function initRoomImpulsiveResponse(name) {
    let curr = _REVERBERATOR_.find(reverberator => reverberator.name == name);
    if (curr.container === null) {
        let response = await asyncGet(curr.url);
        let json = await response.text();
        curr.container = SpatialIRContainer.FromJson(JSON.parse(json));
    }
    return curr.container;
}

// initSoundSource()
// Inicialización de la fuente de sonido, descargando el .WAV
// y cargándolo en un AudioBufferSourceNode global para conectarlo
// al sistema de procesamiento de sonido.
// @param wav: Índice en el arreglo de declaraciones wav soportadas
async function initSoundSource(wav) {
    let wavDeclaration = _WAV_[wav];
    if (wavDeclaration.buffer === null) {
        let wavResponse = await asyncGet(wavDeclaration.url);
        wavDeclaration.buffer = await context.decodeAudioData(await wavResponse.arrayBuffer());
    }
    source = new AudioBufferSourceNode(
        context,
        {
            buffer: wavDeclaration.buffer,
            loop: true
        }
    );
    source.start();
}
// onBRIRSelected(event)
// Se seleccionó una BRIR, muestro sonidos válidos o soportados.
function onBRIRSelected(event) {
    let supportedSamples = _WAV_.filter(wav => wav.supported.includes(_REVERBERATOR_[event].name));
    document.getElementById('sample').innerHTML = "";
    for (let i = 0 ; i < supportedSamples.length ; i++) {
        let option = document.createElement('option');
        option.value = _WAV_.findIndex(wav => wav == supportedSamples[i]);
        option.innerHTML = supportedSamples[i].name;
        document.getElementById('sample').appendChild(option);
    }
}

//disableControl()
//prepara los botones cuando se carga la pagina
function disableControl(){
    document.getElementById('play').disabled = true;
    document.getElementById('stop').disabled = true;
    document.getElementById('run').disabled = false;
    document.getElementById('volume').disabled = true;
    document.getElementById('distance').disabled = true;
    document.getElementById("azimuth").disabled = true;
}

//enableControl()
//prepara los botones cuando se carga la brir
function enableControl(){
    document.getElementById('play').disabled = false;
    document.getElementById('stop').disabled = true;
    document.getElementById('run').disabled = false;
    document.getElementById('volume').disabled = false;
    document.getElementById('distance').disabled = false;
    document.getElementById("azimuth").disabled = false;
}