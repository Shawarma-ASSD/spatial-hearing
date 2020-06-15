export { SpatialProcessorNode, SchroederReverberatorNode, RoomReverberatorNode };

// SpatialNode
// Clase base para representar un nodo de procesamiento de audio espacial
// para Web Audio API, donde sus características son modificadas por la dirección
// o posición de la fuente de sonido.
// En todo SpatialNode, la transición de posición puede generar distorsiones en la salida
// por la discontinuidad del cambio de las características del nodo, se configura siempre
// , se use o no, un transitionTime para hacer crossfading.
class SpatialNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0, transition=0.03) {
        this.context = context;
        this.transitionTime = transition;
        this.azimutal = azimutal;
        this.elevation = elevation;
        this.distance = distance;
    }

    // setTransitionTime
    // Modifica el tiempo de transición para cambio de parámetros por posición.
    // @param transition: Tiempo de transición
    setTransitionTime(transition) {
        this.transitionTime = transition;
    }
    
    // setPosition
    // Configura la nueva posición de la posición de la fuente
    // @param azimutal: Azimutal de la nueva posición
    // @param elevation: Elevación de la nueva posición
    // @param distance: Distancia de la nueva posición
    setPosition(azimutal, elevation, distance) {
        this.azimutal = azimutal;
        this.elevation = elevation;
        this.distance = distance;
    }

    // disconnect
    // Desconecta la salida del nodo
    // @param node: Nodo del cual se desconecta la salida
    disconnect(node) {}

    // connect
    // Conecta la salida al nodo
    // @param node: Nodo al cual se conecta la salida
    connect(node) {}

    // input
    // Expone la entrada del nodo para conexiones,
    // se sobrecarga retornando el nodo inicial del sistema.
    input() {}

    // output
    // Expone la salida del nodo para conexiones
    // se sobrecarga retornando el nodo final del sistema.
    output() {}
}

// SpatialProcessorNode
// Representa el sistema procesador de sonido espacial, que se construye con la configuración
// deseada de HRIRs, y luego se puede tener control sobre la posición y la fuente de sonido utilizada.
class SpatialProcessorNode extends SpatialNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0) {
        super(context, azimutal, elevation, distance);
        this.container = null;

        // Cargando contexto y nodos del sistema procesador de sonido
        this.buffer = new GainNode(this.context);
        this.volume = new GainNode(this.context);
        this.gain = new GainNode(this.context);
        this.reverberator = null;

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
        this.volume.connect(this.gain);
        this.gain.connect(this.convolvers[0]);
        this.gain.connect(this.convolvers[1]);
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
        return this.volume;
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
                    this.reverberator?.setPosition(azimutal, elevation, distance);
                    this.gain.gain.value = 1 / Math.pow(distance, 2);
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

    // setReverberator
    // Configuramos la reverberación
    // @param reverberator: Reverberador a utilizar, debe ser un SpatialNode
    setReverberator(reverberator) {
        if (this.reverberator !== null) {
            this.faders[0].disconnect(this.reverberator.input());
            this.faders[1].disconnect(this.reverberator.input());
            this.reverberator.disconnect(this.buffer);
        }
        this.reverberator = reverberator;
        this.faders[0].connect(this.reverberator.input());
        this.faders[1].connect(this.reverberator.input());
        this.reverberator.connect(this.buffer);

    }

    // setVolume
    // Configuramos el volumen general de la fuente de sonido
    // @param value: Volumen general
    setVolume(value) {
        this.volume.gain.value = value;
    }
};

