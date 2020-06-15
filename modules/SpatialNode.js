// SpatialNode
// Clase base para representar un nodo de procesamiento de audio espacial
// para Web Audio API, donde sus características son modificadas por la dirección
// o posición de la fuente de sonido.
// En todo SpatialNode, la transición de posición puede generar distorsiones en la salida
// por la discontinuidad del cambio de las características del nodo, se configura siempre
// , se use o no, un transitionTime para hacer crossfading.
export class SpatialNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0, transition=0.05) {
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