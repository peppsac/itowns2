/**
 * Generated On: 2015-10-5
 * Class: ApiGlobe
 * Description: Classe façade pour attaquer les fonctionnalités du code.
 */

import CustomEvent from 'custom-event';
import Scene from '../../../../Scene/Scene';
import { GeometryLayer, ImageryLayers } from '../../../../Scene/Layer';
import WMTS_Provider from '../../Providers/WMTS_Provider';
import WMS_Provider from '../../Providers/WMS_Provider';
import TileProvider from '../../Providers/TileProvider';
import loadGpx from '../../Providers/GpxUtils';
import { C, ellipsoidSizes } from '../../../Geographic/Coordinates';
import Projection from '../../../Geographic/Projection';
import Fetcher from '../../Providers/Fetcher';
import { STRATEGY_MIN_NETWORK_TRAFFIC } from '../../../../Scene/LayerUpdateStrategy';
import { processTiledGeometryNode, initTiledGeometryLayer } from '../../../../Process/TiledNodeProcessing';
import { updateLayeredMaterialNodeImagery, updateLayeredMaterialNodeElevation, initNewNode } from '../../../../Process/LayeredMaterialNodeProcessing';
import { globeCulling, preGlobeUpdate, globeSubdivisionControl, globeSchemeTileWMTS, globeSchemeTile1 } from '../../../../Process/GlobeTileProcessing';
import BuilderEllipsoidTile from '../../../../Globe/BuilderEllipsoidTile';
import Atmosphere from '../../../../Globe/Atmosphere';
import Clouds from '../../../../Globe/Clouds';
import CoordStars from '../../../../Core/Geographic/CoordStars';

var sceneIsLoaded = false;
var eventLoaded = new CustomEvent('globe-loaded');
var eventRange = new CustomEvent('rangeChanged');
var eventCenter = new CustomEvent('centerchanged');
var eventOrientation = new CustomEvent('orientationchanged');
var eventPan = new CustomEvent('panchanged');
var eventLayerAdded = new CustomEvent('layeradded');
var eventLayerRemoved = new CustomEvent('layerremoved');
var eventLayerChanged = new CustomEvent('layerchanged');
var eventLayerChangedVisible = new CustomEvent('layerchanged:visible');
var eventLayerChangedOpacity = new CustomEvent('layerchanged:opacity');
var eventLayerChangedIndex = new CustomEvent('layerchanged:index');
var eventError = new CustomEvent('error');

var enableAnimation = false;

const defer = function defer() {
    const deferedPromise = {};
    deferedPromise.promise = new Promise((resolve, reject) => {
        deferedPromise.resolve = resolve;
        deferedPromise.reject = reject;
    });
    return deferedPromise;
};

function ApiGlobe() {
    // Constructor
    this.scene = null;
    this.commandsTree = null;
    this.projection = new Projection();
    this.viewerDiv = null;
    this.callback = null;
}

ApiGlobe.prototype.constructor = ApiGlobe;

/**
 * This function gives a chance to the matching provider to pre-process some
 * values for a layer.
 */
function preprocessLayer(layer, provider) {
    if (!layer.updateStrategy) {
        layer.updateStrategy = {
            type: STRATEGY_MIN_NETWORK_TRAFFIC,
        };
    }

    if (provider.tileInsideLimit) {
        layer.tileInsideLimit = provider.tileInsideLimit.bind(provider);
    }

    if (provider.tileTextureCount) {
        layer.tileTextureCount = provider.tileTextureCount.bind(provider);
    }

    if (provider.preprocessDataLayer) {
        provider.preprocessDataLayer(layer);
    }
}

/**
 * This function adds an imagery layer to the scene. The layer id must be unique. The protocol rules wich parameters are then needed for the function.
 * @constructor
 * @param {Layer} layer.
 */
ApiGlobe.prototype.addImageryLayer = function addImageryLayer(layer) {
    preprocessLayer(layer, this.scene.scheduler.getProtocolProvider(layer.protocol));

    // assume all imageryLayer for globe use LayeredMaterial
    layer.update = updateLayeredMaterialNodeImagery;

    this.scene._geometryLayers[0].attach(layer);
    layer.type = 'color';
    layer.frozen = false;
    layer.visible = true;
    layer.opacity = 1.0;
    const colorLayerCount = this.scene.getAttachedLayers(l => l.type === 'color').length;
    layer.sequence = colorLayerCount;

    this.viewerDiv.dispatchEvent(eventLayerAdded);

    return layer;
};

