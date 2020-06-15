export { RoomReverberatorNode };

// RoomReverberatorNode
// Reverberador con BRIRs
class RoomReverberatorNode extends SpatialNode {
    constructor(context) {
        super(context);
        this.container = null;

        // Cargando contexto y nodos del sistema procesador de sonido
        this.bufferIn = new GainNode(this.context);
        this.bufferOut = new GainNode(this.context);

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
        this.convolvers[0].connect(this.faders[0]);
        this.convolvers[1].connect(this.faders[1]);
    }

    // isAvailable
    // Devuelve si está disponible el reverberador para modificar la posición,
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
        this.bufferOut.connect(node);
    }

    // disconnect
    // Desconecta la salida del SpatialProcessorNode
    disconnect(node) {
        this.bufferOut.disconnect(node);
    }

    // input
    // Expone la entrada del nodo procesador de reverberacion espacial
    input() {
        return this.bufferIn;
    }

    // setBRIRContainer
    // Configura el container que caracteriza las repuesta BRIR usadas
    //@param container: Contenedor actual
    setBRIRContainer(container) {
        this.container = container;
    }

    // setPosition
    // Configura una nueva posición donde debe ubicarse al sonido,
    // devuelve el resultado si se pudo o no cambiar la posición.
    // @param azimutal: Azimutal de la nueva posición
    // @param elevation: Elevación de la nueva posición
    // @param distance: Distancia de la nueva posición
    setPosition(azimutal, elevation, distance) {
        if (this.container !== null){
            if (this.isAvailable()) {
                this.currentTime = this.context.currentTime + this.transitionTime;
                this.faders[this.currentConvolver].gain.setValueAtTime(0.0, this.currentTime);
                this.currentConvolver = this.currentConvolver == 0 ? 1 : 0;
                this.convolvers[this.currentConvolver].buffer = this.container.closestBuffer(-azimutal, elevation, distance);
                this.faders[this.currentConvolver].gain.setValueAtTime(1.0, this.currentTime);
                return true;
            }
        }
        return false;
    }
};