/* 
    HRTFManager: Maneja el procesamiento del sonido 3D
        Crea un convolverNode de WebAudio de 2 canales, el cual se puede conectar al
        resto del grafo y espacializar el sonido
*/
class HRTFManager {
    constructor() {

        // Devuelve el convolverNode de WebAudio de 2 canales para espacializar el sonido
        this.getConvolverNode = function () {
            return this.convolver;
        };

        /*  Recibe la HRTF en un JSON con los siguientes campos:
            {
                "dimensions": [Measurements, Receptors, Samples per measurement]
                "sampleRate": Measurements sample rate
                "positions": [ [Azimuth, Elevation, Distance], ..., more positions -> ],
                "impulseResponses": [ [[Left HRIR samples], [Right HRIR samples]], ..., more hrirs -> ]
            }
        */
        this.loadHRTF = function (jsonData) {
            this.hrtf = JSON.parse(jsonData);
            // Coordenadas por defecto de la HRTF
            this.coords = { radius: 1.47, elevation: 0, azimuth: 270, index: 0 };
            this.updateFilter();
        };

        /*  Control de coordenadas:
                Los setters actualizan las coordenadas de la HRTF y cambian la respuesta impulsiva del convolverNode
                Los getters devuelven el valor actual de la coordenada solicitada
        */
        this.setAzimuth = function (azimuth) {
            this.coords.azimuth = azimuth;
            this.updateFilter();
        };

        this.getAzimuth = function () {
            return this.coords.azimuth;
        };

        this.setElevation = function (elevation) {
            this.coords.elevation = elevation;
            this.updateFilter();
        };

        this.getElevation = function () {
            return this.coords.elevation;
        };

        this.setRadius = function (r) {
            this.coords.radius = r;
            this.updateFilter();
        };

        this.getRadius = function () {
            return this.coords.radius;
        };

        // Texto a mostrar con las dimensiones de la HRTF
        this.getHRTFDimensionsText = function () {
            let ret = "";
            if (this.hrtf) {
                let dim = this.hrtf["dimensions"];
                ret = "Measurements: " + dim[0] + " Receivers: " + dim[1] + " Sample count: " + dim[2];
            }
            return ret;
        };

        // Texto a mostrar con la posicion actual de la HRTF
        this.getPositionText = function () {
            let ret = "";
            if (this.hrtf) {
                let i = this.coords.index;
                let coords = this.hrtf["positions"][i];
                ret = "Azimuth: " + coords[0];
                ret += " Elevation: " + coords[1];
                ret += " Radius: " + coords[2];
            }
            return ret;
        };


        // Creamos el nodo que convoluciona las señales de cada oído, una por canal
        this.convolver = audioContext.createConvolver();

        // Preparamos el handle para cuando carguen una HRTF
        this.hrtf = null;

        // Pasa del sistema de coordenadas de la HRTF a coordenadas esfericas estandar en radianes
        this.getSphericalRadians = function (coords) {
            //       radio ==,     theta en radianes,                phi se toma desde el eje Z y en radianes
            return { r: coords[2], theta: coords[0] * Math.PI / 180, phi: (90 - coords[1]) * Math.PI / 180 };
        };

        // Calcula la distancia entre dos puntos en coordenadas esfericas segun:
        // https://math.stackexchange.com/questions/833002/distance-between-two-points-in-spherical-coordinates
        this.sphericalDist = function (coords1, coords2) {
            let dist = 0, aux = 0, arg = 0;
            aux = Math.cos(coords1.theta) * Math.cos(coords2.theta);
            aux += Math.sin(coords1.theta) * Math.sin(coords2.theta) * Math.cos(coords1.phi - coords2.phi);
            arg = coords1.r ** 2 + coords2.r ** 2 - 2 * coords1.r * coords2.r * aux;
            dist = Math.sqrt(arg);
            return dist;
        };

        // Devuelve el indice de la HRIR mas cercana a la posicion solicitada
        this.getClosestIndex = function () {
            let ret = 0, minDist = 1e6, N = this.hrtf["dimensions"][0], dist = 0;
            let myCoords = this.getSphericalRadians([this.coords.azimuth, this.coords.elevation, this.coords.radius]);
            let coords, radCoords; // coordenadas del elemento que se está iterando, en grados y en radianes

            for (var i = 0; i < N; i++) {
                // Obtenemos las coordenadas de la HRIR actual
                coords = this.hrtf["positions"][i];
                // Pasamos a radianes
                radCoords = this.getSphericalRadians(coords);
                // Calculamos la distancia entre los puntos
                dist = this.sphericalDist(myCoords, radCoords);
                // Si es la minima distancia hasta ahora, la guardamos y guardamos el indice
                if (dist < minDist) {
                    minDist = dist;
                    ret = i;
                }
            }
            return ret;
        };

        // Si hay un archivo cargado, busca con la HRTF solicitada actualmente, sino carga deltas en las convoluciones
        this.updateFilter = function () {
            if (this.hrtf) {

                // Nos aseguramos de que coincidan las frecuencias de muestreo
                if (this.hrtf.sampleRate != audioContext.sampleRate) {
                    audioContext = new AudioContext({
                        sampleRate: this.hrtf.sampleRate
                    });
                    // Cambiamos el audioContext asi que hay que crear todo de nuevo
                    this.convolver = audioContext.createConvolver();
                    connectGraph();
                }

                // Obtenemos el indice de la HRTF mas cercana
                this.coords.index = this.getClosestIndex();

                // Cargamos las respuestas impulsivas de cada oido
                let leftFilter = this.hrtf["impulseResponses"][this.coords.index][0];
                let rightFilter = this.hrtf["impulseResponses"][this.coords.index][1];

                // Creamos el buffer de 2 canales que vamos a cargar con los coeficientes de cada respuesta impulsiva
                let len = Math.max(leftFilter.length, rightFilter.length);
                let convBuffer = audioContext.createBuffer(2, len, this.hrtf.sampleRate);
                var rightBuffer = convBuffer.getChannelData(1);
                var leftBuffer = convBuffer.getChannelData(0);

                // Cargamos los coeficientes en cada canal
                for (var i = 0; i < len; i++) {
                    rightBuffer[i] = rightFilter[i];
                    leftBuffer[i] = leftFilter[i];
                }

                // Voila
                this.convolver.buffer = convBuffer;
            }
            else {
                // Inicializamos las convoluciones con deltas para que no modifiquen nada hasta no tener un filtro
                let convBuffer = audioContext.createBuffer(2, 256, audioContext.sampleRate);
                convBuffer.getChannelData(0)[0] = 1;
                convBuffer.getChannelData(1)[0] = 1;
                this.convolver.buffer = convBuffer;
            }

            this.getFilters = function () {
                let leftFilter = null, rightFilter = null;
                if (this.hrtf) {
                    leftFilter = this.hrtf["impulseResponses"][this.coords.index][0];
                    rightFilter = this.hrtf["impulseResponses"][this.coords.index][1];
                }
                return [leftFilter, rightFilter];
            };

        };

        this.HRTFReady = function() {
            return Boolean(this.hrtf);
        }

        // Inicializamos el nodo convolucionador con deltas
        this.updateFilter();

        // Coordenadas por defecto de la HRTF
        this.coords = { radius: 1.47, elevation: 0, azimuth: 270, index: 0 };

    }
}




class Plotter {
    constructor(name) {

        // https://github.com/dhuertas/graph.js/tree/master 
        this.plot = function (graphs) {
            this.HRIRgraph.clear(this.graphOptions);
            for (var i = 0; i < graphs.length; i++) {
                var time = [], y = [];
                if (graphs[i]) {
                    for (var t = 0; t < graphs[i].length; t++) {
                        time.push(t);
                        y.push(graphs[i][t]);
                    }

                    this.HRIRgraph.plot(y, time);
                }
            }
        };

        // Configuracion de la libreria para graficar
        this.graphOptions = {
            appendTo: name,
            canvasWidth: 800,
            canvasHeight: 800 / Math.sqrt(2),
            title: "Respuesta impulsiva de cada oído",
            xAxisTitle: "t [samples]",
            yAxisTitle: "Amplitud"
        };

        // Creamos el grafico de la HRIR
        this.HRIRgraph = new Graph(this.graphOptions);
    }
}