// SchroederReverberatorNode
// Reverberador mejorador de Schroeder
class SchroederReverberatorNode extends SpatialNode {
    constructor(context) {
        super(context);

        // Creando contexto y nodos
        this.bufferNode = new GainNode(this.context);
        this.inputGainNode = new GainNode(this.context);
        this.feedbackGainNode = new GainNode(this.context);
        this.loopGainNode = new GainNode(this.context);
        this.delayNode = new DelayNode(this.context);
        this.reverberators = [new AllPassReverberatorNode(this.context), new AllPassReverberatorNode(this.context)];

        // Conexión de nodos
        this.bufferNode.connect(this.inputGainNode);
        this.bufferNode.connect(this.delayNode);
        this.feedbackGainNode.connect(this.delayNode);
        this.delayNode.connect(this.reverberators[0].input());
        this.reverberators[0].connect(this.reverberators[1].input());
        this.reverberators[1].connect(this.feedbackGainNode);
        this.reverberators[1].connect(this.loopGainNode);
    }

    // setParameters
    // Configura los parametros del reverberador
    // @param dr: Relación de sonido directo a reverberación
    // @param delay: Retardo en segundos del reverberador
    setParameters(dr, delay) {
        let gain = Math.sqrt(dr / (1 + dr))
        this.inputGainNode.gain.value = -gain;
        this.feedbackGainNode.gain.value = gain;
        this.loopGainNode.gain.value = 1 - Math.pow(gain, 2);
        this.delayNode.delayTime.value = delay;
        this.reverberators[0].setParameters(gain, delay);
        this.reverberators[1].setParameters(gain, delay / 3);
    }

    // input
    // Expone la entrada del nodo para conexiones externas
    input() {
        return this.bufferNode;
    }

    // connect
    // Conecta la salida del SchroederReverberatorNode
    connect(node) {
        this.loopGainNode.connect(node);
        this.inputGainNode.connect(node);
    }

    // disconnect
    // Desconecta la salida del SchroederReverberatorNode
    disconnect(node) {
        this.loopGainNode.disconnect(node);
        this.inputGainNode.disconnect(node);
    }
}

// AllPassReverberatorNode
// Reverberador simple diseñado y propuesto por Schroeder
class AllPassReverberatorNode {
    constructor(audioContext) {
        // Creando el contexto y los nodos del sistema
        this.context = audioContext;
        this.bufferNode = new GainNode(this.context);
        this.inputGainNode = new GainNode(this.context);
        this.feedbackGainNode = new GainNode(this.context);
        this.loopGainNode = new GainNode(this.context);
        this.delayNode = new DelayNode(this.context);

        // Conexión de nodos
        this.bufferNode.connect(this.inputGainNode);
        this.bufferNode.connect(this.delayNode);
        this.feedbackGainNode.connect(this.delayNode);
        this.delayNode.connect(this.feedbackGainNode);
        this.delayNode.connect(this.loopGainNode);
    }

    // setParameters
    // Configura los parametros del reverberador
    // @param gain: Ganancia del reverberador
    // @param delay: Retardo en segundos del reverberador
    setParameters(gain, delay) {
        this.inputGainNode.gain.value = -gain;
        this.feedbackGainNode.gain.value = gain;
        this.loopGainNode.gain.value = 1 - Math.pow(gain, 2);
        this.delayNode.delayTime.value = delay;
    }

    // input
    // Expone la entrada del nodo para conexiones externas
    input() {
        return this.bufferNode;
    }

    // connect
    // Conecta la salida del AllPassReverberatorNode
    connect(node) {
        this.loopGainNode.connect(node);
        this.inputGainNode.connect(node);
    }

    // disconnect
    // Desconecta la salida del AllPassReverberatorNode
    disconnect(node) {
        this.loopGainNode.disconnect(node);
        this.inputGainNode.disconnect(node);
    }
};


// RoomReverberatorNode
// Reverberador con BRIRs
class RoomReverberatorNode extends SpatialNode {
    constructor(context) {
        super(context);
        this.container = null;

        // Cargando contexto y nodos del sistema procesador de sonido
        this.bufferIn = new GainNode(this.context);

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
        this.bufferIn.connect(this.convolvers[0]);
        this.bufferIn.connect(this.convolvers[1]);
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