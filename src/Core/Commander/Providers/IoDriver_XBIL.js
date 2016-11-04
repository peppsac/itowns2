/**
 * Generated On: 2015-10-5
 * Class: IoDriver_XBIL
 */
/* global Float32Array*/

import IoDriver from 'Core/Commander/Providers/IoDriver';


var portableXBIL = function(buffer) {
    this.floatArray = new Float32Array(buffer);
    this.max = undefined;
    this.min = undefined;
    this.texture = null;
};


function IoDriver_XBIL() {
    //Constructor
    IoDriver.call(this);

}

IoDriver_XBIL.prototype = Object.create(IoDriver.prototype);

IoDriver_XBIL.prototype.constructor = IoDriver_XBIL;

IoDriver_XBIL.prototype.computeMinMaxElevation = function(buffer, width, height, pitScale) {
    let min = 1000000;
    let max = -1000000;

    let sizeX = pitScale ? Math.floor(pitScale.z * width) : buffer.length;
    let sizeY = pitScale ? Math.floor(pitScale.z * height) : 1;
    let xs = pitScale ? Math.floor(pitScale.x * width) : 0;
    let ys = pitScale ? Math.floor(pitScale.y * height) : 0;

    let inc = pitScale ? Math.max(Math.floor(sizeX / 8), 2) : 16;

    for (let y = ys; y < ys + sizeY; y += inc) {
        let pit = y * (width || 0);
        for (let x = xs; x < xs + sizeX; x += inc) {
            let val = buffer[pit + x];
            if (val > -10.0 && val !== undefined) {
                max = Math.max(max, val);
                min = Math.min(min, val);
            }
        }
    }

    if (max === -1000000 || min === 1000000) {
        return { min: undefined, max: undefined };
    }
    return { min, max };
};

IoDriver_XBIL.prototype.parseXBil = function(buffer) {
    if (!buffer) {
        throw new Error('Error processing XBIL');
    }

    var result = new portableXBIL(buffer);

    var elevation = this.computeMinMaxElevation(result.floatArray);

    result.min = elevation.min;
    result.max = elevation.max;

    return result;
};


IoDriver_XBIL.prototype.read = function(url) {
    return fetch(url).then(response => {
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Error loading ${url}: status ${response.status}`);
        }
        return response.arrayBuffer();
    }).then(buffer => this.parseXBil(buffer));
};


export default IoDriver_XBIL;
