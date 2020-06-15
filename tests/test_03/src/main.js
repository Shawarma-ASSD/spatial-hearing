function httpGetAsync(url, callback, responseType)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            callback(xmlHttp.response);
        }
    }
    if(responseType) {
        xmlHttp.responseType = responseType;
    }
    xmlHttp.open("GET", url, true); // true for asynchronous 
    xmlHttp.send(null);
}

function callbackHRTF(responseText) {
    hrtfManager.loadHRTF(responseText);
    document.getElementById("dimensionsText").textContent = hrtfManager.getHRTFDimensionsText();
    updateHRTFInfo();
}

function callbackWav(buffer) {
    audioContext.decodeAudioData(buffer, function(buffer) {
        userSoundBuffer = audioContext.createBuffer(2, buffer.length, audioContext.sampleRate);
        userSoundBuffer = buffer;    
    });
}

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


// Creo el contexto de Web Audio API que contiene mi grafo de procesamiento de sonido
audioContext = new AudioContext({
    sampleRate: 44100
});

// Creo un FileReader para controlar la carga de los archivos de sonido
// utilizando las Promises de forma asincrónica
const fileReader = new FileReader();


// Agreguemos una entrada proveniente de un buffer de memoria, que sera cargado con la muestra de algún .WAV del usuario
let userSoundBuffer = null;
let userSound = null;
// hacemos pasos de 0.1 sec
let step = 0;
let startTime = null;



// Creamos el objeto que va a hacer el manejo del procesamiento 3D
var hrtfManager = new HRTFManager();
let plotter = new Plotter('plot');
updateHRTFInfo();
setHRTFvalues();

// Agreguemos un poco de control de volumen con un nodo de ganancia!
gain = null;

// Realizo las conexiones del sistema de procesamiento
let hrirConvolver = null;
connectGraph();

// Variables para la animacion
let timeout = null;
let animating = false;

// Una vez que esta todo inicializado, solictamos los archivos de la HRTF y el sonido WAV
httpGetAsync("https://shawarma-assd.github.io/resources/hrir/HRIR1HUTUBS.json", callbackHRTF, null);
httpGetAsync('https://shawarma-assd.github.io/resources/samples/mixfinal.wav', callbackWav, 'arraybuffer');

function connectGraph() {
    gain = new GainNode(audioContext,
        {
            gain: 1
        }
    );
    hrirConvolver = hrtfManager.getConvolverNode();
    hrirConvolver.connect(gain);
    gain.connect(audioContext.destination);
    initUserSound();
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
};

function onStopButton(event) {
    audioContext.suspend();
    pauseAnimation();
};

// Agrego un controlador del volumen, que modifica de forma abrupta
// el volumen que controla la amplitud de las muestras de sonido
function onVolumeChange(currentVolume) {
    document.getElementById("volumeText").textContent = currentVolume;
    gain.gain.value = currentVolume / 100;
};

// Controladores de las coordenadas de la HRTF
function onAzimuthChange(currentAzimuth) {
    hrtfManager.setAzimuth(currentAzimuth);
    updateHRTFInfo();
};

function onElevationChange(currentElevation) {
    hrtfManager.setElevation(currentElevation);
    updateHRTFInfo();
};

