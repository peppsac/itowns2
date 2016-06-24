/**
 * Generated On: 2015-10-5
 * Class: Quadtree
 * Description: Structure de données spatiales possedant jusqu'à 4 Nodes
 */

/**
 *
 * @param {type} Layer
 * @param {type} Quad
 * @returns {Quadtree_L13.Quadtree}
 */
define('Scene/Quadtree', [
    'Scene/Node',
    'Core/Geographic/Quad',
    'Renderer/NodeMesh'
], function(Node, Quad, NodeMesh) {


    function Quadtree(type, schemeTile, size, link) {
        Node.call(this);

        this.schemeTile = schemeTile;
        this.tileType = type;
        this.minLevel = 2;
        this.maxLevel = 17;

        var rootNode = new NodeMesh();

        rootNode.frustumCulled = false;
        rootNode.material.visible = false;

        rootNode.link = this.link;

        rootNode.enablePickingRender = function() { return true;};
        this.add(rootNode);
    }

    Quadtree.prototype = Object.create(Node.prototype);

    Quadtree.prototype.constructor = Quadtree;

    Quadtree.prototype.northWest = function(node) {
        return node.children[0];
    };

    Quadtree.prototype.northEast = function(node) {
        return node.children[1];
    };

    Quadtree.prototype.southWest = function(node) {
        return node.children[2];
    };

    Quadtree.prototype.southEast = function(node) {
        return node.children[3];
    };

    /**
     * @documentation: returns bounding boxes of a node's quadtree subdivision
     * @param {type} node
     * @returns {Array} an array of four bounding boxex
     */
    Quadtree.prototype.subdivide = function (node) {
        if(node.pendingSubdivision || node.level > this.maxLevel){
            return [];
        }

        var quad = new Quad(node.bbox);


        return [quad.northWest, quad.northEast, quad.southWest, quad.southEast];
    };

    return Quadtree;

});