/**
 * This function adds an imagery layer to the scene using a JSON file. The layer id must be unique. The protocol rules wich parameters are then needed for the function.
 * @constructor
 * @param {Layer} layer.
 * @return     {layer}  The Layer.
 */

ApiGlobe.prototype.addImageryLayerFromJSON = function addImageryLayerFromJSON(url) {
    return Fetcher.json(url).then(result => this.addImageryLayer(result));
};

/**
 * This function adds an imagery layer to the scene using an array of JSON files. The layer id must be unique. The protocol rules wich parameters are then needed for the function.
 * @constructor
 * @param {Layers} array - An array of JSON files.
 * @return     {layer}  The Layers.
 */
ApiGlobe.prototype.addImageryLayersFromJSONArray = function addImageryLayersFromJSONArray(urls) {
    const proms = [];

    for (const url of urls) {
        proms.push(Fetcher.json(url).then(layer => this.addImageryLayer(layer)));
    }

    return Promise.all(proms);
};

/**
 * Add an elevation layer to the map. Elevations layers are used to build the terrain.
 * Only one elevation layer is used, so if multiple layers cover the same area, the one
 * with best resolution is used (or the first one is resolution are identical).
 * The layer id must be unique amongst all layers already inserted.
 * The protocol rules which parameters are then needed for the function.
 * @constructor
 * @param {Layer} layer.
 */

ApiGlobe.prototype.addElevationLayer = function addElevationLayer(layer) {
    preprocessLayer(layer, this.scene.scheduler.getProtocolProvider(layer.protocol));

    // assume all elevation layer for globe use LayeredMaterial
    layer.update = updateLayeredMaterialNodeElevation;

    this.scene._geometryLayers[0].attach(layer);
    layer.type = 'elevation';
    layer.frozen = false;

    this.viewerDiv.dispatchEvent(eventLayerAdded);

    return layer;
};

/**
 * Add an elevation layer to the map using a JSON file.
 * Elevations layers are used to build the terrain.
 * Only one elevation layer is used, so if multiple layers cover the same area, the one
 * with best resolution is used (or the first one is resolution are identical).
 * The layer id must be unique amongst all layers already inserted.
 * The protocol rules which parameters are then needed for the function.
 * @constructor
 * @param {Layers} array - An array of JSON files.
* @return     {layer}  The Layers.
 */

ApiGlobe.prototype.addElevationLayersFromJSON = function addElevationLayersFromJSON(url) {
    return Fetcher.json(url).then(result => this.addElevationLayer(result));
};

/**
 * Add an elevation layer to the map using an array of JSON files.
 * Elevations layers are used to build the terrain.
 * Only one elevation layer is used, so if multiple layers cover the same area, the one
 * with best resolution is used (or the first one is resolution are identical).
 * The layer id must be unique amongst all layers already inserted.
 * The protocol rules which parameters are then needed for the function.
 * @constructor
 * @param {Layer} layer.
 * @return     {layer}  The Layers.
 */

ApiGlobe.prototype.addElevationLayersFromJSONArray = function addElevationLayersFromJSONArray(urls) {
    var proms = [];

    for (const url of urls) {
        proms.push(Fetcher.json(url).then(layer => this.addElevationLayer(layer)));
    }

    return Promise.all(proms);
};

function updateLayersOrdering(geometryLayer, imageryLayers) {
    var sequence = ImageryLayers.getColorLayersIdOrderedBySequence(imageryLayers);

    var cO = function cO(object) {
        if (object.changeSequenceLayers)
            { object.changeSequenceLayers(sequence); }
    };

    for (const node of geometryLayer.level0Nodes) {
        node.traverse(cO);
    }
}

ApiGlobe.prototype.moveLayerUp = function moveLayerUp(layerId) {
    const imageryLayers = this.scene.getAttachedLayers(l => l.type === 'color');
    const layer = this.getLayerById(layerId);
    ImageryLayers.moveLayerUp(layer, imageryLayers);
    updateLayersOrdering(this.scene._geometryLayers[0], imageryLayers);
    this.scene.renderScene3D();
};

ApiGlobe.prototype.moveLayerDown = function moveLayerDown(layerId) {
    const imageryLayers = this.scene.getAttachedLayers(l => l.type === 'color');
    const layer = this.getLayerById(layerId);
    ImageryLayers.moveLayerDown(layer, imageryLayers);
    updateLayersOrdering(this.scene._geometryLayers[0], imageryLayers);
    this.scene.renderScene3D();
};

