export { SpatialIRContainer };

const SIMPLE_FREE_FIELD_HRIR = "SimpleFreeFieldHRIR";
const MULTI_SPEAKER_BRIR = "MultiSpeakerBRIR";

// toRadians
// Ejecuta la compleja tarea de convertir un ángulo
// que se encuentra en el dominio de los grados al
// dominio radian. o_O
function toRadians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}

// toCartesian
// Calcula las coordenadas cartesianas de la ubicación en coordenadas esféricas
// @param azimutal: Ángulo azimutal
// @param elevation: Ángulo de elevación
// @param distance: Distancia
function toCartesian(azimutal, elevation, distance) {
    return [
        distance * Math.cos(toRadians(elevation)) * Math.cos(toRadians(azimutal)),
        distance * Math.cos(toRadians(elevation)) * Math.sin(toRadians(azimutal)),
        distance * Math.sin(toRadians(elevation))
    ]
}

// SpatialIRContainer
// Clase genérica que contiene respuestas impulsivas para procesamiento espacializado,
// cada respuesta impulsiva está vinculada a una posición del espacio. Se conocen
// el orden de la respuesta, la frecuencia de muestreo, las posiciones y sus respuestas 
// ligadas. Las respuestas impulsivas son binaurales, o sea, estéreo.
class SpatialIRContainer {

    // FromJson
    // Factory para construir un SpatialIRContainer a partir de un json obtenido
    // mediante las peticiones pertinentes.
    static FromJson(json) {
        return new SpatialIRContainer(
            json.sampleRate,
            json.dimensions[2],
            json.positions,
            json.impulseResponses
        );
    }

    // SpatialIRContainer constructor
    // @param rate: Frecuencia de muestreo
    // @param size: Tamaño de las respuestas impulsivas
    // @param positions: Arreglo de posiciones vinculadas a las respuestas impulsivas
    // @param impulseResponses: Arreglo de respuestas impulsivas vinculadas a las posiciones
    constructor(rate=null, size=null, positions=null, impulseResponses=null) {
        this.rate = rate;
        this.size = size;
        this.positions = [];
        this.impulseResponses = [];
        this.impulseResponsesBuffers = [];

        if (rate !== null && size !== null && positions !== null && impulseResponses !== null) {
            this.load(rate, size, positions, impulseResponses);
        }
    }

    // addPosition
    // Agrega una nueva posición, sumando la ubicación y las respuestas impulsivas binaurales
    // correspondientes a dicha posición. 
    // ALERTA: ¡Es necesario haber configurado antes rate, size!
    // @param position: Arreglo de posiciones vinculadas a las respuestas impulsivas
    // @param impulseResponse: Arreglo de respuestas impulsivas vinculadas a las posiciones
    addPosition(position, impulseResponse) {
        this.positions.push(position);
        this.impulseResponses.push(impulseResponse);
        let currLeft = new Float32Array(impulseResponse[0]);
        let currRight = new Float32Array(impulseResponse[1]);
        let buffer = new AudioBuffer(
            {
                sampleRate: this.rate,
                numberOfChannels: 2,
                length: this.size * 2
            }
        );
        buffer.copyToChannel(currLeft, 0);
        buffer.copyToChannel(currRight, 1);
        this.impulseResponsesBuffers.push(buffer);
    }

    // setParameters
    // Configura parcialmente el SpatialIRContainer, cargando frecuencia de muestreo
    // y el tamaño de las respuestas impulsivas.
    // @param rate: Frecuencia de muestreo
    // @param size: Tamaño de las respuestas impulsivas
    setParameters(rate, size) {
        this.rate = rate;
        this.size = size;
    }

    // load
    // Carga las configuraciones del container, se supone que debe
    // ser llamada una única vez, para su construcción.
    // @param rate: Frecuencia de muestreo
    // @param size: Tamaño de las respuestas impulsivas
    // @param positions: Arreglo de posiciones vinculadas a las respuestas impulsivas
    // @param impulseResponses: Arreglo de respuestas impulsivas vinculadas a las posiciones
    load(rate, size, positions, impulseResponses) {
        this.rate = rate;
        this.size = size;
        this.positions = positions;
        this.impulseResponses = impulseResponses;
        this.impulseResponsesBuffers = [];
        for (let i = 0 ; i < this.impulseResponses.length ; i++) {
            let currLeft = new Float32Array(this.impulseResponses[i][0]);
            let currRight = new Float32Array(this.impulseResponses[i][1]);
            let buffer = new AudioBuffer(
                {
                    sampleRate: this.rate,
                    numberOfChannels: 2,
                    length: this.size * 2
                }
            );
            buffer.copyToChannel(currLeft, 0);
            buffer.copyToChannel(currRight, 1);
            this.impulseResponsesBuffers.push(buffer);
        }
    }

    // closest
    // Devuelve el índice de la posición registrada en el contenedor de HRIRs
    // que se encuentra más próximo a la posición pasada como parámetros.
    // @param azimutal: Azimutal deseado
    // @param elevation: Elevación deseada
    // @param distance: Distancia deseada
    closest(azimutal, elevation, distance) {
        let target = toCartesian(azimutal, elevation, distance);
        let targetPosition = null;
        let minDelta = null;
        for (let i = 0 ; i < this.positions.length ; i++) {
            let source = this.positions[i];
            let current = toCartesian(source[0], source[1], source[2]);
            let currDelta = Math.sqrt(
                Math.pow(current[0] - target[0], 2) 
                + Math.pow(current[1] - target[1], 2) 
                + Math.pow(current[2] - target[2], 2)
                );
            if (minDelta === null || minDelta > currDelta) {
                minDelta = currDelta;
                targetPosition = i;
            }
        }
        return targetPosition;
    }

    // closestPosition
    // Devuelve la posición más cercana a la posición 3D
    // @param azimutal: Azimutal deseado
    // @param elevation: Elevación deseada
    // @param distance: Distancia deseada
    closestPosition(azimutal, elevation, distance) {
        return this.positions[this.closest(azimutal, elevation, distance)];
    }

    // closestBuffer
    // Devuelve el audio buffer de la respuesta impulsiva más cercana a la posición 3D
    // @param azimutal: Azimutal deseado
    // @param elevation: Elevación deseada
    // @param distance: Distancia deseada
    closestBuffer(azimutal, elevation, distance) {
        return this.impulseResponsesBuffers[this.closest(azimutal, elevation, distance)];
    }
};