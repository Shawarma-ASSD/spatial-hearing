import * as THREE from '../../../modules/three.js/build/three.module.js';
import { OrbitControls } from '../../../modules/three.js/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../../../modules/three.js/examples/jsm/loaders/GLTFLoader.js';
import { asyncGet } from "../../../modules/http.js";
import { SpatialIRContainer } from "../../../modules/spatial.js";
import { SpatialProcessorNode, RoomReverberatorNode, SchroederReverberatorNode } from "../../../modules/sound.js";

/*********************************/
/* Recursos de la aplicación web */
/*********************************/
const _3D_PERSON_MODEL_ = "../models/gltf/LeePerrySmith/LeePerrySmith.glb";
const _3D_PERSON_TEXTURE_MAP = "../models/gltf/LeePerrySmith/Map-COL.jpg";
const _3D_PERSON_TEXTURE_SPECULAR_MAP = "../models/gltf/LeePerrySmith/Map-SPEC.jpg";
const _3D_PERSON_TEXTURE_NORMAL_MAP = "../models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg";
const _BRIR_ = [
    {
        name: "Room_4",
        url: "https://shawarma-assd.github.io/resources/brir/BRIR_4.json",
        container: null
    },
    {
        name: "Room_8",
        url: "https://shawarma-assd.github.io/resources/brir/SBSBRIR00.json",
        container: null
    },
    {
        name: "Conference",
        url: "https://shawarma-assd.github.io/resources/brir/conference_room.json",
        container: null
    }
];
const _BRIR_44100_DEFAULT_ = "Conference";
const _BRIR_48000_DEFAULT_ = "Room_8";
const _HRTF_ = [
    {
        database: "ari",
        url: "https://shawarma-assd.github.io/resources/hrir/ari.json",
        container: null
    },
    {
        database: "hutubs",
        url: "https://shawarma-assd.github.io/resources/hrir/HRIR1HUTUBS.json",
        container: null
    }
];
const _WAV_ = [
    {
        name: "Discurso (Hombre)",
        supported: ["ari"],
        url: "https://shawarma-assd.github.io/resources/samples/indian_48000.wav",
        buffer: null
    },
    {
        name: "Discurso II (Mujer)",
        supported: ["hutubs"],
        url: "https://shawarma-assd.github.io/resources/samples/female.wav",
        buffer: null
    },
    {
        name: "Discurso I (Mujer)",
        supported: ["hutubs"],
        url: "https://shawarma-assd.github.io/resources/samples/woman_44100.wav",
        buffer: null
    },
    {
        name: "Discurso I (Mujer)",
        supported: ["ari"],
        url: "https://shawarma-assd.github.io/resources/samples/woman_48000.wav",
        buffer: null
    }
];

/************************/
/* Ejecución de rutinas */
/************************/
document.body.onload = async function onLoad() {
    /* Agregamos las opciones de bases de datos disponibles para seleccionar */
    for (let i = 0 ; i < _HRTF_.length ; i++) {
        let option = document.createElement('option');
        option.value = i;
        option.innerHTML = _HRTF_[i].database.toUpperCase();
        document.getElementById('database').appendChild(option);
    }

    /* Valores por defecto de posibles muestras de sonido */
    onDatabaseSelected(0);

    /* Inicializo los sistemas de video 3D */
    initVideoSystem();
    loop();
}

document.getElementById('database').onchange = event => onDatabaseSelected(event.target.value);
document.getElementById('run').onclick = onRun;
document.getElementById('play').onclick = onPlay;
document.getElementById('stop').onclick = onStop;

/*******************************************/
/* Variables para simulación de entorno 3D */
/***************************************** */ 
var scene, renderer, camera, loader, controls, light, mesh, textureLoader;

/****************************************/
/* Variables de procesamiento de sonido */
/****************************************/
var reverberator = null;
var context = null;
var spatializer = null;
var source = null;
var recorder = null;
var volume = null;

/************************/
/* Callbacks de eventos */
/************************/

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
    document.getElementById('play').disabled = true;
    document.getElementById('stop').disabled = true;
    document.getElementById('run').disabled = true;

    /* Si hay instancias previas, las cierro */
    if (context !== null) {
        context.close();
        reverberator = null;
        context = null;
        spatializer = null;
        source = null;
    }
    
    /* Busco opciones elegidas */
    let databaseSelected = document.getElementById('database').selectedIndex;
    let sampleSelected = document.getElementById('sample').value;
    let reverberatorSelected = document.getElementById('reverberator').value;

    /* Inicializando, cargandos cosas... */
    let hrirContainer = await initImpulseResponse(_HRTF_[databaseSelected].database);
    initAudioContext(hrirContainer.rate);
    await initSoundSource(sampleSelected);

    /* Instanciando nodos y conectando el grafo de procesamiento */
    volume = new GainNode(context, {gain: 10.0});

    if (reverberatorSelected == "schroeder") {
        reverberator = new SchroederReverberatorNode(context);
        reverberator.setParameters(0.05, 0.015);
    } else if (reverberatorSelected == "brir") {
        let brirContainer = await initRoomImpulsiveResponse(hrirContainer.rate == 48000.0 ? _BRIR_48000_DEFAULT_ : _BRIR_44100_DEFAULT_);
        reverberator = new RoomReverberatorNode(context);
        reverberator.setSpatialIRContainer(brirContainer);
    }

    spatializer = new SpatialProcessorNode(context);
    spatializer.setHRIRContainer(hrirContainer);
    spatializer.setReverberator(reverberator);
    source.connect(spatializer.input());
    spatializer.connect(volume);
    volume.connect(context.destination);

    /* Creo y conecto el audio recorder */
    recorder = new Recorder(spatializer.output());

    /* Habilito botones */
    document.getElementById('play').disabled = false;
    document.getElementById('stop').disabled = true;
    document.getElementById('run').disabled = false;
}