function onRadiusChange(currentRadius) {
    hrtfManager.setRadius(Number(currentRadius));
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

function initUserSound() {
    let ret = false;
    if(userSoundBuffer) {
        if(userSound) {
            userSound.stop();
        }
        userSound = new myAudioBufferNode(audioContext,
            {
                loop: false
            }
        );

        userSound.connect(hrirConvolver); 
        userSound.setBuffer(userSoundBuffer);
        ret = true;
    }
    return ret;
}

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
    if(initUserSound() && hrtfManager.HRTFReady()) {
        userSound.start();
        hrtfManager.setAzimuth(0);
        hrtfManager.setElevation(0);
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
        initUserSound();
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
        hrtfManager.setAzimuth( hrtfManager.getAzimuth() + step*90/1000 );
    }
    // de la izquierda a la derecha en 1 sec
    else if ((elapsed >= 4) && (elapsed <= 5)) {
        hrtfManager.setAzimuth(hrtfManager.getAzimuth() - step*180/1000);    
    }
    // muevo de la derecha a la izquierda por 2 sec
    else if ((elapsed >= 6) && (elapsed < 8)) {
        hrtfManager.setAzimuth( hrtfManager.getAzimuth() + step*90/1000 );
    }
    // de la izquierda a la derecha en 1 sec
    else if ((elapsed >= 8) && (elapsed <= 9)) {
        hrtfManager.setAzimuth(hrtfManager.getAzimuth() - step*180/1000);
    }
    // del medio para abajo en 1 sec
    else if ((elapsed >= 11) && (elapsed <= 12)) {
        hrtfManager.setElevation(hrtfManager.getElevation() - step*70/1000);        
    }
    // de derecha a izquierda todo por abajo
    else if ((elapsed >= 14) && (elapsed <= 15)) {
        hrtfManager.setAzimuth(hrtfManager.getAzimuth() - step*180/1000);
    }
    // sube
    else if ((elapsed >= 18.5) && (elapsed <= 20)) {
        hrtfManager.setElevation(hrtfManager.getElevation() + step*140/1.5/1000); 
    }
    // baja
    else if ((elapsed >= 21-1.1*step/1000) && (elapsed <= 21)) {
        hrtfManager.setElevation(-70); 
    }
    // sube
    else if ((elapsed >= 21) && (elapsed <= 22)) {
        hrtfManager.setElevation(hrtfManager.getElevation() + step*140/1000); 
    }
    // baja
    else if ((elapsed >= 23-1.1*step/1000) && (elapsed <= 23)) {
        hrtfManager.setElevation(-70); 
    }
    // sube
    else if ((elapsed >= 23.5) && (elapsed <= 24.5)) {
        hrtfManager.setElevation(hrtfManager.getElevation() + step*140/1000); 
    }
    // baja
    else if ((elapsed >= 25.5-1.1*step/1000) && (elapsed <= 25.5)) {
        hrtfManager.setElevation(-70); 
    }
    // sube
    else if ((elapsed >= 27-1.1*step/1000) && (elapsed <= 27)) {
        hrtfManager.setElevation(70); 
    }
    // baja
    else if ((elapsed >= 28-1.1*step/1000) && (elapsed <= 28)) {
        hrtfManager.setElevation(-70); 
    }
    // sube
    else if ((elapsed >= 29-1.1*step/1000) && (elapsed <= 29)) {
        hrtfManager.setElevation(70); 
    }
}

function updateHRTFInfo() {
    document.getElementById("azimuthText").textContent = hrtfManager.getAzimuth();
    document.getElementById("elevationText").textContent = hrtfManager.getElevation();    
    document.getElementById("radiusText").textContent = hrtfManager.getRadius();
    document.getElementById("positionText").textContent = hrtfManager.getPositionText();
    plotter.plot(hrtfManager.getFilters());
}

function setHRTFvalues() {
    document.getElementById("azimuth").value = hrtfManager.getAzimuth();
    document.getElementById("elevation").value = hrtfManager.getElevation();    
    document.getElementById("radius").value = hrtfManager.getRadius();
}

function disableSliders() {
    document.getElementById("azimuth").disabled = true;
    document.getElementById("elevation").disabled = true;    
    document.getElementById("radius").disabled = true;
}

function enableSliders() {
    document.getElementById("azimuth").disabled = false;
    document.getElementById("elevation").disabled = false;    
    document.getElementById("radius").disabled = false;
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
                }
            );
        };
        fileReader.readAsArrayBuffer(file);
    }
    else {
        alert('Se debe ingresar un archivo WAV!');
    }
};