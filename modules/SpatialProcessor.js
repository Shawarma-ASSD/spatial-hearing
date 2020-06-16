import { SpatialNode } from "./SpatialNode.js";
import { SpatialConvolverNode } from "./SpatialConvolverNode.js";

// SpatialProcessorNode
// Representa el sistema procesador de sonido espacial, que se construye con la configuración
// deseada de HRIRs, y luego se puede tener control sobre la posición y la fuente de sonido utilizada.
export class SpatialProcessorNode extends SpatialNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0) {
        super(context, azimutal, elevation, distance);
    
        // Cargando contexto y nodos del sistema procesador de sonido
        this.buffer = new GainNode(this.context);
        this.gain = new GainNode(this.context);
        this.convolver = new SpatialConvolverNode(this.context, azimutal, elevation, distance);
        this.reverberator = null;

        // Conexión de nodos
        this.gain.connect(this.convolver.input());
    }

    // connect
    // Conecta la salida del SpatialProcessorNode
    connect(node) {
        this.buffer.connect(node);
    }

    // disconnect
    // Desconecta la salida del SpatialProcessorNode
    disconnect(node) {
        this.buffer.disconnect(node);
    }

    // input
    // Expone la entrada del nodo procesador de sonido espacial
    input() {
        return this.gain;
    }

    // output
    // Expone la salida del nodo procesador de sonido espacial
    output() {
        return this.buffer;
    }

    // setHRIRContainer
    // Configura el container que caracteriza las repuesta HRTF usadas
    // @param container: Contenedor actual
    setHRIRContainer(container) {
        this.convolver.setSpatialIRContainer(container);
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
            this.reverberator?.setPosition(azimutal, elevation, distance);
            this.convolver.setPosition(azimutal, elevation, distance);
            this.buffer.gain.value = 1 / Math.pow(distance, 2);
            return true;
        }
        return false;
    }

    // setReverberator
    // Configuramos la reverberación
    // @param reverberator: Reverberador a utilizar, debe ser un SpatialNode
    setReverberator(reverberator) {
        if (this.reverberator !== null) {
            this.convolver.disconnect(this.reverberator.input());
            this.reverberator.disconnect(this.buffer);
        }
        this.reverberator = reverberator;
        this.convolver.connect(this.reverberator.input());
        this.reverberator.connect(this.buffer);

    }
};