/**
 * Moves a specific layer to a specific index in the layer list. This function has no effect if the layer is moved to its current index.
 * @constructor
 * @param      {string}  layerId   The layer's idendifiant
 * @param      {number}  newIndex   The new index
 */
ApiGlobe.prototype.moveLayerToIndex = function moveLayerToIndex(layerId, newIndex) {
    const imageryLayers = this.scene.getAttachedLayers(l => l.type === 'color');
    const layer = this.getLayerById(layerId);
    ImageryLayers.moveLayerToIndex(layer, newIndex, imageryLayers);
    updateLayersOrdering(this.scene._geometryLayers[0], imageryLayers);
    this.scene.renderScene3D();
    eventLayerChangedIndex.layerIndex = newIndex;
    eventLayerChangedIndex.layerId = layerId;
    this.viewerDiv.dispatchEvent(eventLayerChangedIndex);
};

/**
 * Removes a specific imagery layer from the current layer list. This removes layers inserted with addLayer().
 * @constructor
 * @param      {string}   id      The identifier
 * @return     {boolean}  { description_of_the_return_value }
 */
ApiGlobe.prototype.removeImageryLayer = function removeImageryLayer(id) {
    if (this.scene._geometryLayers[0].detach(id)) {
        this.scene.renderScene3D();
        eventLayerRemoved.layer = id;
        this.viewerDiv.dispatchEvent(eventLayerRemoved);
        return true;
    }

    return false;
};

/**
 * Gets the minimum zoom level of the chosen layer.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/66r8ugq0/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {index} index - The index of the layer.
 * @return     {number}  The min of the level.
 */
ApiGlobe.prototype.getMinZoomLevel = function getMinZoomLevel(index) {
    var layer = this.getImageryLayers()[index];
    if (layer && layer.zoom) {
        return layer.zoom.min;
    } else {
        var layers = this.getImageryLayers();
        let min = Infinity;
        for (var i = layers.length - 1; i >= 0; i--) {
            if (layers[i].zoom) {
                min = Math.min(min, layers[i].zoom.min);
            }
        }
        return min;
    }
};

/**
 * Gets the maximun zoom level of the chosen layer.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/y1xcqv4s/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {index} index - The index of the layer.
 * @return     {number}  The max of the level.
 */
ApiGlobe.prototype.getMaxZoomLevel = function getMaxZoomLevel(index) {
    var layer = this.getImageryLayers()[index];
    if (layer && layer.zoom) {
        return layer.zoom.max;
    } else {
        var layers = this.getImageryLayers();
        let max = 0;
        for (var i = layers.length - 1; i >= 0; i--) {
            if (layers[i].zoom) {
                max = Math.max(max, layers[i].zoom.max);
            }
        }
        return max;
    }
};

/**
 * Return the list of all layers in the scene in the order of how they are stacked on top of each other.
 * @constructor
 * @return     {layer}  The Layers.
 */
ApiGlobe.prototype.getImageryLayers = function getImageryLayers() {
    return this.scene.getAttachedLayers(layer => layer.type === 'color');
};

ApiGlobe.prototype.initProviders = function initProviders(scene) {
    var gLDebug = false; // true to support GLInspector addon

    // Register all providers
    var wmtsProvider = new WMTS_Provider({
        support: gLDebug,
    });

    scene.scheduler.addProtocolProvider('wmts', wmtsProvider);
    scene.scheduler.addProtocolProvider('wmtsc', wmtsProvider);
    scene.scheduler.addProtocolProvider('tile', new TileProvider());
    scene.scheduler.addProtocolProvider('wms', new WMS_Provider({ support: gLDebug }));
};

/**
 * Creates the scene (the globe of iTowns).
 * The first parameter is the coordinates on wich the globe will be centered at the initialization.
 * The second one is the HTML div in wich the scene will be created.
 * @constructor
 * @param {Coords} coords.
 * @params {Div} string.
 */

