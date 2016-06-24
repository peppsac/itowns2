/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/*
 * A Faire
 * Les tuiles de longitude identique ont le maillage et ne demande pas 1 seule calcul pour la génération du maillage
 *
 *
 *
 *
 */



define('Core/Commander/Providers/WGS84TileBuilder', [ // FIXME: move
        'when',
        'THREE',
        'Core/Geographic/Projection',
        'Globe/WGS84GlobeView',
        'Globe/TileGeometry',
        'Globe/TileMesh',
        'Core/Geographic/CoordWMTS',
        'Core/Math/Ellipsoid',
        'Globe/BuilderEllipsoidTile',
        'Core/defaultValue',
        'Scene/BoundingBox'
    ],
    function(
        when,
        THREE,
        Projection,
        WGS84GlobeView,
        TileGeometry,
        TileMesh,
        CoordWMTS,
        Ellipsoid,
        BuilderEllipsoidTile,
        defaultValue,
        BoundingBox
    ) {

        function WGS84TileBuilder(size,gLDebug) {
            //Constructor
            this.projection = new Projection();
            this.ellipsoid = new Ellipsoid(size);
            this.builder = new BuilderEllipsoidTile(this.ellipsoid,this.projection);

            this.cacheGeometry = [];
            this.tree = null;
            this.nNode = 0;

        }

        WGS84TileBuilder.prototype.constructor = WGS84TileBuilder;

        WGS84TileBuilder.prototype.getGeometry = function(bbox, cooWMTS) {
            var geometry = undefined;
            var n = Math.pow(2, cooWMTS.zoom + 1);
            var part = Math.PI * 2.0 / n;

            if (this.cacheGeometry[cooWMTS.zoom] !== undefined && this.cacheGeometry[cooWMTS.zoom][cooWMTS.row] !== undefined) {
                geometry = this.cacheGeometry[cooWMTS.zoom][cooWMTS.row];
            } else {
                if (this.cacheGeometry[cooWMTS.zoom] === undefined)
                    this.cacheGeometry[cooWMTS.zoom] = new Array();

                var precision = 16;
                var rootBBox = new BoundingBox(0, part + part * 0.01, bbox.minCarto.latitude, bbox.maxCarto.latitude);

                geometry = new TileGeometry(rootBBox, precision, this.ellipsoid, cooWMTS.zoom);
                this.cacheGeometry[cooWMTS.zoom][cooWMTS.row] = geometry;

            }

            return geometry;
        };

        WGS84TileBuilder.prototype.buildTile = function(parent, bbox, globe) {

            // TODO not generic
            var tileCoord = this.projection.WGS84toWMTS(bbox);

            // build tile
            var geometry = undefined; //getGeometry(bbox,tileCoord);

            var params = {bbox:bbox,zoom:tileCoord.zoom,segment:16,center:null,projected:null}

            var tile = new TileMesh(params,this.builder);

            tile.tileCoord = tileCoord;
            tile.material.setUuid(this.nNode++);
            tile.link = parent.link;
            tile.geometricError = Math.pow(2, (18 - tileCoord.zoom));

            if (geometry) {
                tile.rotation.set(0, (tileCoord.col % 2) * (Math.PI * 2.0 / Math.pow(2, tileCoord.zoom + 1)), 0);
            }

            parent.worldToLocal(params.center);

            tile.position.copy(params.center);
            tile.setVisibility(false);

            tile.updateMatrix();
            tile.updateMatrixWorld();

            tile.WMTSs = [];

            for (var i = 0; i < globe.imageryLayers.length; i++) {
                // only use wmts providers
                var tileMT = globe.imageryLayers[i].wmtsOptions.tileMatrixSet;

                if(!tile.WMTSs[tileMT]) {
                    tile.WMTSs[tileMT] = this.projection.getCoordWMTS_WGS84(tile.tileCoord, tile.bbox,tileMT);
                }
            }

            return tile;
        };

        return WGS84TileBuilder;

    });
