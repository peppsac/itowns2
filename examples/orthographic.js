// # Planar (EPSG:3946) viewer

// Define projection that we will use (taken from https://epsg.io/3946, Proj4js section)
itowns.proj4.defs('EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// Define geographic extent: CRS, min/max X, min/max Y
const extent = new itowns.Extent(
    'EPSG:3857',
    -20026376.39, 20026376.39,
    -20048966.10, 20048966.10);

// `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
const viewerDiv = document.getElementById('viewerDiv');

// Instanciate PlanarView
var view = new itowns.PlanarView(viewerDiv, extent, { renderer, maxSubdivisionLevel: 10 });
view.tileLayer.disableSkirt = true;

// override itowns camera
view.camera.camera3D = new itowns.THREE.OrthographicCamera(
    extent.west(), extent.east(),
    extent.east() / view.camera.ratio, extent.west() / view.camera.ratio,
    0, 1000);
view.camera.update();

// Add an WMS imagery layer (see WMS_Provider for valid options)
view.addLayer({
    'type': 'color',
    'protocol':   'tms',
    'id':         'OPENSM',
    'url':  'http://c.tile.stamen.com/watercolor/${z}/${x}/${y}.jpg',
    'extent': [extent.west(), extent.east(), extent.south(), extent.north()],
    'projection': 'EPSG:3857',
    'options': {
        'attribution' : {
            'name':'OpenStreetMap',
            'url':'http://www.openstreetmap.org/'
        }
    },
    'updateStrategy': {
        type: itowns.STRATEGY_DICHOTOMY,
    },
});

var onMouseWheel = (event) => {
    const change = 1 - (Math.sign(event.wheelDelta || -event.detail) * 0.1);

    const ratio = extent.dimensions().y / extent.dimensions().x;

    let halfNewWidth = (view.camera.camera3D.right - view.camera.camera3D.left) * change * 0.5;
    let halfNewHeight = (view.camera.camera3D.top - view.camera.camera3D.bottom) * change * 0.5;
    let cx = (view.camera.camera3D.right + view.camera.camera3D.left) * 0.5;
    let cy = (view.camera.camera3D.top + view.camera.camera3D.bottom) * 0.5;

    view.camera.camera3D.left = cx - halfNewWidth;
    view.camera.camera3D.right = cx + halfNewWidth;
    view.camera.camera3D.top = cy + halfNewHeight;
    view.camera.camera3D.bottom = cy - halfNewHeight;

    view.notifyChange(true);
};
viewerDiv.addEventListener('DOMMouseScroll', onMouseWheel);
viewerDiv.addEventListener('mousewheel', onMouseWheel);

let dragStartPosition;
let dragCameraStart;
viewerDiv.addEventListener('mousedown', (event) => {
    dragStartPosition = new itowns.THREE.Vector2(event.clientX, event.clientY);
    dragCameraStart = {
        left: view.camera.camera3D.left,
        right: view.camera.camera3D.right,
        top: view.camera.camera3D.top,
        bottom: view.camera.camera3D.bottom,
    };
});
viewerDiv.addEventListener('mousemove', (event) => {
    if (dragStartPosition) {
        let width = view.camera.camera3D.right - view.camera.camera3D.left;
        let deltaX = width * (event.clientX - dragStartPosition.x) / -viewerDiv.clientWidth;
        let deltaY = width * (event.clientY - dragStartPosition.y) / viewerDiv.clientHeight;

        view.camera.camera3D.left = dragCameraStart.left + deltaX;
        view.camera.camera3D.right = dragCameraStart.right + deltaX;
        view.camera.camera3D.top = dragCameraStart.top + deltaY;
        view.camera.camera3D.bottom = dragCameraStart.bottom + deltaY;
        view.notifyChange(true);
    }
});
viewerDiv.addEventListener('mouseup', (event) => {
    dragStartPosition = undefined;
});

// Request redraw
view.notifyChange(0, true);