ApiGlobe.prototype.createSceneGlobe = function createSceneGlobe(globeLayerId, coordCarto, viewerDiv) {
    // TODO: Normalement la creation de scene ne doit pas etre ici....
    // Deplacer plus tard
    this.globeLayerId = globeLayerId;
    this.viewerDiv = viewerDiv;

    viewerDiv.addEventListener('globe-built', () => {
        if (sceneIsLoaded === false) {
            sceneIsLoaded = true;
            this.scene.currentControls().updateCameraTransformation();
            this.scene.updateScene3D();
            viewerDiv.dispatchEvent(eventLoaded);
        } else {
            viewerDiv.dispatchEvent(eventError);
        }
    }, false);

    var gLDebug = false; // true to support GLInspector addon
    var debugMode = false;

    var positionCamera = new C.EPSG_4326(coordCarto.longitude, coordCarto.latitude, coordCarto.altitude);

    this.scene = Scene(positionCamera, ellipsoidSizes(), viewerDiv, debugMode, gLDebug);

    this.initProviders(this.scene);

    this.sceneLoadedDeferred = defer();
    this.addEventListener('globe-loaded', () => {
        this.sceneLoadedDeferred.resolve();
        this.sceneLoadedDeferred = defer();
    });

    const scene = this.scene;
    const nodeInitFn = function nodeInitFn(context, layer, parent, node) {
        const imageryLayers = scene.getAttachedLayers(l => l.type === 'color');
        const elevationLayers = scene.getAttachedLayers(l => l.type === 'elevation');

        return initNewNode(context, layer, parent, node, imageryLayers, elevationLayers).then(() => {
            node.materials[0].setLightingOn(layer.lighting.enable);
            node.materials[0].uniforms.lightPosition.value = layer.lighting.position;
        });
    };

    const SSE_SUBDIVISION_THRESHOLD = 6.0;


    // init globe layer with default parameter
    const wgs84TileLayer = new GeometryLayer(globeLayerId);

    const initLayer = initTiledGeometryLayer(globeSchemeTileWMTS(globeSchemeTile1));

    wgs84TileLayer.preUpdate = (context, layer) => {
        if (layer.level0Nodes === undefined) {
            initLayer(context, layer);
        }
        preGlobeUpdate(context);
        return layer.level0Nodes;
    };
    wgs84TileLayer.update =
        processTiledGeometryNode(
            globeCulling,
            globeSubdivisionControl(18, SSE_SUBDIVISION_THRESHOLD),
            nodeInitFn);

    // provider options
    wgs84TileLayer.builder = new BuilderEllipsoidTile();

    this.scene.addGeometryLayer(wgs84TileLayer);

    const threejsLayer = this.scene.getUniqueThreejsLayer();
    wgs84TileLayer.type = 'geometry';
    wgs84TileLayer.protocol = 'tile';
    wgs84TileLayer.threejsLayer = 'threejsLayer';
    wgs84TileLayer.lighting = {
        enable: false,
        position: { x: -0.5, y: 0.0, z: 1.0 },
    };

    // enable by default
    this.scene.currentCamera().camera3D.layers.enable(threejsLayer);

    this.atmosphere = new Atmosphere();
    this.clouds = new Clouds();
    this.atmosphere.add(this.clouds);

    const atmosphereLayer = this.scene.getUniqueThreejsLayer();
    this.atmosphere.traverse((obj) => { obj.layers.set(atmosphereLayer); });
    this.scene.currentCamera().camera3D.layers.enable(atmosphereLayer);

    this.scene.gfxEngine.scene3D.add(this.atmosphere);

    // enable only globe-rendering when performing picking
    this.scene.currentControls().controlsActiveLayers = 1 << wgs84TileLayer.threejsLayer;

    return wgs84TileLayer;
};

ApiGlobe.prototype.update = function update() {
    this.scene.notifyChange(0, true);
};

ApiGlobe.prototype.setRealisticLightingOn = function setRealisticLightingOn(value) {
    const coSun = CoordStars.getSunPositionInScene(new Date().getTime(), 48.85, 2.35).normalize();

    this.lightingPos = coSun.normalize();

    const lighting = this.scene._geometryLayers[0].lighting;
    lighting.enable = value;
    lighting.position = coSun;

    this.atmosphere.updateLightingPos(coSun);
    this.atmosphere.setRealisticOn(value);
    this.clouds.updateLightingPos(coSun);
    this.clouds.setLightingOn(value);

    this.scene.updateMaterialUniform('lightingEnabled', value);
    this.scene.updateMaterialUniform('lightPosition', coSun);
    this.scene.renderScene3D();
};

/**
 * Sets the visibility of a layer. If the layer is not visible in the scene, this function will no effect until the camera looks at the layer.
 * @constructor
 * @param {id} string.
 * @params {visible} boolean.
 */

ApiGlobe.prototype.setLayerVisibility = function setLayerVisibility(layer, visible) {
    layer.visible = visible;

    if (layer.threejsLayer != undefined) {
        if (visible) {
            this.scene.camera.camera3D.layers.enable(layer.threejsLayer);
        } else {
            this.scene.camera.camera3D.layers.disable(layer.threejsLayer);
        }
    }

    this.scene.notifyChange(0, true);
    eventLayerChangedVisible.layerId = layer.id;
    eventLayerChangedVisible.visible = visible;
    this.viewerDiv.dispatchEvent(eventLayerChangedVisible);
};

