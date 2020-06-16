import { SpatialNode } from "./SpatialNode.js";

// SchroederReverberatorNode
// Reverberador mejorador de Schroeder
export class SchroederReverberatorNode extends SpatialNode {
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