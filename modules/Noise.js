class BrowneNoiseProcessor extends AudioWorkletProcessor {
    
    // BrowneNoiseNode()
    // Clase estática para la construcción de los nodos procesadores
    // de ruido.
    static BrowneNoiseNode(context) {
        if (BrowneNoiseProcessor.added == false) {
            BrowneNoiseProcessor.added = true;
        }
    }
    
    process (inputs, outputs, parameters) {
        const output = outputs[0];
        var lastOut = 0.0;
        output.forEach(channel => {
            for (let i = 0 ; i < channel.length ; i++) {
                var white = Math.random() * 2 - 1;
                channel[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = channel[i];
                channel[i] *= 3.5;
            }
        });
        return true;
    }
}

/***************************************/
/* Registrando procesadores personales */
/***************************************/
registerProcessor('browne-noise-processor', BrowneNoiseProcessor);

/*****************************************************/
/* Inicializo miembro estático para registrar modulo */
/*****************************************************/
BrowneNoiseProcessor.added = false;