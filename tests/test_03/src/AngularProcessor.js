import { SpatialNode } from "../../../modules/SpatialNode.js"

// AngularProcessorNode
// Representa el sistema procesador de sonido espacial, que se construye con la configuración
// deseada de HRIRs, sin control sobre la distancia.
export class AngularProcessorNode extends SpatialNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0) {
        super(context, azimutal, elevation, distance);
        this.container = null;

        // Cargando contexto y nodos del sistema procesador de sonido
        this.volume = new GainNode(this.context);

        // Control de cross fading entre HRIRs al alternar posiciones
        this.currentTime = null;
        this.currentConvolver = 0;
        this.faders = [
            new GainNode(this.context, {gain: 1.0}),
            new GainNode(this.context, {gain: 0.0})
        ];
        this.convolvers = [
            new ConvolverNode(this.context),
            new ConvolverNode(this.context)
        ];

        // Conexión de nodos
        this.volume.connect(this.convolvers[0]);
        this.volume.connect(this.convolvers[1]);
        this.convolvers[0].connect(this.faders[0]);
        this.convolvers[1].connect(this.faders[1]);
    }

    // isAvailable
    // Devuelve si está disponible el espacializador para modificar la posición,
    // en caso de no estarlo, no se puede modificar la posición, esto se usa para
    // las transiciones.
    isAvailable() {
        if (this.targetTime === null) {
            return true;
        } else {
            return this.context.currentTime >= this.currentTime;
        }
    }

    // connect
    // Conecta la salida del SpatialProcessorNode
    connect(node) {
        this.faders[0].connect(node);
        this.faders[1].connect(node);
    }
    
    // disconnect
    // Desconecta la salida del SpatialProcessorNode
    disconnect(node) {
        this.faders[0].disconnect(node);
        this.faders[1].disconnect(node);
    }

    // input
    // Expone la entrada del nodo procesador de sonido espacial
    input() {
        return this.volume;
    }

    // setHRIRContainer
    // Configura el container que caracteriza las repuesta HRTF usadas
    // @param container: Contenedor actual
    setHRIRContainer(container) {
        this.container = container;

        // Cuando se cambia la HRIR, actualizamos la posición con la nueva HRIR!
        this.setPosition(this.azimutal, this.elevation, this.distance);
    }

    // setPosition
    // Configura una nueva posición donde debe ubicarse al sonido,
    // devuelve el resultado si se pudo o no cambiar la posición.
    // @param azimutal: Azimutal de la nueva posición
    // @param elevation: Elevación de la nueva posición
    // @param distance: Distancia de la nueva posición
    setPosition(azimutal, elevation, distance) {
        super.setPosition(azimutal, elevation, distance);
        if (azimutal !== null && elevation !== null && distance !== null) {
            if (this.container !== null){
                if (this.isAvailable()) {
                    this.currentTime = this.context.currentTime + this.transitionTime;
                    this.faders[this.currentConvolver].gain.setValueAtTime(0.0, this.currentTime);
                    this.currentConvolver = this.currentConvolver == 0 ? 1 : 0;
                    this.convolvers[this.currentConvolver].buffer = this.container.closestBuffer(azimutal, elevation, distance);
                    this.faders[this.currentConvolver].gain.setValueAtTime(1.0, this.currentTime);
                    return true;
                }
            }
        }
        return false;
    }

    // setVolume
    // Configuramos el volumen general de la fuente de sonido
    // @param value: Volumen general
    setVolume(value) {
        this.volume.gain.value = value;
    }

    // Texto a mostrar con la posicion actual de la HRTF
    getPositionText() {
        let ret = "";
        if (this.container) {
            ret = "Azimuth: " + this.azimutal;
            ret += " Elevation: " + this.elevation;
            ret += " Radius: " + this.distance;
        }
        return ret;
    }

    getImpulseResponses() {
        return this.container.closestBuffer(this.azimutal, this.elevation, this.distance);
    }
    
};