/**
 * Sets the opacity of a layer. If the layer is not visible in the scene, this function will no effect until the layer becomes visible.
 * @constructor
 * @param {id} string.
 * @params {visible} boolean.
 */

ApiGlobe.prototype.setLayerOpacity = function setLayerOpacity(layer, opacity) {
    layer.opacity = opacity;
    this.scene.notifyChange(0, true);
    eventLayerChangedOpacity.layerId = layer.id;
    eventLayerChangedOpacity.opacity = opacity;
    this.viewerDiv.dispatchEvent(eventLayerChangedOpacity);
};

/**
 * Returns the orientation angles of the current camera, in degrees.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/okfj460p/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 */
ApiGlobe.prototype.getCameraOrientation = function getCameraOrientation() {
    var tiltCam = this.scene.currentControls().getTilt();
    var headingCam = this.scene.currentControls().getHeading();
    return [tiltCam, headingCam];
};

/**
 * Returns the camera location projected on the ground in lat,lon.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/mjv7ha02/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @return {Position} position
 */

ApiGlobe.prototype.getCameraLocation = function getCameraLocation() {
    var cam = this.scene.currentCamera().camera3D;
    return this.projection.cartesianToGeo(cam.position);
};

/**
 * Retuns the coordinates of the central point on screen.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/4tjgnv7z/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @return {Position} position
 */

ApiGlobe.prototype.getCenter = function getCenter() {
    var controlCam = this.scene.currentControls();
    return this.projection.cartesianToGeo(controlCam.getTargetCameraPosition());
};

/**
 * Sets orientation angles of the current camera, in degrees.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/9qr2mogh/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param      {object}   orientation  The angle of the rotation in degrees
 * @param      {boolean}  isAnimated   Indicates if animated
 * @return     {Promise}   { description_of_the_return_value }
 */
ApiGlobe.prototype.setCameraOrientation = function setCameraOrientation(orientation, isAnimated) {
    return this.scene.currentControls().setOrbitalPosition(undefined, orientation.heading, orientation.tilt, isAnimated).then(() => {
        this.viewerDiv.dispatchEvent(eventOrientation);
    });
};

/**
 * Pick a position on the globe at the given position.
 * @constructor
 * @param {Number | MouseEvent} x|event - The x-position inside the Globe element or a mouse event.
 * @param {number | undefined} y - The y-position inside the Globe element.
 * @return {Position} position
 */
ApiGlobe.prototype.pickPosition = function pickPosition(mouse, y) {
    var screenCoords = {
        x: mouse.clientX || mouse,
        y: mouse.clientY || y,
    };

    var pickedPosition = this.scene.getPickPosition(screenCoords);

    this.scene.renderScene3D();

    if (!pickedPosition) {
        return;
    }

    return this.projection.cartesianToGeo(pickedPosition);
};

/**
 * Returns the tilt in degrees.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/kcx0of9j/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @return {Angle} number - The angle of the rotation in degrees.
 */

ApiGlobe.prototype.getTilt = function getTilt() {
    var tiltCam = this.scene.currentControls().getTilt();
    return tiltCam;
};

/**
 * Returns the heading in degrees.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/pxv1Lw16/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @return {Angle} number - The angle of the rotation in degrees.
 */

ApiGlobe.prototype.getHeading = function getHeading() {
    var headingCam = this.scene.currentControls().getHeading();
    return headingCam;
};

/**
 * Returns the "range": the distance in meters between the camera and the current central point on the screen.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/Lbt1vfek/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @return {Number} number
 */

ApiGlobe.prototype.getRange = function getRange() {
    return this.scene.currentControls().getRange();
};

ApiGlobe.prototype.getRangeFromEllipsoid = function getRangeFromEllipsoid() {
    // TODO: error is distance is big with ellipsoid.intersection(ray) because d < 0
    var controlCam = this.scene.currentControls();
    var ellipsoid = this.scene.getEllipsoid();
    var ray = controlCam.getRay();
    var intersection = ellipsoid.intersection(ray);
    var camPosition = this.scene.currentCamera().position();
    var range = intersection.distanceTo(camPosition);

    return range;
};

/**
 * Sets the animation enabled.
 * @constructor
 * @param      {boolean}  enable  The enable
 */
