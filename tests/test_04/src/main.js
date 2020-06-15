import * as THREE from '../../../modules/three.js/build/three.module.js';
import { OrbitControls } from '../../../modules/three.js/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../../../modules/three.js/examples/jsm/loaders/GLTFLoader.js';
import { asyncGet } from "../../../modules/http.js";
import { SpatialIRContainer } from "../../../modules/spatial.js";
import { SpatialProcessorNode, SchroederReverberatorNode } from "../../../modules/sound.js";

/*********************************/
/* Recursos de la aplicación web */
/*********************************/
const _3D_PERSON_MODEL_ = "../models/gltf/LeePerrySmith/LeePerrySmith.glb";
const _3D_PERSON_TEXTURE_MAP = "../models/gltf/LeePerrySmith/Map-COL.jpg";
const _3D_PERSON_TEXTURE_SPECULAR_MAP = "../models/gltf/LeePerrySmith/Map-SPEC.jpg";
const _3D_PERSON_TEXTURE_NORMAL_MAP = "../models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg";
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
        name: "Discurso (Mujer)",
        supported: ["hutubs"],
        url: "https://shawarma-assd.github.io/resources/samples/woman_44100.wav",
        buffer: null
    },
    {
        name: "Discurso (Mujer)",
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

/************************/
/* Callbacks de eventos */
/************************/

// onPlay()
// Se busca iniciar la reproducción.
function onPlay() {
    context?.resume();
}

// onStop()
// Se busca parar la reproducción.
function onStop() {
    context?.suspend();
}

// onRun()
// Se mandaron a cargar las configuraciones deseadas de HRTF y muestra wav.
async function onRun() {
    /* Deshabilito botones */
    document.getElementById('play').disabled = true;
    document.getElementById('stop').disabled = true;

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

    /* Cargamos la respuesta impulsiva HRTF */
    let container = await initImpulseResponse(_HRTF_[databaseSelected].database);

    /* Cargamos el audio context */
    initAudioContext(container.rate);

    /* Cargamos la muestra de sonido */
    await initSoundSource(sampleSelected);

    /* Conectamos el sistema */
    reverberator = new SchroederReverberatorNode(context);
    reverberator.setParameters(0.05, 0.025);
    spatializer = new SpatialProcessorNode(context);
    spatializer.setHRIRContainer(container);
    spatializer.setReverberator(reverberator);
    spatializer.connect(context.destination);
    source.connect(spatializer.input());

    /* Habilito botones */
    document.getElementById('play').disabled = false;
    document.getElementById('stop').disabled = false;
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
    let distance = sphericalPosition.radius / 500.0;

    // Actualizamos estado del proceso de audio
    if (spatializer?.isAvailable()) {
        spatializer.setPosition(azimutal, elevation, distance);
    }
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

// initSoundSource()
// Inicialización de la fuente de sonido, descargando el .WAV
// y cargándolo en un AudioBufferSourceNode global para conectarlo
// al sistema de procesamiento de sonido.
// @param wav: Índice en el arreglo de declaraciones wav soportadas
async function initSoundSource(wav) {
    let wavDeclaration = _WAV_[wav];
    if (wavDeclaration.buffer === null) {
        let wavResponse = await asyncGet(wavDeclaration.url);
        wavDeclaration.buffer = await wavResponse.arrayBuffer();
    }
    source = new AudioBufferSourceNode(
        context,
        {
            buffer: await context.decodeAudioData(wavDeclaration.buffer),
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
    renderer = new THREE.WebGLRenderer();
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
    controls.minDistance = 30;
    controls.maxDistance = 800;
    controls.maxPolarAngle = Math.PI;
    controls.addEventListener('change', onControlChange);
}

// loop
// Loop de renderización de Three.js
function loop() {
    requestAnimationFrame(loop);
    renderer.render(scene, camera);
}