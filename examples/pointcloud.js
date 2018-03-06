/* global itowns, debug, dat, setupLoadingScreen */
function line(color) {
    var measureLineGeometry = new itowns.THREE.Geometry();
    measureLineGeometry.vertices = [
        new itowns.THREE.Vector3(), new itowns.THREE.Vector3()
    ];
    var measureLine = new itowns.THREE.Line(measureLineGeometry,
        new itowns.THREE.LineBasicMaterial({ color }));
    measureLine.frustumCulled = false;
    measureLine.material.depthTest = false;
    measureLine.material.transparent = true;
    return measureLine;
}

function MeasureTool(view, pointcloud) {
    var lines = [];

    lines.push(line(0x0));
    lines.push(line(0x0000FF));
    lines.push(line(0xFFFF00));

    view.scene.add(lines[0], lines[1], lines[2]);

    this.enabled = false;
    this.validMeasure = false;

    var tooltips = document.getElementsByClassName('measure');

    this.onMouseDown = (evt) => {
        var i;
        var pick = view.pickObjectsAt(event, pointcloud);
        if (pick.length > 0) {
            for (i = 0; i < lines.length; i++) {
                lines[i].position.copy(pick[0].object.position);
                lines[i].scale.copy(pick[0].object.scale);
                lines[i].geometry.vertices[0].fromArray(
                    pick[0].object.geometry.attributes.position.array,
                    pick[0].index * 3);
                lines[i].geometry.vertices[1].copy(lines[i].geometry.vertices[0]);
                lines[i].geometry.verticesNeedUpdate = true;
                lines[i].updateMatrixWorld();
                lines[i].visible = true;
            }
            view.notifyChange(true);

            this.firstPointSelected = true;
        } else {
            this.validMeasure = false;
        }
    };

    this.updateTooltipsPosition = () => {
        if (!this.validMeasure) {
            for (let i = 0; i < 3; i++) {
                tooltips[i].style.display = 'none';
            }
            return;
        }

        for (let i = 0; i < 3; i++) {
            var center = lines[i].geometry.vertices[0].clone()
                .add(lines[i].geometry.vertices[1])
                .multiplyScalar(0.5)
                .applyMatrix4(lines[i].matrixWorld)
                .applyMatrix4(view.camera._viewMatrix);

            tooltips[i].style.left = view.normalizedToViewCoords(center).x + 'px';
            tooltips[i].style.top = view.normalizedToViewCoords(center).y + 'px';
        }
    };

    this.onMouseMove = (evt) => {
        if (!this.firstPointSelected) {
            return;
        }
        var pick = view.pickObjectsAt(event, pointcloud);
        if (pick.length) {
            this.validMeasure = true;
            // Full line
            lines[0].geometry.vertices[1].fromArray(
                pick[0].object.geometry.attributes.position.array,
                pick[0].index * 3);
            lines[0].geometry.vertices[1].applyMatrix4(pick[0].object.matrixWorld);
            var m = new itowns.THREE.Matrix4().getInverse(lines[0].matrixWorld);
            lines[0].geometry.vertices[1].applyMatrix4(m);
            lines[0].geometry.verticesNeedUpdate = true;

            // Vertical line
            lines[1].geometry.vertices[1].copy(lines[0].geometry.vertices[0]);
            lines[1].geometry.vertices[1].z = lines[0].geometry.vertices[1].z;

            // XY line
            lines[2].geometry.vertices[0].z = lines[0].geometry.vertices[1].z;
            lines[2].geometry.vertices[1].copy(lines[0].geometry.vertices[1]);

            for (let i = 1; i < 3; i++) {
                lines[i].geometry.verticesNeedUpdate = true;
            }

            view.notifyChange(true);

            for (let i = 0; i < 3; i++) {
                var distance = lines[i].geometry.vertices[0]
                    .clone()
                    .sub(lines[i].geometry.vertices[1])
                    .multiply(lines[i].scale)
                    .length();

                lines[i].geometry.computeLineDistances();
                lines[i].geometry.lineDistancesNeedUpdate = true;

                // update tooltip
                tooltips[i].textContent = `${distance.toFixed(2)} m`;
                tooltips[i].style.display = 'block';
            }
        }
        this.updateTooltipsPosition();

    };
    this.onMouseUp = (evt) => {
        this.firstPointSelected = undefined;
    };
}

