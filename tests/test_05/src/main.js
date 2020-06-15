import * as THREE from '../../../modules/three.js/build/three.module.js';
import { OrbitControls } from '../../../modules/three.js/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../../../modules/three.js/examples/jsm/loaders/GLTFLoader.js';
import { asyncGet } from "../../../modules/http.js";
import { SpatialIRContainer } from "../../../modules/spatial.js";
import { SpatialProcessorNode, SchroederReverberatorNode, RoomReverberatorNode } from "../../../modules/sound.js";

/*********************************/
/* Recursos de la aplicación web */
/*********************************/
const _WAV_URL_ = "https://shawarma-assd.github.io/testings/data/indian_48000.wav";
const _HRTF_URL_ = "https://media.githubusercontent.com/media/shawarma-assd/testings/master/data/ari.json";
const _BRIR_URL_ =  "https://media.githubusercontent.com/media/shawarma-assd/testings/master/data/SBSBRIR00.json"
const _3D_PERSON_MODEL_ = "../models/gltf/LeePerrySmith/LeePerrySmith.glb";
const _3D_PERSON_TEXTURE_MAP = "../models/gltf/LeePerrySmith/Map-COL.jpg";
const _3D_PERSON_TEXTURE_SPECULAR_MAP = "../models/gltf/LeePerrySmith/Map-SPEC.jpg";
const _3D_PERSON_TEXTURE_NORMAL_MAP = "../models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg";

/************************/
/* Ejecución de rutinas */
/************************/
document.body.onload = async function onLoad() {
    await initAudioSystem();
    initVideoSystem();
    loop();
}

/*******************************************/
/* Variables para simulación de entorno 3D */
/***************************************** */ 
var scene, renderer, camera, dae, loader, controls, light, mesh, textureLoader;

/****************************************/
/* Variables de procesamiento de sonido */
/****************************************/
var reverberator = null;
var HRIRcontainer = null;
var BRIRcontainer = null;
var context = null;
var spatializer = null;
var source = null;
var playing = false;

/************************/
/* Callbacks de eventos */
/************************/

// onControlChange(event)
// Rutina de acción cuando el usuario mueve el control orbital de la cámara
// y se desplaza, debemos actualizar la posición de la fuente de sonido
// En este lugar ocurre el puente entre VideoSystem y AudioSystem.
function onControlChange(event) {
    // Buscamos posición de la camara
    let cameraPosition = event.target.object.position;
    let sphericalPosition = new THREE.Spherical();
    sphericalPosition.setFromVector3(cameraPosition);

    // Convertimos a las coordenadas esféricas convencionales
    let azimutal = sphericalPosition.theta * 90.0 / (Math.PI / 2);
    let elevation = ((Math.PI / 2) - sphericalPosition.phi) * 90.0 / (Math.PI / 2);
    let distance = sphericalPosition.radius / 500.0;

    // Actualizamos estado del proceso de audio
    if (spatializer.isAvailable()) {
        spatializer.setPosition(azimutal, elevation, distance);
    }
    if (playing === false) {
        playing = true;
        context.resume();
    }
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
    initAudioContext(48000.0);
    await initSoundSource(_WAV_URL_);
    await initImpulsiveResponse(_HRTF_URL_);
    await initRoomImpulsiveResponse(_BRIR_URL_);

    reverberator = new RoomReverberatorNode(context);
    reverberator.setBRIRContainer(BRIRcontainer);
    spatializer = new SpatialProcessorNode(context);
    spatializer.setHRIRContainer(HRIRcontainer);
    spatializer.setReverberator(reverberator);
    spatializer.connect(context.destination);
    source.connect(spatializer.input());
}

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
// @param url: Dirección de la fuente de sonido .wav
async function initSoundSource(url) {
    let wavResponse = await asyncGet(url);
    let wavBuffer = await wavResponse.arrayBuffer();
    source = new AudioBufferSourceNode(context);
    source.buffer = await context.decodeAudioData(wavBuffer);
    source.start();
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

// initRoomImpulsiveResponse()
// Inicialización de las respuesta impulsivas para reverberacion obtenidas de la base de datos
// para la construcción de los filtros FIR correspondientes
// @param url: Dirección para descargar las BRIR's
async function initRoomImpulsiveResponse(url) {
    let brirResponse = await asyncGet(url);
    let brirJson = await brirResponse.text();
    BRIRcontainer = SpatialIRContainer.FromJson(JSON.parse(brirJson));
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