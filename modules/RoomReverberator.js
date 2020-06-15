import { SpatialNode } from "./SpatialNode.js";
import { SpatialConvolverNode } from "./SpatialConvolverNode.js";

// RoomReverberatorNode
// Nodo de WebAudio API para representar la reverberación de un espacio
// utilizando respuestas impulsivas binaurales distintivas de un ambiente.
export class RoomReverberatorNode extends SpatialConvolverNode {
    constructor(context, azimutal=0.0, elevation=0.0, distance=1.0) {
        super(context, azimutal, elevation, distance);
    }

    // setPosition
    // Configura una nueva posición donde debe ubicarse al sonido,
    // devuelve el resultado si se pudo o no cambiar la posición.
    // @param azimutal: Azimutal de la nueva posición
    // @param elevation: Elevación de la nueva posición
    // @param distance: Distancia de la nueva posición
    setPosition(azimutal, elevation, distance) {
        return super.setPosition(-azimutal, elevation, distance);
    }
};