// eslint-disable-next-line no-unused-vars
function showPointcloud(serverUrl, fileName, lopocsTable) {
    var pointcloud;
    var oldPostUpdate;
    var viewerDiv;
    var debugGui;
    var view;
    var controls;

    viewerDiv = document.getElementById('viewerDiv');
    viewerDiv.style.display = 'block';

    itowns.THREE.Object3D.DefaultUp.set(0, 0, 1);

    itowns.proj4.defs('EPSG:3946',
        '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 ' +
        '+y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

    debugGui = new dat.GUI({ width: 400 });

    // TODO: do we really need to disable logarithmicDepthBuffer ?
    view = new itowns.View('EPSG:3946', viewerDiv, { renderer: { logarithmicDepthBuffer: true } });
    setupLoadingScreen(viewerDiv, view);
    view.mainLoop.gfxEngine.renderer.setClearColor(0xcccccc);

    // Configure Point Cloud layer
    pointcloud = new itowns.GeometryLayer('pointcloud', new itowns.THREE.Group());
    pointcloud.file = fileName || 'infos/sources';
    pointcloud.protocol = 'potreeconverter';
    pointcloud.url = serverUrl;
    pointcloud.table = lopocsTable;

    // point selection on double-click
    function dblClickHandler(event) {
        var pick = view.pickObjectsAt(event, pointcloud);

        if (pick.length) {
            console.log('Selected point #' + pick[0].index + ' in Points "' + pick[0].object.owner.name + '"');
        }
    }
    view.mainLoop.gfxEngine.renderer.domElement.addEventListener('dblclick', dblClickHandler);


    function placeCamera(position, lookAt) {
        view.camera.camera3D.position.set(position.x, position.y, position.z);
        view.camera.camera3D.lookAt(lookAt);
        // create controls
        controls = new itowns.FirstPersonControls(view,
            {
                focusOnClick: true,
                disableEventListeners: true
            });
        const measure = new MeasureTool(view, pointcloud);

        debugGui.add(controls.options, 'moveSpeed', 1, 100).name('Movement speed');
        debugGui.add(measure, 'enabled').name('Measure Tool');

        var domElement = view.mainLoop.gfxEngine.renderer.domElement;
        domElement.addEventListener('mousedown', (evt) => {
            if (measure.enabled) {
                measure.onMouseDown(evt);
            } else {
                controls.onMouseDown(evt);
            }
        }, false);
        domElement.addEventListener('touchstart', (evt) => {
            if (measure.enabled) {
                measure.onMouseDown(evt);
            } else {
                controls.onMouseDown(evt);
            }
        }, false);
        domElement.addEventListener('mousemove', (evt) => {
            if (measure.enabled) {
                measure.onMouseMove(evt);
            } else {
                controls.onMouseMove(evt);
            }
        }, false);
        domElement.addEventListener('touchmove', (evt) => {
            if (measure.enabled) {
                measure.onMouseMove(evt);
            } else {
                controls.onMouseMove(evt);
            }
        }, false);
        domElement.addEventListener('mouseup', (evt) => {
            if (measure.enabled) {
                measure.onMouseUp(evt);
            } else {
                controls.onMouseUp(evt);
            }
        }, false);
        domElement.addEventListener('touchend', (evt) => {
            if (measure.enabled) {
                measure.onMouseUp(evt);
            } else {
                controls.onMouseUp(evt);
            }
        }, false);
        domElement.addEventListener('keyup', (evt) => {
            if (!measure.enabled) {
                controls.onKeyUp(evt);
            }
        }, true);
        domElement.addEventListener('keydown', (evt) => {
            if (!measure.enabled) {
                controls.onKeyDown(evt);
            }
        }, true);
        domElement.addEventListener('mousewheel', (evt) => {
            if (!measure.enabled) {
                controls.onMouseWheel(evt);
            }
        }, false);
        domElement.addEventListener('DOMMouseScroll', (evt) => {
            if (!measure.enabled) {
                controls.onMouseWheel(evt);
            }
        }, false); // firefox

        view.addFrameRequester(itowns.MAIN_LOOP_EVENTS.UPDATE_END, () => {
            measure.updateTooltipsPosition();
        });

        view.notifyChange(true);
    }

    // add pointcloud to scene
    function onLayerReady() {
        var ratio;
        var position;
        var lookAt;

        debug.PointCloudDebug.initTools(view, pointcloud, debugGui);

        view.camera.camera3D.far = 2.0 * pointcloud.root.bbox.getSize().length();

        ratio = pointcloud.root.bbox.getSize().x / pointcloud.root.bbox.getSize().z;
        position = pointcloud.root.bbox.min.clone().add(
            pointcloud.root.bbox.getSize().multiply({ x: 0, y: 0, z: ratio * 0.5 }));
        lookAt = pointcloud.root.bbox.getCenter();
        lookAt.z = pointcloud.root.bbox.min.z;
        placeCamera(position, lookAt);
        controls.moveSpeed = pointcloud.root.bbox.getSize().length() / 3;

        // update stats window
        oldPostUpdate = pointcloud.postUpdate;
        pointcloud.postUpdate = function postUpdate() {
            var info = document.getElementById('info');
            oldPostUpdate.apply(pointcloud, arguments);
            info.textContent = 'Nb points: ' +
                pointcloud.counters.displayedCount.toLocaleString() + ' (' +
                Math.floor(100 * pointcloud.counters.displayedCount / pointcloud.counters.pointCount) + '%) (' +
                view.mainLoop.gfxEngine.renderer.info.memory.geometries + ')';
        };
        window.view = view;
    }

    view.addLayer(pointcloud).then(onLayerReady);
}