// onDatabaseSelected(event)
// Se seleccionó una base de datos, muestro sonidos válidos o soportados.
function onDatabaseSelected(event) {
    let supportedSamples = _WAV_.filter(wav => wav.supported.includes(_HRTF_[event].database));
    document.getElementById('sample').innerHTML = "";
    for (let i = 0 ; i < supportedSamples.length ; i++) {
        let option = document.createElement('option');
        option.value = _WAV_.findIndex(wav => wav == supportedSamples[i]);
        option.innerHTML = supportedSamples[i].name;
        document.getElementById('sample').appendChild(option);
    }
}

// onControlChange()
// Rutina de acción cuando el usuario mueve el control orbital de la cámara
// y se desplaza, debemos actualizar la posición de la fuente de sonido
// En este lugar ocurre el puente entre VideoSystem y AudioSystem.
function onControlChange() {
    // Buscamos posición de la camara
    let cameraPosition = camera.position;
    let sphericalPosition = new THREE.Spherical();
    sphericalPosition.setFromVector3(cameraPosition);

    // Convertimos a las coordenadas esféricas convencionales
    let azimutal = sphericalPosition.theta * 90.0 / (Math.PI / 2);
    let elevation = ((Math.PI / 2) - sphericalPosition.phi) * 90.0 / (Math.PI / 2);
    let distance = sphericalPosition.radius * 0.01;

    // Actualizamos estado del proceso de audio
    spatializer?.setPosition(azimutal, elevation, distance);
}

/*******************************/
/* Funciones de inicialización */
/*******************************/
// initVideoSystem()
// Inicialización y conexión de los componentes del sistema 3D
// para la interacción usuario-sonido.
// ¡Atención! Esta función de inicialización carga todas las demás.
function initVideoSystem() {
    initGeneralScene();
    initCamera();
    initLights();
    initPerson();
    initControls();
} 

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
    let curr = _BRIR_.find(brir => brir.name == name);
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

// initImpulseResponse
// Carga una respuesta impulsiva y devuelve el correspondiente SpatialIRContainer
// @param database: Base de datos seleccionada
async function initImpulseResponse(database) {
    let curr = _HRTF_.find(hrtf => hrtf.database == database);
    if (curr.container === null) {
        let response = await asyncGet(curr.url);
        let json = await response.text();
       curr.container = SpatialIRContainer.FromJson(JSON.parse(json));
    }
    return curr.container;
}

// initGeneralScene()
// Inicializa las características generales del sistema 3D
// como la escena, el renderizador.
function initGeneralScene() {
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}

// initCamera()
// Inicializa la camara del sistema 3D
function initCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 100);
}

// initLights()
// Inicializa las luces utilizadas en el sistema 3D
function initLights() {
    light = new THREE.PointLight( 0xFFFFFF, 1.2, 0, 2);
    light.position.set(0, 100, 100);
    scene.add(light);
}

// initPerson()
// Inicializa la persona con sus texturas para la simulación
function initPerson() {
    textureLoader = new THREE.TextureLoader();
    loader = new GLTFLoader();
    loader.load( _3D_PERSON_MODEL_, function ( gltf ) {
        mesh = gltf.scene.children[ 0 ];
        mesh.material = new THREE.MeshPhongMaterial( {
            specular: 0x111111,
            map: textureLoader.load( _3D_PERSON_TEXTURE_MAP ),
            specularMap: textureLoader.load( _3D_PERSON_TEXTURE_SPECULAR_MAP ),
            normalMap: textureLoader.load( _3D_PERSON_TEXTURE_NORMAL_MAP ),
            shininess: 25
        } );
        scene.add( mesh );
        mesh.scale.set( 10, 10, 10 );
    }, undefined, function ( error ) {
        console.error( error );
    } );
}

// initControls()
// Inicializa los controles del usuario para mover la cámara y con ello
// modificar la posición del sonido espacial.
function initControls() {
    controls = new OrbitControls( camera, renderer.domElement );
    controls.screenSpacePanning = false;
    controls.minDistance = 40;
    controls.maxDistance = 800;
    controls.maxPolarAngle = Math.PI;
    controls.rotateSpeed = 0.2;
    controls.enablePan = false;
    controls.addEventListener('change', onControlChange);
}

// loop
// Loop de renderización de Three.js
function loop() {
    requestAnimationFrame(loop);
    renderer.render(scene, camera);
}