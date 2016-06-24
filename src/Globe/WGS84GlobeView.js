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
define('Globe/WGS84GlobeView', [
    'Scene/View',
    'Globe/TileMesh',
    'Scene/Quadtree',
    'Scene/SchemeTile',
    'Core/Math/MathExtented',
    'Core/Commander/Providers/WGS84TileBuilder',
    'Renderer/NodeMesh',
    'Scene/BrowseTree',
    'Scene/NodeProcess',
    'Core/Commander/InterfaceCommander'
], function(View, TileMesh, Quadtree, SchemeTile, MathExt, WGS84TileBuilder, NodeMesh, BrowseTree, NodeProcess, InterfaceCommander) {


    function WGS84GlobeView(camera, size) {
        View.call(this);

        this.schemeTile = this.SchemeTileWMTS(2);
        this.size = size;

        this.quadtree = new Quadtree(TileMesh, this.schemeTile, this.size, null);
        this.browseTree = new BrowseTree();
        this.tileBuilder = new WGS84TileBuilder(this.size, false);
        this.process = new NodeProcess(
            camera,
            this.size,
            this, // FIXME: remove this
            this.tileBuilder);

        this.imageryLayers = [];
        this.elevationLayers = [];

        this.rootNode = this.quadtree.children[0];
    };


    WGS84GlobeView.prototype = Object.create(View.prototype);

    WGS84GlobeView.prototype.constructor = WGS84GlobeView;

    WGS84GlobeView.prototype.init = function() {
        for (var i = 0; i < this.schemeTile.rootCount(); i++) {
            var childtile = this.tileBuilder.buildTile(
                            this.rootNode,
                            this.schemeTile.getRoot(i),
                            this);
            // Add as child of node
            this.rootNode.add(childtile);
        }
    };

    WGS84GlobeView.prototype.SchemeTileWMTS = function(type) {
        //TODO: Implement Me
        if (type === 2) {
            var schemeT = new SchemeTile();
            schemeT.add(0, MathExt.PI, -MathExt.PI_OV_TWO, MathExt.PI_OV_TWO);
            schemeT.add(MathExt.PI, MathExt.TWO_PI, -MathExt.PI_OV_TWO, MathExt.PI_OV_TWO);
            return schemeT;
        }

    };

    /**
     * @documentation: update node
     * @param {type} node
     * @returns {Boolean}
     */
    WGS84GlobeView.prototype.update = function(camera) {
        this.browseTree.browse(this.quadtree, camera, this.process, 1 /*SUBDIVISE*/);
    };

    WGS84GlobeView.prototype.updateCamera = function(camera) {
        this.process.updateCamera(camera); // TODO stupid
    };

    WGS84GlobeView.prototype.getRootNode = function() {
        return this.rootNode;
    }


    return WGS84GlobeView;

});
