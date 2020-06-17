import {RoomReverberatorNode} from '../../../modules/RoomReverberator.js'

//SuperReverberator
//like a reverberator but better
export class SuperReverberatorNode extends RoomReverberatorNode {
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
        this.outputBuffer.gain.value = 1 / Math.pow(distance, 2);
        return super.setPosition(-azimutal, elevation, distance);

    }
};