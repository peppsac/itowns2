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

var r = viewerDiv.clientWidth / viewerDiv.clientHeight;
var camera = new itowns.THREE.OrthographicCamera(
    extent.west(), extent.east(),
    extent.east() / r, extent.west() / r,
    0, 1000);

// Instanciate PlanarView
var view = new itowns.PlanarView(
        viewerDiv, extent, { maxSubdivisionLevel: 20, camera: camera });
setupLoadingScreen(viewerDiv, globeView);
var onMouseWheel = function onMouseWheel(event) {
    var change = 1 - (Math.sign(event.wheelDelta || -event.detail) * 0.1);

    var halfNewWidth = (view.camera.camera3D.right - view.camera.camera3D.left) * change * 0.5;
    var halfNewHeight = (view.camera.camera3D.top - view.camera.camera3D.bottom) * change * 0.5;
    var cx = (view.camera.camera3D.right + view.camera.camera3D.left) * 0.5;
    var cy = (view.camera.camera3D.top + view.camera.camera3D.bottom) * 0.5;

    view.camera.camera3D.left = cx - halfNewWidth;
    view.camera.camera3D.right = cx + halfNewWidth;
    view.camera.camera3D.top = cy + halfNewHeight;
    view.camera.camera3D.bottom = cy - halfNewHeight;

    view.notifyChange(true);
};

var dragStartPosition;
var dragCameraStart;
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

viewerDiv.addEventListener('DOMMouseScroll', onMouseWheel);
viewerDiv.addEventListener('mousewheel', onMouseWheel);

viewerDiv.addEventListener('mousedown', function mouseDown(event) {
    dragStartPosition = new itowns.THREE.Vector2(event.clientX, event.clientY);
    dragCameraStart = {
        left: view.camera.camera3D.left,
        right: view.camera.camera3D.right,
        top: view.camera.camera3D.top,
        bottom: view.camera.camera3D.bottom,
    };
});
viewerDiv.addEventListener('mousemove', function mouseMove(event) {
    var width;
    var deltaX;
    var deltaY;
    if (dragStartPosition) {
        width = view.camera.camera3D.right - view.camera.camera3D.left;
        deltaX = width * (event.clientX - dragStartPosition.x) / -viewerDiv.clientWidth;
        deltaY = width * (event.clientY - dragStartPosition.y) / viewerDiv.clientHeight;

        view.camera.camera3D.left = dragCameraStart.left + deltaX;
        view.camera.camera3D.right = dragCameraStart.right + deltaX;
        view.camera.camera3D.top = dragCameraStart.top + deltaY;
        view.camera.camera3D.bottom = dragCameraStart.bottom + deltaY;
        view.notifyChange(true);
    }
});
viewerDiv.addEventListener('mouseup', function mouseUp() {
    dragStartPosition = undefined;
});

// Request redraw
view.notifyChange(true);
