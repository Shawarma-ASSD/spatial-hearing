export { asyncGet };

// asyncGet
// Devuelve el resultado de una petición http realizada de forma asincrónica
// @param url: Dirección url
async function asyncGet(url) {
    let response = await fetch(url);
    return response;
}