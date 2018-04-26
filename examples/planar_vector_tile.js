/* global itowns, setupLoadingScreen */
/* eslint-disable */
// # Planar view with one single layer of vector tile

// Define geographic extent: CRS, min/max X, min/max Y
var extent = new itowns.Extent(
    'EPSG:3857',
    -20037508.342789244, 20037508.342789244,
    -20037508.342789255, 20037508.342789244);

// `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
var viewerDiv = document.getElementById('viewerDiv');

// Instanciate PlanarView
var view = new itowns.PlanarView(viewerDiv, extent, { maxSubdivisionLevel: 20 });

// eslint-disable-next-line no-new
new itowns.PlanarControls(view, {
    // We do not want the user to zoom out too much
    maxAltitude: 40000000,
    // We want to keep the rotation disabled, to only have a view from the top
    enableRotation: false,
    // Faster zoom in/out speed
    zoomInFactor: 0.5,
    zoomOutFactor: 0.5,
    // Don't zoom too much on smart zoom
    smartZoomHeightMax: 100000,
});

// Turn in the right angle
view.camera.camera3D.rotateZ(-Math.PI / 2);
setupLoadingScreen(viewerDiv, view);

var mapboxLayers = [];

var count = 0;

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
        url: 'https://osm.oslandia.io/data/v3/${z}/${x}/${y}.pbf',
        extent: [extent.west(), extent.east(), extent.south(), extent.north()],
        projection: 'EPSG:3857',
        format: 'application/x-protobuf;type=mapbox-vector',
        options: {
            attribution: {
                name: 'OpenStreetMap',
                url: 'http://www.openstreetmap.org/',
            },
            zoom: {
                min: 2,
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

// Request redraw
view.notifyChange(true);