ApiGlobe.prototype.setAnimationEnabled = function setAnimationEnabled(enable) {
    enableAnimation = enable;
};

/**
 * Determines if animation enabled.
 *
 * @return     {boolean}  True if animation enabled, False otherwise.
 */
ApiGlobe.prototype.isAnimationEnabled = function isAnimationEnabled() {
    return enableAnimation;
};

/**
 * Change the tilt.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/p6t76zox/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {Angle} Number - The angle.
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setTilt = function setTilt(tilt, isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    eventOrientation.oldTilt = this.getTilt();
    return this.scene.currentControls().setTilt(tilt, isAnimated).then(() => {
        this.viewerDiv.dispatchEvent(eventOrientation);
        this.scene.notifyChange(1);
    });
};

/**
 * Change the heading.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/rxe4xgxj/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {Angle} Number - The angle.
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setHeading = function setHeading(heading, isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    eventOrientation.oldHeading = this.getHeading();
    return this.scene.currentControls().setHeading(heading, isAnimated).then(() => {
        this.viewerDiv.dispatchEvent(eventOrientation);
        this.scene.notifyChange(1);
    });
};

/**
 * Resets camera tilt -> sets the tilt to 0°.
 * @constructor
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.resetTilt = function resetTilt(isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    return this.scene.currentControls().setTilt(0, isAnimated);
};

/**
 * Resets camera heading -> sets the heading to 0°.
 * @constructor
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.resetHeading = function resetHeading(isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    return this.scene.currentControls().setHeading(0, isAnimated);
};

/**
 * Returns the distance in meter between two geographic positions.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/0nLhws5u/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {Position} First - Position.
 * @param {Position} Second - Position.
 * @return {Number} distance
 */

ApiGlobe.prototype.setSceneLoaded = function setSceneLoaded() {
    sceneIsLoaded = false;
    return this.sceneLoadedDeferred.promise;
};

/**
 * Changes the center of the scene on screen to the specified coordinates.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/x06yhbq6/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {coordinates} coordinates - Properties : longitude and latitude
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setCenter = function setCenter(coordinates, isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    eventCenter.oldCenter = this.getCenter();
    const position3D = new C.EPSG_4326(coordinates.longitude, coordinates.latitude, 0)
        .as('EPSG:4978').xyz();
    position3D.range = coordinates.range;
    return this.scene.currentControls().setCenter(position3D, isAnimated).then(() => {
        this.scene.notifyChange(1);
        return this.setSceneLoaded().then(() => {
            this.scene.currentControls().updateCameraTransformation();
            this.viewerDiv.dispatchEvent(eventCenter);
        });
    });
};

/**
 * Changes the center of the scene on screen to the specified coordinates.
 * This function allows to change the central position, the zoom level, the range, the scale and the camera orientation at the same time.
 * The level has to be between the [getMinZoomLevel(), getMaxZoomLevel()].
 * The zoom level and the scale can't be set at the same time.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/7yk0mpn0/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {Position} pPosition - The detailed position in the scene.
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setCenterAdvanced = function setCenterAdvanced(pPosition, isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    return this.setCenter(pPosition, isAnimated).then(() => {
        const p = this.scene.currentControls().setOrbitalPosition(undefined, pPosition.heading, pPosition.tilt, isAnimated);
        return p;
    });
};

/**
 * Sets the "range": the distance in meters between the camera and the current central point on the screen.
 * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/Lt3jL5pd/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @constructor
 * @param {Number} pRange - The camera altitude.
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setRange = function setRange(pRange, isAnimated) {
    isAnimated = isAnimated || this.isAnimationEnabled();
    eventRange.oldRange = this.getRange();

    return this.scene.currentControls().setRange(pRange, isAnimated).then(() => {
        this.scene.notifyChange(1);
        this.setSceneLoaded().then(() => {
            this.scene.currentControls().updateCameraTransformation();
            this.viewerDiv.dispatchEvent(eventRange);
        });
    });
};

/**
 * Displaces the central point to a specific amount of pixels from its current position.
 * The view flies to the desired coordinate, i.e.is not teleported instantly. Note : The results can be strange in some cases, if ever possible, when e.g.the camera looks horizontally or if the displaced center would not pick the ground once displaced.
 * @constructor
 * @param      {vector}  pVector  The vector
 */
ApiGlobe.prototype.pan = function pan(pVector) {
    this.scene.currentControls().pan(pVector.x, pVector.y);
    this.scene.notifyChange(1);
    this.setSceneLoaded().then(() => {
        this.scene.currentControls().updateCameraTransformation();
        this.viewerDiv.dispatchEvent(eventPan);
    });
};

