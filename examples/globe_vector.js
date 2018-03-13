/* global itowns, document, renderer */
// # Simple Globe viewer

// Define initial camera position
var positionOnGlobe = { longitude: 3.5, latitude: 44, altitude: 1000000 };
var promises = [];

// `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
var viewerDiv = document.getElementById('viewerDiv');

// Instanciate iTowns GlobeView*
var globeView = new itowns.GlobeView(viewerDiv, positionOnGlobe, { renderer: renderer });
function addLayerCb(layer) {
    return globeView.addLayer(layer);
}

// Add one imagery layer to the scene
// This layer is defined in a json file but it could be defined as a plain js
// object. See Layer* for more info.
promises.push(itowns.Fetcher.json('./layers/JSONLayers/Ortho.json').then(addLayerCb));
// Add two elevation layers.
// These will deform iTowns globe geometry to represent terrain elevation.
promises.push(itowns.Fetcher.json('./layers/JSONLayers/WORLD_DTM.json').then(addLayerCb));
promises.push(itowns.Fetcher.json('./layers/JSONLayers/IGN_MNT_HIGHRES.json').then(addLayerCb));

promises.push(globeView.addLayer({
    type: 'color',
    url: 'https://raw.githubusercontent.com/iTowns/iTowns2-sample-data/master/croquis.kml',
    protocol: 'rasterizer',
    id: 'Kml',
    name: 'kml',
    transparent: true,
}));

promises.push(globeView.addLayer({
    type: 'color',
    url: 'https://raw.githubusercontent.com/iTowns/iTowns2-sample-data/master/ULTRA2009.gpx',
    protocol: 'rasterizer',
    id: 'Gpx',
    name: 'Ultra 2009',
    transparent: true,
}));

promises.push(globeView.addLayer({
    type: 'color',
    url: 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements/09-ariege/departement-09-ariege.geojson',
    protocol: 'rasterizer',
    id: 'ariege',
    name: 'ariege',
    transparent: true,
    style: {
        fill: 'orange',
        fillOpacity: 0.5,
        stroke: 'white',
    },
}));

promises.push(globeView.addLayer({
    type: 'color',
    url: './multipolygon.geojson',
    protocol: 'rasterizer',
    id: 'ariege2',
    name: 'ariege',
    transparent: true,
    style: {
        fill: 'yellow',
        fillOpacity: 0.8,
        stroke: 'black',
    },
}));

itowns.Fetcher.json('./multipolygon.geojson')
    .then(file => itowns.GeoJSON2Features.parse('EPSG:4978', file))
    .then((feature) => {
        const obj = itowns.Feature2Mesh.convert()(feature);
        obj.children[0].material.depthTest = false;
        obj.children[0].material.renderOrder = 10;
        obj.children[0].material.wireframe = true;
        //obj.children[0].material.side = itowns.THREE.DoubleSide;
        globeView.scene.add(obj);
        globeView.notifyChange(true);
    });

exports.view = globeView;
exports.initialPosition = positionOnGlobe;
