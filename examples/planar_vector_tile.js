/* global itowns, renderer */
// # Orthographic viewer

// Define geographic extent: CRS, min/max X, min/max Y
var extent = new itowns.Extent(
    'EPSG:3857',
    -20026376.39, 20026376.39,
    -20048966.10, 20048966.10);

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

view.camera.camera3D.left = 237013;
view.camera.camera3D.right = 310845;
view.camera.camera3D.top = 6202048;
view.camera.camera3D.bottom = 6271271;
view.notifyChange(true);

// By default itowns' tiles geometry have a "skirt" (ie they have a height),
// but in case of orthographic we don't need this feature, so disable it
view.tileLayer.disableSkirt = true;

function featureFilter(properties) {
    if (properties.vt_layer == 'surface_commune') {
        return true;
    }
    return false;
}

function styleFeature(properties) {
    var style = {
        fillOpacity: 1,
    };

    if (properties.vt_layer == 'surface_commune') {
        style.fill = '#ccffff';
    } else if (properties.vt_layer == 'zone_de_vegetation') {
        style.fill = '#7fff00';
    } else if (properties.vt_layer == 'batiment') {
        style.fill = '#ffcccc';
    }

    return style;
}

function sortFeatures(a, b) {
    var key_a = a.properties.vt_layer;
    var key_b = b.properties.vt_layer;

    if (key_a == key_b) {
        return 0;
    } else if (key_a == 'surface_commune' && key_b == 'zone_de_vegetation') {
        return -1;
    } else if (key_a == 'surface_commune' && key_b == 'batiment') {
        return -1;
    } else if (key_a == 'zone_de_vegetation' && key_b == 'surface_commune') {
        return 1;
    } else if (key_a == 'zone_de_vegetation' && key_b == 'batiment') {
        return -1;
    } else if (key_a == 'batiment' && key_b == 'surface_commune') {
        return 1;
    } else if (key_a == 'batiment' && key_b == 'zone_de_vegetation') {
        return 1;
    }

    return 0;
}

function colorFeature(properties) {
    if (properties.vt_layer == 'surface_commune') {
        return new itowns.THREE.Color(0xccffff);
    } else if (properties.vt_layer == 'zone_de_vegetation') {
        return new itowns.THREE.Color(0x7fff00);
    } else if (properties.vt_layer == 'batiment') {
        return new itowns.THREE.Color(0xffcccc);
    }

    return new itowns.THREE.Color(0xff0000);
}

// TMS color
// view.addLayer({
    // type: 'color',
    // protocol: 'tms',
    // id: 'MVT',
    // // eslint-disable-next-line no-template-curly-in-string
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
    // style: styleFeature,
    // filter: featureFilter,
    // sort: sortFeatures,
// });

// TMS geometry
view.addLayer({
    type: 'geometry',
    protocol: 'tms',
    id: 'MVT',
    // eslint-disable-next-line no-template-curly-in-string
    url: 'http://172.16.3.109:8082/geoserver/gwc/service/tms/1.0.0/vecteur_tuile:bduni@EPSG:3857@pbf/${z}/${x}/${y}.pbf',
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
    update: itowns.FeatureProcessing.update,
    convert: itowns.Feature2Mesh.convert({
        color: colorFeature }),
    filter: featureFilter,
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
