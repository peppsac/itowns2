/* global itowns, document, setupLoadingScreen */
/* eslint-disable */
// # Simple Globe viewer + a vector tile layer

// Define initial camera position
var positionOnGlobe = { longitude: 2.475, latitude: 48.807, altitude: 12000000 };
var promises = [];

// `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
var viewerDiv = document.getElementById('viewerDiv');

// Instanciate iTowns GlobeView*
var view = new itowns.GlobeView(viewerDiv, positionOnGlobe);
setupLoadingScreen(viewerDiv, view);
function addLayerCb(layer) {
    return view.addLayer(layer);
}

// Define projection that we will use (taken from https://epsg.io/3946, Proj4js section)
promises.push(itowns.Fetcher.json('./layers/JSONLayers/Ortho.json').then(addLayerCb));
// Add two elevation layers.
// These will deform iTowns globe geometry to represent terrain elevation.
promises.push(itowns.Fetcher.json('./layers/JSONLayers/WORLD_DTM.json').then(addLayerCb));
promises.push(itowns.Fetcher.json('./layers/JSONLayers/IGN_MNT_HIGHRES.json').then(addLayerCb));

var mapboxLayers = [];

var count = 0;
// Add a vector tile layer
itowns.Fetcher.json('https://raw.githubusercontent.com/Oslandia/postile-openmaptiles/master/style.json').then(function (style) {
    // add one layer per layer in style.json
    style.layers.forEach(function(layer) {
        if (layer.type === 'fill' || layer.type === 'line') {
            mapboxLayers.push(layer);
        }
    });

    promises.push(view.addLayer({
        type: 'color',
        protocol: 'xyz',
        id: 'MVT',
        // eslint-disable-next-line no-template-curly-in-string
        url: 'https://osm.oslandia.io/data/v3/${z}/${x}/${y}.pbf',
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
            opacity: 0.5,
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
                    if (layer.type === 'fill') {
                        r.fill = layer.paint['fill-color'];
                        r.fillOpacity = layer.paint['fill-opacity'];
                    }
                    if (layer.type === 'line') {
                        r.stroke = layer.paint['line-color'];
                        if ('line-width' in layer.paint) {
                            r.strokeWidth = layer.paint['line-width'].base;
                        }
                        r.strokeOpacity = layer.paint['line-opacity'];
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
            if (properties.vt_layer !== 'park') {
                return;
            }
            properties.mapboxLayer = [];
            mapboxLayers.forEach(function(layer) {
                if (properties.vt_layer !== layer['source-layer']) {
                    return;
                }
                if ('filter' in layer) {
                    var filteredOut = false;
                    for (var i = 0; i < layer.filter.length; i++) {
                        var filter = layer.filter[i];

                        if (filter.length === undefined) {
                            continue;
                        }
                        if (filter[0] === '==') {
                            if (filter[1] === '$type') {
                                filteredOut |= (filter[2] != geometry.type);
                            }
                            else if (filter[1] in properties) {
                                filteredOut |= (properties[filter[1]] != filter[2]);
                            }
                        }
                        else if (filter[0] === 'in') {
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
    }));
});


exports.view = view;
exports.initialPosition = positionOnGlobe;
