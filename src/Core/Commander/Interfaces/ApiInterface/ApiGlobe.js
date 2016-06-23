/**
 * Generated On: 2015-10-5
 * Class: ApiGlobe
 * Description: Classe façade pour attaquer les fonctionnalités du code.
 */


define('Core/Commander/Interfaces/ApiInterface/ApiGlobe', [
       'Core/Commander/Interfaces/EventsManager',
       'Scene/Scene',
       'Scene/Layer',
       'Scene/NodeProcess',
       'Globe/Globe',
       'Globe/WGS84GlobeView',
       'Core/Commander/Providers/WMTS_Provider',
       'Core/Geographic/CoordCarto',
       'Core/Geographic/Projection'], function(
           EventsManager,
           Scene,
           Layer,
           NodeProcess,
           Globe,
           WMTS_Provider,
           CoordCarto,
           Projection) {

    var loaded = false;
    var eventLoaded = new Event('globe-loaded');

    function ApiGlobe() {
        //Constructor

        this.scene = null;
//        this.nodeProcess = null;
        this.commandsTree = null;
        this.projection = new Projection();
        this.viewerDiv = null;

    }

    ApiGlobe.prototype.constructor = ApiGlobe;



//    var event = new Event('empty');
//    document.addEventListener('empty', console.log('Your turn'));
//    document.dispatchEvent(event);

    /**
     * @param Command
     */
    ApiGlobe.prototype.add = function(/*Command*/) {
        //TODO: Implement Me

    };


    /**
     * @param commandTemplate
     */
    ApiGlobe.prototype.createCommand = function(/*commandTemplate*/) {
        //TODO: Implement Me

    };

    /**
     */
    ApiGlobe.prototype.execute = function() {
        //TODO: Implement Me

    };

    ApiGlobe.prototype.registerLayer = function(layer) {
        var manager = this.scene.managerCommand;
        var providers = manager.getProviders();

        for (var provider in providers) {
            if (provider.protocol === layer.protocol) {
                provider.addLayer(layer);
            }
        }
    }

    /**
    * Adds an imagery layer to the map. The layer id must be unique amongst all layers already inserted. The protocol rules which parameters are then needed for the function.
    * @constructor
    * @param {Layer} layer.
    */

    ApiGlobe.prototype.addImageryLayer = function(layer) {
        this.registerLayer(layer);
        // FIXME: assumes views[0] == GlobeView
        this.views[0].imageryLayer.push(layer);
        return;

        var map = this.scene.getMap();
        var manager = this.scene.managerCommand;
        var providerWMTS = manager.getProvider(map.tiles).providerWMTS;

        providerWMTS.addLayer(layer);
        manager.addLayer(map.colorTerrain,providerWMTS);
        map.colorTerrain.services.push(layer.id);

        var subLayer = new Layer();

        subLayer.services.push(layer.id);

        var idLayerTile = map.colorTerrain.children.length;

        subLayer.description = {style:{layerTile:idLayerTile}};

        map.colorTerrain.add(subLayer);

    };


    /**
    * Add an elevation layer to the map. Elevations layers are used to build the terrain, if there is some overlapped the best resolution is taken, if resolution is equals, the first one is used.
    * The layer id must be unique amongst all layers already inserted. The protocol rules which parameters are then needed for the function
    * @constructor
    * @param {Layer} layer.
    */

    ApiGlobe.prototype.addElevationLayer = function(layer) {
        this.registerLayer(layer);
        // FIXME: assumes views[0] == GlobeView
        this.views[0].elevationLayer.push(layer);
        return;

        var map = this.scene.getMap();
        var manager = this.scene.managerCommand;
        var providerWMTS = manager.getProvider(map.tiles).providerWMTS;

        providerWMTS.addLayer(layer);
        manager.addLayer(map.elevationTerrain,providerWMTS);
        map.elevationTerrain.services.push(layer.id);

    };

    /**
    * Gets the minimum zoom level, i.e. level at which the view is the farthest from the ground.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/66r8ugq0/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {id} id - The id of the layer.
    */

    ApiGlobe.prototype.getMinZoomLevel = function(id){
        //console.log(this.addImageryLayer().id);
        var map = this.scene.getMap();
        var manager = this.scene.managerCommand;
        var providerWMTS = manager.getProvider(map.tiles).providerWMTS;
        var layerWMTS = providerWMTS.layersWMTS;
        return layerWMTS[id].zoom.min;
    };

    ApiGlobe.prototype.getLayers = function(/*param*/){

        var map = this.scene.getMap();
        var manager = this.scene.managerCommand;
        var providerWMTS = manager.getProvider(map.tiles).providerWMTS;
        var layersWMTS = providerWMTS.layersWMTS;
        return layersWMTS;

    };

    /**
    * Gets the maximun zoom level, i.e. level at which the view is the closest from the ground.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/y1xcqv4s/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {id} id - The id of the layer.
    */

    ApiGlobe.prototype.getMaxZoomLevel = function(id){
        //console.log(this.addImageryLayer().id);
        var map = this.scene.getMap();
        var manager = this.scene.managerCommand;
        var providerWMTS = manager.getProvider(map.tiles).providerWMTS;
        var layerWMTS = providerWMTS.layersWMTS;
        return layerWMTS[id].zoom.max;
    };


    ApiGlobe.prototype.createSceneGlobe = function(coordCarto, viewerDiv) {
        // TODO: Normalement la creation de scene ne doit pas etre ici....
        // Deplacer plus tard

        viewerDiv.addEventListener('globe-builded', function(){

        //        var event = new Event('empty');
        //        document.addEventListener('empty', console.log('Your turn'));
            if(loaded == false)
            {

                loaded = true;
                viewerDiv.dispatchEvent(eventLoaded);
            }
        }
        , false);

        var gLDebug = false; // true to support GLInspector addon
        var debugMode = false;

        //gLDebug = true; // true to support GLInspector addon
        //debugMode = true;

        this.scene = Scene(coordCarto,viewerDiv,debugMode,gLDebug);

        var map = new Globe(this.scene.size,gLDebug);
        var globeView = new WGS84GlobeView();

        this.scene.add(map);
        this.scene.views.push(globeView);



        //!\\ TEMP
        //this.scene.wait(0);
        //!\\ TEMP

        return this.scene;

    };

    ApiGlobe.prototype.update = function() {

        //!\\ TEMP
        this.scene.wait(0);
        //!\\ TEMP

    };

    ApiGlobe.prototype.setLayerAtLevel = function(baseurl,layer/*,level*/) {
 // TODO CLEAN AND GENERIC
        var wmtsProvider = new WMTS_Provider({url:baseurl, layer:layer});
        this.scene.managerCommand.providerMap[4] = wmtsProvider;
        this.scene.managerCommand.providerMap[5] = wmtsProvider;
        this.scene.managerCommand.providerMap[this.scene.layers[0].node.meshTerrain.id].providerWMTS = wmtsProvider;
        this.scene.browserScene.updateNodeMaterial(wmtsProvider);
        this.scene.renderScene3D();
    };

    ApiGlobe.prototype.showClouds = function(value, satelliteAnimation) {

        this.scene.getMap().showClouds(value, satelliteAnimation);
        this.scene.renderScene3D();
    };

    ApiGlobe.prototype.setRealisticLightingOn = function(value) {

        this.scene.setLightingPos();
        this.scene.gfxEngine.setLightingOn(value);
        this.scene.getMap().setRealisticLightingOn(value);
        this.scene.browserScene.updateMaterialUniform("lightingOn",value ? 1:0);
        this.scene.renderScene3D();
    };

    ApiGlobe.prototype.setLayerVibility = function(id,visible){

        this.scene.getMap().setLayerVibility(id,visible);

        this.scene.renderScene3D();
    };

    ApiGlobe.prototype.animateTime = function(value) {

        this.scene.animateTime(value);
    };

    ApiGlobe.prototype.orbit = function(value) {

        this.scene.orbit(value);
    };
    ApiGlobe.prototype.setLayerOpacity = function(id,visible){

        this.scene.getMap().setLayerOpacity(id,visible);

        this.scene.renderScene3D();
    };

    ApiGlobe.prototype.setStreetLevelImageryOn = function(value){

        this.scene.setStreetLevelImageryOn(value);
    }

     /**
    * Gets orientation angles of the current camera, in degrees.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/okfj460p/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    */
    ApiGlobe.prototype.getCameraOrientation = function () {

        var tiltCam = this.scene.currentControls().getTilt();
        var headingCam = this.scene.currentControls().getHeading();
        return [tiltCam, headingCam];
    };

    /**
    * Get the camera location projected on the ground in lat,lon.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/mjv7ha02/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    */

    ApiGlobe.prototype.getCameraLocation = function () {
        var cam = this.scene.currentCamera().camera3D;
        return this.projection.cartesianToGeo(cam.position);
    };

    /**
    * Gets the coordinates of the current central point on screen.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/4tjgnv7z/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @return {Position} postion
    */

    ApiGlobe.prototype.getCenter = function () {

        var controlCam = this.scene.currentControls();
        return this.projection.cartesianToGeo(controlCam.globeTarget.position);
    };

    /**
    * Gets orientation angles of the current camera, in degrees.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/9qr2mogh/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Orientation} Param - The angle of the rotation in degrees.
    */

    ApiGlobe.prototype.setCameraOrientation = function (orientation /*param,pDisableAnimationopt*/) {

        this.setHeading(orientation.heading);
        this.setTilt(orientation.tilt);
    };

    /**
    * Pick a position on the globe at the given position.
    * @constructor
    * @param {Number | MouseEvent} x|event - The x-position inside the Globe element or a mouse event.
    * @param {number | undefined} y - The y-position inside the Globe element.
    * @return {Position} postion
    */
    ApiGlobe.prototype.pickPosition = function (mouse,y) {

        if(mouse)
            if(mouse.clientX)
            {
                mouse.x = mouse.clientX;
                mouse.y = mouse.clientY;
            }
            else
            {
                mouse.x = mouse;
                mouse.y = y;
            }

        var pickedPosition = this.scene.getPickPosition(mouse);

        this.scene.renderScene3D();

        return this.projection.cartesianToGeo(pickedPosition);
    };

    /**
    * Get the tilt.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/kcx0of9j/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @return {Angle} number - The angle of the rotation in degrees.
    */

    ApiGlobe.prototype.getTilt = function (){

        var tiltCam = this.scene.currentControls().getTilt();
        return tiltCam;
    };

    /**
    * Get the Heading.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/pxv1Lw16/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @return {Angle} number - The angle of the rotation in degrees.
    */

    ApiGlobe.prototype.getHeading = function (){

        var headingCam = this.scene.currentControls().getHeading();
        return headingCam;
    };

    /**
    * Get the "range", i.e. distance in meters of the camera from the center.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/Lbt1vfek/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @return {Number} number
    */

    ApiGlobe.prototype.getRange = function (){

        var controlCam = this.scene.currentControls();
        var ellipsoid = this.scene.getEllipsoid();
        var ray = controlCam.getRay();

        var intersection = ellipsoid.intersection(ray);

//        var center = controlCam.globeTarget.position;
        var camPosition = this.scene.currentCamera().position();
        // var range = center.distanceTo(camPosition);
        var range = intersection.distanceTo(camPosition);

        return range;
    };

    /**
    * Change the tilt.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/p6t76zox/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Angle} Number - The angle.
    * @param {Boolean} [pDisableAnimation] - Used to force the non use of animation if its enable.
    */

    ApiGlobe.prototype.setTilt = function (tilt/*, bool*/) {

        this.scene.currentControls().setTilt(tilt);
    };

    /**
    * Change the heading.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/rxe4xgxj/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Angle} Number - The angle.
    * @param {Boolean} [pDisableAnimation] - Used to force the non use of animation if its enable.
    */

    ApiGlobe.prototype.setHeading = function (heading/*, bool*/){

        this.scene.currentControls().setHeading(heading);
    };

    /**
    * Resets camera tilt.
    * @constructor
    * @param {Boolean} [pDisableAnimation] - Used to force the non use of animation if its enable.
    */

    ApiGlobe.prototype.resetTilt = function (/*bool*/) {

        this.scene.currentControls().setTilt(0);
    };

    /**
    * Resets camera heading.
    * @constructor
    * @param {Boolean} [pDisableAnimation] - Used to force the non use of animation if its enable.
    */

    ApiGlobe.prototype.resetHeading = function (/*bool*/) {

        this.scene.currentControls().setHeading(0);
    };

    /**
    * Return the distance in meter between two geographic position.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/0nLhws5u/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Position} First - Position.
    * @param {Position} Second - Position.
    */

    ApiGlobe.prototype.computeDistance = function(p1,p2){
        return this.scene.getEllipsoid().computeDistance(new CoordCarto().setFromDegreeGeo(p1.longitude, p1.latitude, p1.altitude),new CoordCarto().setFromDegreeGeo(p2.longitude, p2.latitude, p2.altitude));
    };

    /**
    * Moves the central point on screen to specific coordinates.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/x06yhbq6/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Position} position - The position on the map.
    */

    ApiGlobe.prototype.setCenter = function (position) {
//        var position3D = this.scene.getEllipsoid().cartographicToCartesian(position);
        var position3D = this.scene.getEllipsoid().cartographicToCartesian(new CoordCarto().setFromDegreeGeo(position.longitude, position.latitude, position.altitude));
        this.scene.currentControls().setCenter(position3D);
    };

    /**
    * Moves the central point on screen to specific coordinates while changing the zoom and / or the orientation at the same time. Whenever the map center and zoom should be changed at the same time, or the map center and orientation, or the three of them, then setCenterAdvanced() should always be called instead of separate calls of setCenter(), setZoomLevel(), setZoomScale() or setCameraOrientation(). The level must be in the[getMinZoomLevel(), getMaxZoomLevel()] range.The scale must be a positive integer, as a zoom scale denominator integer, e.g. for 1 / 500 the value must be 500, not 0.002.Zoom level and scale can not be set at the same time. Orientation can select heading and tilt angles like setCameraOrientation(). The view flies to the desired coordinate, i.e.is not teleported instantly.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/7yk0mpn0/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Position} pPosition - The position on the map.
    * @param {Boolean} [pDisableAnimation] - Used to force the non use of animation if its enable.
    */

    ApiGlobe.prototype.setCenterAdvanced = function (pPosition/*, pDisableAnimationopt*/ ){
        this.setCenter(pPosition.position);
        this.setRange(pPosition.range);
        this.setHeading(pPosition.heading);
        this.setTilt(pPosition.tilt);
    };

    /**
    * Set the "range", i.e. distance in meters of the camera from the center.
    * <iframe width="100%" height="400" src="//jsfiddle.net/iTownsIGN/Lt3jL5pd/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
    * @constructor
    * @param {Number} pRange - The camera altitude.
    * @param {Boolean} [pDisableAnimation] - Used to force the non use of animation if its enable.
    */

    ApiGlobe.prototype.setRange = function (pRange/*, bool*/){

        this.scene.currentControls().setRange(pRange);
    };

    ApiGlobe.prototype.getZoomLevel = function (){
        return this.scene.getZoomLevel();
    };

    ApiGlobe.prototype.launchCommandApi = function () {
//        console.log(this.getMinZoomLevel("IGNPO"));
//        console.log(this.getMaxZoomLevel("IGN_MNT"));
//        console.log(this.getCenter());
//        console.log(this.getCameraLocation());
//        console.log(this.getCameraOrientation());
//        console.log(this.getZoomLevel());
//        console.log(this.pickPosition());
//        console.log(this.getTilt());
//        console.log(this.getHeading());
//       console.log(this.getRange());
//        this.setTilt(45);
//        this.setHeading(180);
//        this.resetTilt();
//        this.resetHeading();
//        var p1 = new CoordCarto(2.4347047,48.8472568,0);
//        var p2 = new CoordCarto(2.4345599,48.8450221,0);
//        console.log(this.computeDistance({longitude:2.4347047,latitude:48.8472568,altitude:0},{longitude:2.4345599,latitude:48.8450221,altitude:0}));

        //var p = new CoordCarto(-74.0059700 ,40.7142700,0); //NY

//        var p = new CoordCarto().setFromDegreeGeo(coordCarto.lon, coordCarto.lat, coordCarto.alt))
//        var p = new CoordCarto().setFromDegreeGeo(2,20,0); //NY
//
//        this.setCenter(p);
//        var p2 = new CoordCarto().setFromDegreeGeo(2.4347047,48.8472568,0); //Paris
//        this.setCenter(p2);
//        this.setCenter({lon:-74,lat:40, alt:0});
//        this.testTilt();
//        this.testHeading();
        //console.log("range 1  " + this.getRange());
//        this.setRange(1000);
//        console.log(this.getRange());
//        this.setCameraOrientation({heading:45,tilt:30});
//        this.setCenterAdvanced({position:p2, /*range:10000,*/ heading:180, tilt:70});
    };

//    ApiGlobe.prototype.testTilt = function (){
//        this.setTilt(45);
//        console.log(this.getTilt());
//        this.resetTilt();
//        console.log(this.getTilt());
//    };
//
//    ApiGlobe.prototype.testHeading = function (){
//        this.setHeading(90);
//        console.log(this.getHeading());
//        this.resetHeading();
//        console.log(this.getHeading());
//    };

    ApiGlobe.prototype.showKML = function(value) {

        this.scene.getMap().showKML(value);
        this.scene.renderScene3D();
    };


    return ApiGlobe;

});
