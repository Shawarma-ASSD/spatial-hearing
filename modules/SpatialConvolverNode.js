import { SpatialNode } from "./SpatialNode.js";

// SpatialConvolverNode
// Representa un convolucionador de dos canales para espacialziación, cambiando
// dinámicamente acorde a la posición la respuesta impulsiva y aplicando un cross-fading.
export class SpatialConvolverNode extends SpatialNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0) {
        super(context, azimutal, elevation, distance, 0.1);
        this.container = null;
        this.currentTime = null;
        this.currentConvolver = 0;
        
        this.inputBuffer = new GainNode(this.context);
        this.outputBuffer = new GainNode(this.context);
        this.faders = [
            new GainNode(this.context, {gain: 1.0}),
            new GainNode(this.context, {gain: 0.01})
        ];
        this.convolvers = [
            new ConvolverNode(this.context),
            new ConvolverNode(this.context)
        ];

        this.inputBuffer.connect(this.convolvers[0]);
        this.inputBuffer.connect(this.convolvers[1]);
        this.convolvers[0].connect(this.faders[0]);
        this.convolvers[1].connect(this.faders[1]);
        this.faders[0].connect(this.outputBuffer);
        this.faders[1].connect(this.outputBuffer);
    }

    // isAvailable
    // Devuelve si está disponible el espacializador para modificar la posición,
    // en caso de no estarlo, no se puede modificar la posición, esto se usa para
    // las transiciones.
    isAvailable() {
        if (this.currentTime === null) {
            return true;
        } else {
            return this.context.currentTime >= this.currentTime;
        }
    }

    // connect
    // Conecta la salida del SpatialProcessorNode
    connect(node) {
        this.outputBuffer.connect(node);
    }

    // disconnect
    // Desconecta la salida del SpatialProcessorNode
    disconnect(node) {
        this.outputBuffer.disconnect(node);
    }

    // input
    // Expone la entrada del nodo procesador de sonido espacial
    input() {
        return this.inputBuffer;
    }

    // output
    // Expone la salida del nodo procesador de sonido espacial
    output() {
        return this.outputBuffer;
    }

    // setSpatialIRContainer
    // Configura el container de respuestas impulsivas a cada posición
    // @param container: Contenedor actual
    setSpatialIRContainer(container) {
        this.container = container;
        this.convolvers[this.currentConvolver].buffer = this.container.closestBuffer(this.azimutal, this.elevation, this.distance);
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
                    this.faders[this.currentConvolver].gain.linearRampToValueAtTime(0.01, this.currentTime);
                    this.currentConvolver = this.currentConvolver == 0 ? 1 : 0;
                    this.convolvers[this.currentConvolver].buffer = this.container.closestBuffer(azimutal, elevation, distance);
                    this.faders[this.currentConvolver].gain.linearRampToValueAtTime(0.99, this.currentTime);
                    return true;
                }
            }
        }
        return false;
    }
};