/**
 * Returns the actual zoom level. The level will always be between the [getMinZoomLevel(), getMaxZoomLevel()].
 * @constructor
 * @return     {number}  The zoom level.
 */
ApiGlobe.prototype.getZoomLevel = function getZoomLevel() {
    return this.scene.getZoomLevel();
};

/**
 * Gets the current zoom level, which is an index in the logical scales predefined for the application.
 * The higher the level, the closer to the ground.
 * The level is always in the [getMinZoomLevel(), getMaxZoomLevel()] range.
 * @constructor
 * @param      {number}  zoom    The zoom
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setZoomLevel = function setZoomLevel(zoom, isAnimated) {
    zoom = Math.max(this.getMinZoomLevel(), zoom);
    zoom = Math.min(this.getMaxZoomLevel(), zoom);
    const distance = this.scene.computeDistanceForZoomLevel(zoom, this.scene.currentCamera());
    return this.setRange(distance, isAnimated);
};

/**
 * Return the current zoom scale at the central point of the view.
 * This function compute the scale of a map
 * @constructor
 * @param      {number}  pitch   Screen pitch, in millimeters ; 0.28 by default
 * @return     {number}  The zoom scale.
 */
ApiGlobe.prototype.getZoomScale = function getZoomScale(pitch) {
    // TODO: Why error div size height in Chrome?
    // Screen pitch, in millimeters
    pitch = (pitch || 0.28) / 1000;

    // To compute scale, we must to calculate the maximum vertical distance (in meter) perceived by the camera
    // the maximum vertical distance 2xHS (look at the explanations below 'HS segment')
    // There's two state
    //     * Globe is inside the frustrum camera
    //     * Globe intersects with the frustrum camera
    const camera = this.scene.currentCamera();
    const center = this.scene.currentControls().getTargetCameraPosition();
    const rayon = center.length();
    const range = center.distanceTo(camera.camera3D.position);
    // compute distance camera/globe's center
    const distance = rayon + range;
    // Three points C,G and S
    // C : Camera's position
    // G : Globe's center
    // S : The furthest interesection[camera verical frustrum, globe surface] from line CG
    // HS is triangle CSG's altitude going through S and H is in GC segment
    // alpha is angle GCS
    // phi is angle CSG
    const alpha = camera.FOV / 180 * Math.PI * 0.5;
    const phi = Math.PI - Math.asin(distance / rayon * Math.sin(alpha));
    // projection is projection segment HS on camera
    let projection;

    if (isNaN(phi)) {
        // Globe is inside the frustrum camera
        projection = distance * 2 * Math.tan(alpha);
    } else {
        // Globe intersects with the frustrum camera

        // develop operation
        // {
        //     var beta = Math.PI - ( phi + alpha);
        //     projection = rayon * Math.sin(beta) * 2.0;
        // }
        // factorisation ->
        projection = 2.0 * rayon * Math.sin(phi + alpha);
    }

    const zoomScale = camera.height * pitch / projection;

    return zoomScale;
};

/**
 * Changes the zoom level of the central point of screen so that screen acts as a map with a specified scale.
 *  The view flies to the desired zoom scale;
 * @constructor
 * @param      {number}  zoomScale  The zoom scale
 * @param      {number}  pitch      The pitch
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
ApiGlobe.prototype.setZoomScale = function setZoomScale(zoomScale, pitch, isAnimated) {
    // Screen pitch, in millimeters
    pitch = (pitch || 0.28) / 1000;

    // To set scale, we must to calculate the maximum vertical distance (in meter) perceived by the camera
    // the maximum vertical distance 2xHS (look at the explanations below 'HS segment')
    // projection is projection segment HS on camera
    // There's two state
    //     * Globe is inside the frustrum camera
    //     * Globe intersects with the frustrum camera

    const camera = this.scene.currentCamera();
    const projection = camera.height * pitch / zoomScale;
    const rayon = this.scene.currentControls().getTargetCameraPosition().length();
    const alpha = camera.FOV / 180 * Math.PI * 0.5;
    // distance camera/globe's center
    let distance;
    // Three points C,G and S
    // C camera's position
    // G globe's center
    // S = the furthest interesection[camera verical frustrum, globe surface] from line CG
    // HS is triangle CSG's altitude going through S and H is in GC segment
    // alpha is angle GCS
    // phi is angle CSG
    // beta is angle SGC
    const sinBeta = projection / (2 * rayon);

    if (sinBeta < 1.0) {
        // Globe is inside the frustrum camera
        const beta = Math.asin(sinBeta);
        // develop operation
        //  {
        //      let phi = Math.PI - ( beta + alpha);
        //      distance  = rayon * Math.sin(phi) / Math.sin(alpha) ;
        //  }
        //  factorisation ->
        distance = rayon * Math.sin(beta + alpha) / Math.sin(alpha);
    } else {
        // Globe is inside the frustrum camera
        distance = rayon / Math.tan(alpha) * sinBeta;
    }

    const range = distance - rayon;
    return this.setRange(range, isAnimated);
};

/**
 * Some event return the old value before the change. The available events are centerchanged, zoomchanged, orientationchanged, layerchanged:opacity, layerchanged:visible, layerchanged:ipr and layerchanged:index.
 * @constructor
 * @param {string} Eventname - The name of the event.
 * @param {callback} Callback - The callback that is called when the event is heard.
 */

