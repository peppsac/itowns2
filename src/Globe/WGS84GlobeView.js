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
    'Core/Geographic/Quad',
    'Renderer/NodeMesh'
], function(View, Quad, NodeMesh) {


    function WGS84GlobeView() {
        View.call(this);

        this.schemeTile = schemeTile;

        this.quadtree = new Quadtree(TileMesh, this.SchemeTileWMTS(2), this.size, kml);
        this.process = new NodeProcess(this.getCurrentCamera(), this.size);
        this.browseTree = new BrowseTree();

        this.colorLayers = [];
        this.elevationLayers = [];

        for (var i = 0; i < this.schemeTile.rootCount(); i++) {
            this.requestNewTile(this.schemeTile.getRoot(i), rootNode);
        }
    }

    WGS84GlobeView.prototype = Object.create(View.prototype);

    WGS84GlobeView.prototype.constructor = WGS84GlobeView;


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
        this.browseTree.browse(this.quadtree, camera, this.process, SUBDIVISE);
    };

    return Quadtree;

});
