/* global itowns, document, renderer, proj4, setupLoadingScreen */
// # Planar (EPSG:3946) viewer

var extent;
var viewerDiv;
var view;

// Define projection that we will use (taken from https://epsg.io/3946, Proj4js section)
proj4.defs('EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// Define geographic extent: CRS, min/max X, min/max Y
extent = new itowns.Extent(
    'EPSG:3946',
    1837816.94334, 1847692.32501,
    5170036.4587, 5178412.82698);

// `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
viewerDiv = document.getElementById('viewerDiv');

// Instanciate PlanarView*
view = new itowns.PlanarView(viewerDiv, extent, { renderer: renderer });
setupLoadingScreen(viewerDiv, view);
view.tileLayer.disableSkirt = true;

var mapboxLayers = [];
// Add a vector tile layer
itowns.Fetcher.json('https://raw.githubusercontent.com/Oslandia/postile-openmaptiles/master/style.json').then(function (style) {
    view.tileLayer.noTextureColor =
    new itowns.THREE.Color(style['layers'][0]['paint']['background-color']);
    // add one layer per layer in style.json
    style.layers.forEach(function(layer) {
        if (layer.type === 'fill' || layer.type === 'line') {
            mapboxLayers.push(layer);
        }
    });

    view.addLayer({
        type: 'color',
        protocol: 'xyz',
        id: 'MVT',
        // eslint-disable-next-line no-template-curly-in-string
        url: 'https://osm.oslandia.io/data/v3/${z}/${x}/${y}.pbf?srid=3946&BBOX=1837816.94334,5170036.4587,1847692.32501,5178412.82698',
        extent: [extent.west(), extent.east(), extent.south(), extent.north()],
        projection: 'EPSG:3946',
        format: 'application/x-protobuf;type=mapbox-vector',
        options: {
            attribution: {
                name: 'OpenStreetMap',
                url: 'http://www.openstreetmap.org/',
            },
            zoom: {
                min: 0,
                max: 15,
            },
        },
        updateStrategy: {
            type: itowns.STRATEGY_DICHOTOMY,
        },
        style: function (properties, feature) {
            var styles = [];
            properties.mapboxLayer.forEach(function(layer) {
                var r = { };
                // a feature could be used in several layers...
                if ('paint' in layer) {
                    if (layer.type == 'fill') {
                        r.fill = layer['paint']['fill-color'];
                        r.fillOpacity = layer['paint']['fill-opacity'];
                    }
                    if (layer.type == 'line') {
                        r.stroke = layer['paint']['line-color'];
                        if ('line-width' in layer['paint']) {
                            r.strokeWidth = layer['paint']['line-width']['base'];
                        }
                        r.strokeOpacity = layer['paint']['line-opacity'];
                    }
                }
                styles.push(r);
            });

            if (styles.length === 1) {
                return styles[0];
            }

            return styles;
        },
        filter: function (properties, geometry) {
            properties.mapboxLayer = [];
            mapboxLayers.forEach(function(layer) {
                if (properties.vt_layer !== layer['source-layer']) {
                    return;
                }
                if ('filter' in layer) {
                    var filteredOut = false;
                    for (var i = 0; i < layer['filter'].length; i++) {
                        var filter = layer['filter'][i];

                        if (filter.length === undefined) {
                            continue;
                        }
                        if (filter[0] == '==') {
                            if (filter[1] == '$type') {
                                filteredOut |= (filter[2] != geometry.type);
                            }
                            else if (filter[1] in properties) {
                                filteredOut |= (properties[filter[1]] != filter[2]);
                            }
                        }
                        else if (filter[0] == 'in') {
                            filteredOut |= (filter.slice(2).indexOf(properties[filter[1]]) == -1);
                        }
                        if (filteredOut) {
                            break;
                        }
                    }
                    if (!filteredOut) {
                        properties.mapboxLayer.push(layer);
                    }
                } else {
                    properties.mapboxLayer.push(layer);
                }
            });
            return properties.mapboxLayer.length > 0;
        },
    });
});

// Add an WMS imagery layer (see WMSProvider* for valid options)
view.addLayer({
    url: 'https://download.data.grandlyon.com/wms/grandlyon',
    networkOptions: { crossOrigin: 'anonymous' },
    type: 'color',
    protocol: 'wms',
    version: '1.3.0',
    id: 'wms_imagery',
    name: 'Ortho2009_vue_ensemble_16cm_CC46',
    projection: 'EPSG:3946',
    format: 'image/jpeg',
    updateStrategy: {
        type: itowns.STRATEGY_DICHOTOMY,
        options: {},
    },
    opacity: 0.5,
});

// Add an WMS elevation layer (see WMSProvider* for valid options)
// view.addLayer({
//     url: 'https://download.data.grandlyon.com/wms/grandlyon',
//     type: 'elevation',
//     protocol: 'wms',
//     networkOptions: { crossOrigin: 'anonymous' },
//     id: 'wms_elevation',
//     name: 'MNT2012_Altitude_10m_CC46',
//     projection: 'EPSG:3946',
//     heightMapWidth: 256,
//     format: 'image/png',
// });
// Since the elevation layer use color textures, specify min/max z
view.tileLayer.materialOptions = {
    useColorTextureElevation: true,
    colorTextureElevationMinZ: 37,
    colorTextureElevationMaxZ: 240,
};

view.camera.setPosition(new itowns.Coordinates('EPSG:3946', extent.west(), extent.south(), 2000));
// Then look at extent's center
view.camera.camera3D.lookAt(extent.center().xyz());

// instanciate controls
// eslint-disable-next-line no-new
new itowns.PlanarControls(view, {});

// Request redraw
view.notifyChange(true);

exports.view = view;