ApiGlobe.prototype.addEventListener = function addEventListenerProto(eventname, callback) {
    if (eventname == 'layerchanged') {
        this.viewerDiv.addEventListener('layerchanged', callback, false);
        this.addEventListenerLayerChanged();
    } else {
        this.viewerDiv.addEventListener(eventname, callback, false);
    }
};

ApiGlobe.prototype.addEventListenerLayerChanged = function addEventListenerLayerChanged() {
    this.viewerDiv.addEventListener('layerchanged:visible', this.callbackLayerChanged, false);
    this.viewerDiv.addEventListener('layerchanged:opacity', this.callbackLayerChanged, false);
    this.viewerDiv.addEventListener('layerchanged:index', this.callbackLayerChanged, false);
};

ApiGlobe.prototype.callbackLayerChanged = function callbackLayerChanged() {
    this.dispatchEvent(eventLayerChanged);
};

/**
 * Remove the event of events listener from the event target.
 * @constructor
 * @param {string} Eventname - The name of the event.
 * @param {callback} Callback - The callback that is called when the event is heard.
 */

ApiGlobe.prototype.removeEventListener = function removeEventListenerProto(eventname, callback) {
    if (eventname == 'layerchanged') {
        this.viewerDiv.removeEventListener('layerchanged', callback, false);
        this.removeEventListenerLayerChanged();
    } else {
        this.viewerDiv.removeEventListener(eventname, callback, false);
    }
};

ApiGlobe.prototype.removeEventListenerLayerChanged = function removeEventListenerLayerChanged() {
    this.viewerDiv.removeEventListener('layerchanged:visible', this.callbackLayerChanged, false);
    this.viewerDiv.removeEventListener('layerchanged:opacity', this.callbackLayerChanged, false);
    this.viewerDiv.removeEventListener('layerchanged:index', this.callbackLayerChanged, false);
};

/**
 * Get the Attribution of all layers in the scene.
 * @return {map}  A Map of attribution.
 */

ApiGlobe.prototype.getLayersAttribution = function getLayersAttribution() {
    const map = new Map();
    this.scene.getAttachedLayers().forEach((l) => {
        if (l.options.attribution) {
            map.set(l.options.attribution.name, l.options.attribution);
        }
    });
    return map;
};

/**
 * Return all the layers in the scene.
 * The type can be 'color', 'elevation' and 'geometry'. If the type is not specified, the function return all the layers.
 * @param {type} Type - The type of the layers wanted.
 */

ApiGlobe.prototype.getLayers = function getLayers(type) {
    if (type === undefined) {
        return [...this.scene._geometryLayers, ...this.scene.getAttachedLayers()];
    } else if (type == 'geometry') {
        return this.scene._geometryLayers;
    } else {
        return this.scene.getAttachedLayers(l => l.type === type);
    }
};

/**
 * Return a layer by its id.
 * @param {id} ID - The id of the layer wanted.
 */

ApiGlobe.prototype.getLayerById = function getLayerById(pId) {
    const att = this.scene.getAttachedLayers(l => l.id === pId);
    if (att.length == 1) {
        return att[0];
    }
    for (const geom of this.scene._geometryLayers) {
        if (geom.id === pId) {
            return geom;
        }
    }
    throw new Error(`No layer with id = '${pId}' found`);
};

ApiGlobe.prototype.loadGPX = function loadGPX(url) {
    loadGpx(url).then((gpx) => {
        if (gpx) {
            this.scene.gpxTracks.children[0].add(gpx);
        }
    });

    this.scene.renderScene3D();
};

export default ApiGlobe;
