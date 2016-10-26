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
import Layer from 'Scene/Layer';
import InterfaceCommander from 'Core/Commander/InterfaceCommander';
import Quad from 'Core/Geographic/Quad';
import NodeMesh from 'Renderer/NodeMesh';
import { SSE_SUBDIVISION_THRESHOLD } from 'Scene/NodeProcess';

function commandQueuePriorityFunction(cmd) {
    var node = cmd.requester;

    // We know that 'node' is visible because commands can only be
    // issued for visible nodes.
    //
    // Prioritize subdivision request
    if (cmd.layer instanceof Quadtree) {
        return 10000;
    } else {
        if (!node.loaded) {
            return 1000;
        } else {
            if (SSE_SUBDIVISION_THRESHOLD < node.sse) {
                return 100;
            } else {
                return 10;
            }
        }
    }
}

function Quadtree(type, schemeTile, link) {
    Layer.call(this);

    this.interCommand = new InterfaceCommander(type, commandQueuePriorityFunction);
    this.link = link;
    this.schemeTile = schemeTile;
    this.tileType = type;
    this.minLevel = 2;
    this.maxLevel = 17;
    var rootNode = new NodeMesh();

    rootNode.frustumCulled = false;
    rootNode.material.visible = false;

    rootNode.link = this.link;

    rootNode.changeState = function changeState() {
        return true;
    };

    this.add(rootNode);

    if (__DEV__) {
        this.resetStatistics = function resetStatistics() {
            this.statistics = [];
            this.statistics.titles = new Set();
            for (let i = 0; i <= this.maxLevel; i++) {
                this.statistics.push({});
            }
        };

        this.updateStatistics = function updateStatistics(name, level, delta) {
            this.statistics.titles.add(name);
            while (this.statistics.length <= level) {
                this.statistics.push({});
            }
            if (!this.statistics[level][name]) {
                this.statistics[level][name] = 0;
            }
            this.statistics[level][name] += delta;
        };

        this.getGlobalStat = function getGlobalStat(name) {
            let sum = 0;
            for (let level = 0; level < this.statistics.length; level++) {
                const v = this.statistics[level][name];
                if (v) {
                    sum += v;
                }
            }
            return sum;
        };

        this.resetStatistics();
    }
}

Quadtree.prototype = Object.create(Layer.prototype);

Quadtree.prototype.constructor = Quadtree;

Quadtree.prototype.init = function init(geometryLayer) {
    var rootNode = this.children[0];

    for (var i = 0; i < this.schemeTile.rootCount(); i++) {
        this.requestNewTile(geometryLayer, this.schemeTile.getRoot(i), rootNode);
    }
};

Quadtree.prototype.northWest = function northWest(node) {
    return node.children[0];
};

Quadtree.prototype.northEast = function northEast(node) {
    return node.children[1];
};

Quadtree.prototype.southWest = function southWest(node) {
    return node.children[2];
};

Quadtree.prototype.southEast = function southEast(node) {
    return node.children[3];
};

Quadtree.prototype.requestNewTile = function requestNewTile(geometryLayer, bbox, parent) {
    var params = {
        layer: geometryLayer,
        bbox,
    };

    this.interCommand.request(params, parent);
};

Quadtree.prototype.canSubdivideNode = function canSubdivideNode(node) {
    return node.level < this.maxLevel;
};

/**
 * @documentation: returns bounding boxes of a node's quadtree subdivision
 * @param {type} node
 * @returns {Array} an array of four bounding boxex
 */
Quadtree.prototype.subdivideNode = function subdivideNode(node) {
    if (node.pendingSubdivision || !this.canSubdivideNode(node)) {
        return [];
    }

    var quad = new Quad(node.bbox);

    return [quad.northWest, quad.northEast, quad.southWest, quad.southEast];
};

Quadtree.prototype.traverse = function traverse(foo, node)
{
    if (foo(node))
      { for (var i = 0; i < node.children.length; i++)
        { this.traverse(foo, node.children[i]); } }
};

Quadtree.prototype.getTile = function getTile(coordinate) {
    var point = { x: coordinate.longitude(), y: coordinate.latitude() };

    var gT = function gT(tile)
    {
        var inside = tile.bbox ? tile.bbox.isInside(point) : true;

        if (tile.children.length === 0 && inside)
            { point.tile = tile; }

        // TODO: Fix error verify if this is correct
        if (inside)
             { point.parent = tile.parent; }

        return inside;
    };

    this.traverse(gT, this.children[0]);

    if (point.tile === undefined)
      { return point.parent; }
    else
      { return point.tile; }
};

export default Quadtree;
