/**
 * Generated On: 2015-10-5
 * Class: Layer
 * Description: Le layer est une couche de données. Cette couche peut etre des images ou de l'information 3D. Les requètes de cette couche sont acheminées par une interfaceCommander.
 *
 */

/**
 *
 * @param {type} Node
 * @param {type} InterfaceCommander
 * @param {type} Projection
 * @param {type} NodeMesh
 * @returns {Layer_L15.Layer}
 */
define('Scene/View', [
    'THREE',
    'Scene/Node',
    'Core/Commander/InterfaceCommander',
    'Core/Geographic/Projection',
    'Renderer/NodeMesh'
], function(THREE, Node, InterfaceCommander, Projection, NodeMesh) {

    View.count = 0;

    function View() {
        this.id = View.count++;
        this.interCommand = new InterfaceCommander(this.id);
    }


    View.prototype = Object.create(Node.prototype);

    View.prototype.constructor = View;

    View.prototype.limits = function() {
        return min/max/x/y/z;
    }

    View.prototype.updateCamera = function(camera) {

    }

    View.prototype.update = function(camera) {

    }

    View.prototype.render = function(camera) {

    }

    return View;

});
