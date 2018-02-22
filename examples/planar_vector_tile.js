/* global itowns, renderer */
// # Orthographic viewer

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
        viewerDiv, extent, { renderer: renderer, maxSubdivisionLevel: 20, camera: camera });

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

// Val de marne
view.camera.camera3D.left = 538488;
view.camera.camera3D.right = 667935;
view.camera.camera3D.top = 5690491;
view.camera.camera3D.bottom = 5606934;

// Saclay
// view.camera.camera3D.left = 230000;
// view.camera.camera3D.right = 253000;
// view.camera.camera3D.top = 6237000;
// view.camera.camera3D.bottom = 6224000;
view.notifyChange(true);

// By default itowns' tiles geometry have a "skirt" (ie they have a height),
// but in case of orthographic we don't need this feature, so disable it
view.tileLayer.disableSkirt = true;
view.addLayer({
    type: 'color',
    protocol: 'xyz',
    id: 'OPENSM',
    // eslint-disable-next-line no-template-curly-in-string
    url: 'http://c.tile.stamen.com/watercolor/${z}/${x}/${y}.jpg',
    networkOptions: { crossOrigin: 'anonymous' },
    extent: [extent.west(), extent.east(), extent.south(), extent.north()],
    projection: 'EPSG:3857',
    options: {
        attribution: {
            name: 'OpenStreetMap',
            url: 'http://www.openstreetmap.org/',
        },
    },
    updateStrategy: {
        type: itowns.STRATEGY_DICHOTOMY,
    },
});

function featureFilter(properties) {
    return true;
    if (properties.vt_layer == 'surface_commune') {
        return true;
    }
    return false;
}


const mapboxLayers = [];

let count = 0;
itowns.Fetcher.json('http://localhost:8080/style.json').then((style) => {
    view.tileLayer.noTextureColor =
    new itowns.THREE.Color(style['layers'][0]['paint']['background-color']);
    // add one layer per layer in style.json
    for (const layer of style['layers']) {
        if (layer.type != 'fill' && layer.type != 'line') {
            continue;
        }
        mapboxLayers.push(layer);
    }


    view.addLayer({
        type: 'color',
        protocol: 'xyz',
        id: 'MVT',
        // eslint-disable-next-line no-template-curly-in-string
        url: 'https://osm.oslandia.io/data/v3/${z}/${x}/${y}.pbf',
        // url: 'http://127.0.0.1:8080/tiles/${z}/${x}/${y}.pbf',
        extent: [extent.west(), extent.east(), extent.south(), extent.north()],
        projection: 'EPSG:3857',
        options: {
            attribution: {
                name: 'OpenStreetMap',
                url: 'http://www.openstreetmap.org/',
            },
            mimetype: 'application/x-protobuf;type=mapbox-vector',
            zoom: {
                min: 2,
                max: 20,
            },
        },
        updateStrategy: {
            type: itowns.STRATEGY_DICHOTOMY,
        },
        style: (properties, feature) => {
            const styles = [];
            for (const layer of properties.mapboxLayer) {
                const r = { };
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
            }
            return styles;
        },
        filter: (properties, geometry) => {
            properties.mapboxLayer = [];
            for (const layer of mapboxLayers) {
                if (properties.vt_layer !== layer['source-layer']) {
                    continue;
                }
                if ('filter' in layer) {
                    let filteredOut = false;
                    for (let i = 0; i < layer['filter'].length; i++) {
                        const filter = layer['filter'][i];

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
            }
            return properties.mapboxLayer.length > 0;
        },
    });
});





// TMS geometry
// view.addLayer({
    // type: 'geometry',
    // protocol: 'tms',
    // id: 'MVT',
    // // eslint-disable-next-line no-template-curly-in-string
    // // url: 'http://172.16.3.109:8082/geoserver/gwc/service/tms/1.0.0/vecteur_tuile:batiment_saclay@EPSG:3857@pbf/${z}/${x}/${y}.pbf',
    // url: 'http://172.16.3.109:8082/geoserver/gwc/service/tms/1.0.0/vecteur_tuile:bduni@EPSG:3857@pbf/${z}/${x}/${y}.pbf',
    // extent: [extent.west(), extent.east(), extent.south(), extent.north()],
    // projection: 'EPSG:3857',
    // options: {
        // attribution: {
            // name: 'OpenStreetMap',
            // url: 'http://www.openstreetmap.org/',
        // },
        // mimetype: 'application/x-protobuf;type=mapbox-vector',
        // zoom: {
            // min: 2,
            // max: 20,
        // },
    // },
    // updateStrategy: {
        // type: itowns.STRATEGY_DICHOTOMY,
    // },
    // update: itowns.FeatureProcessing.update,
    // convert: itowns.Feature2Mesh.convert({
        // color: colorFeature }),
    // filter: featureFilter,
// });

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
