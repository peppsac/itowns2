/**
 * Generated On: 2015-10-5
 * Class: IoDriver_Image
 */


import IoDriver from 'Core/Commander/Providers/IoDriver';


function IoDriver_Image() {
    //Constructor
    IoDriver.call(this);

}

IoDriver_Image.prototype = Object.create(IoDriver.prototype);

IoDriver_Image.prototype.constructor = IoDriver_Image;

IoDriver_Image.prototype.read = function(url) {

    return new Promise(function(resolve, reject) {

        var image = new Image();

        if (__DEV__) {
            if (Math.random() < window.itowns.viewer.Debug.networkErrorRate) {
                setTimeout(function() {
                    reject(new Error(`(Simulated)Error loading ${url}`));
                }, 1000 * (0.2 + Math.random()));
                return;
            }
        }

        image.onload = () => resolve(image);

        image.onerror = () => reject(new Error(`Error loading ${url}`));

        image.crossOrigin = '';
        image.src = url;

    });
};

export default IoDriver_Image;
