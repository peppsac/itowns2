/**
 * Generated On: 2015-10-5
 * Class: NodeProcess
 * Description: NodeProcess effectue une opération sur un Node.
 */

define('Scene/NodeProcess',
    ['Scene/BoundingBox',
     'Renderer/Camera',
     'Core/Math/MathExtented',
     'Core/Commander/InterfaceCommander',
     'THREE',
     'Core/defaultValue',
     'when'
], function(BoundingBox, Camera, MathExt, InterfaceCommander, THREE, defaultValue, when) {


    function NodeProcess(camera, size, globe, tileBuilder, bbox) {
        //Constructor
        this.globe = globe;
        this.camera = new Camera();
        this.camera.camera3D = camera.camera3D.clone();
        this.tileBuilder = tileBuilder;

        this.bbox = defaultValue(bbox, new BoundingBox(MathExt.PI_OV_TWO + MathExt.PI_OV_FOUR, MathExt.PI + MathExt.PI_OV_FOUR, 0, MathExt.PI_OV_TWO));

        this.vhMagnitudeSquared = 1.0;

        this.r = defaultValue(size, new THREE.Vector3());
        this.cV = new THREE.Vector3();

    }

    /**
     * @documentation: Apply backface culling on node, change visibility; return true if the node is visible
     * @param {type} node   : node to cull
     * @param {type} camera : camera for the culling
     * @returns {Boolean}
     */
    NodeProcess.prototype.backFaceCulling = function(node, camera) {
        var normal = camera.direction;
        for (var n = 0; n < node.normals().length; n++) {

            var dot = normal.dot(node.normals()[n]);
            if (dot > 0) {
                node.visible = true;
                return true;
            }
        }

        //??node.visible = true;

        return node.visible;

    };

    NodeProcess.prototype.updateCamera = function(camera) {
        this.camera = new Camera(camera.width, camera.height);
        this.camera.camera3D = camera.camera3D.clone();
    };

    /**
     * @documentation:
     * @param  {type} node  : the node to try to cull
     * @param  {type} camera: the camera used for culling
     * @return {Boolean}      the culling attempt's result
     */
    NodeProcess.prototype.isCulled = function(node, camera) {
        return !( this.frustumCullingOBB(node, camera)&&this.horizonCulling(node, camera));
    };

    /**
     * @documentation: Cull node with frustrum
     * @param {type} node   : node to cull
     * @param {type} camera : camera for culling
     * @returns {unresolved}
     */
    NodeProcess.prototype.frustumCulling = function(node, camera) {
        var frustum = camera.frustum;

        return frustum.intersectsObject(node);
    };

    NodeProcess.prototype.checkSSE = function(node, camera) {

        return camera.SSE(node) > 6.0 || node.level <= 2;

    };

    NodeProcess.prototype.updateElevationTexture = function(node, elevationLayers) {
        node.texturesNeeded =+ 1;

        // FIXME
        // Init elevation with parent's elevation if available
        if (node.currentElevation === -1 && elevationLayers[0].zoom.min < node.level) {
            node.setTextureElevation(-2);
            return;
        }

        // We use 1 texture for elevation. Use the first available
        for (var i=0; i<elevationLayers.length; i++) {
            var layer = elevationLayers[i];

            if (node.level > layer.zoom.max) {
                continue;
            }
            // FIXME: layer might not cover the geographic area of tile
            // request new texture
            var args = {
                destination: 0,
                layer: layer
            };
            this.globe.interCommand.request(args, node).then(function(terrain) {
                node.setTextureElevation(terrain);
            });

            break;
        }
    };


    NodeProcess.prototype.updateImageryTexture = function(node, imageryLayers, params /* REMOVE */) {
        // TODO: Request parent's texture if no texture at all
        var lookAtAncestor = node.material.getLevelLayerColor(1) === -1;

        var promises = [];
        var paramMaterial = [];
        for (var i = 0; i < imageryLayers.length; i++) {

            var layer = imageryLayers[i];

            if (layer.zoom.min <= node.level && node.level <= layer.zoom.max) {
                var args = {
                    destination: 1,
                    layer: layer
                };
                var promise = this.globe.interCommand.request(args, node);
                promises.push(promise);
            }
        }

        // FIXME: we could assign individual texture as soon as the corresponding
        // promise finished
        if (promises.length > 0) {
            when.all(promises).then(function(colorTextures) {
                // colorTextures is an array of arrays of texture
                node.setTexturesLayer(colorTextures, 1);
            });
        }
    };

    /**
     * @documentation: Compute screen space error of node in function of camera
     * @param {type} node
     * @param {type} camera
     * @returns {Boolean}
     */
    NodeProcess.prototype.SSE = function(node, camera, params) {

        var sse = this.checkSSE(node, camera);
        var args;
        var i;

        if (sse) {  // SSE too big: display or load children
            if (params.withUp) {
                // request level up
                if(node.noChild()) {
                    bboxes = params.tree.subdivide(node);
                    node.pendingSubdivision = true;

                    for(i = 0; i < bboxes.length; i++) {
                        // Create child tile
                        var childtile = this.tileBuilder.buildTile(
                            node,
                            bboxes[i],
                            this.globe);
                        // Add as child of node
                        node.add(childtile);
                        node.updateMatrix();
                        node.updateMatrixWorld();


                        this.updateElevationTexture(childtile, this.globe.elevationLayers);
                        // TODO: Request parent's texture if no texture at all
                        this.updateImageryTexture(childtile, this.globe.imageryLayers);
                    }
                }
            }
            node.setDisplayed(
                node.children.length === 0);
        } else {    // SSE good enough: display node and put it to the right scale if necessary
            if (params.withUp) {
                // FIXME: how does this work with N color/elevation layers??
                // find downscaled layer
                var id = node.getDownScaledLayer();

                // FIXME: TODO

                // if(id !== undefined) {
                //     // update downscaled layer to appropriate scale
                //     args = {layer : params.tree.children[id+1], subLayer : id};
                //     params.tree.interCommand.request(args, node);
                // }

                if (id === 0) {
                    this.updateElevationTexture(node, this.globe.elevationLayers);
                } else if (id === 1) {
                    this.updateImageryTexture(node, this.globe.imageryLayers);
                }
            }


            // display node and hide children
            for (i = 0; i < node.children.length; i++) {
                var child = node.children[i];
                child.setDisplayed(false);
            }

            node.setDisplayed(true);
        }
    };

    /**
     * @documentation: Cull node with frustrum and oriented bounding box of node
     * @param {type} node
     * @param {type} camera
     * @returns {NodeProcess_L7.NodeProcess.prototype.frustumCullingOBB.node@pro;camera@call;getFrustum@call;intersectsBox}
     */

    var quaternion = new THREE.Quaternion();

    NodeProcess.prototype.frustumCullingOBB = function(node, camera) {
        //position in local space
        var position = node.OBB().worldToLocal(camera.position().clone());
        position.z -= node.distance;
        this.camera.setPosition(position);
        // rotation in local space
        quaternion.multiplyQuaternions( node.OBB().quadInverse(), camera.camera3D.quaternion);
        this.camera.setRotation(quaternion);

        return this.camera.getFrustum().intersectsBox(node.OBB().box3D);
    };

    /**
     * @documentation: Cull node with frustrum and the bounding box of node
     * @param {type} node
     * @param {type} camera
     * @returns {unresolved}
     */
    NodeProcess.prototype.frustumBB = function(node/*, camera*/) {

        return node.bbox.intersect(this.bbox);

    };

    /**
     * @documentation: Pre-computing for the upcoming processes
     * @param  {type} camera
     */
    NodeProcess.prototype.prepare = function(camera) {
        this.preHorizonCulling(camera);
    };

    /**
     * @documentation:pre calcul for horizon culling
     * @param {type} camera
     * @returns {undefined}
     */
    NodeProcess.prototype.preHorizonCulling = function(camera) {

        this.cV = MathExt.divideVectors(camera.position(), this.r);

        this.vhMagnitudeSquared = MathExt.lenghtSquared(this.cV) - 1.0;

    };

    /**
     * @documentation: return true if point is occuled by horizon
     * @param {type} point
     * @returns {Boolean}
     */
    NodeProcess.prototype.pointHorizonCulling = function(point) {

        var t = MathExt.divideVectors(point, this.r);

        // Vector VT
        var vT = new THREE.Vector3();
        vT.subVectors(t, this.cV);

        var vtMagnitudeSquared = MathExt.lenghtSquared(vT);

        var dot = -vT.dot(this.cV);

        var isOccluded = dot > this.vhMagnitudeSquared &&
            dot * dot / vtMagnitudeSquared > this.vhMagnitudeSquared;

        return isOccluded;
    };

    /**
     * @documentation: cull node with horizon
     * @param {type} node
     * @returns {Boolean}
     */
    var center = new THREE.Vector3();

    NodeProcess.prototype.horizonCulling = function(node) {

        // horizonCulling Oriented bounding box
        var points = node.OBB().pointsWorld;
        center.setFromMatrixPosition(node.matrixWorld);
        var isVisible = false;
        for (var i = 0, max = points.length; i < max; i++) {
            var point = points[i].add(center);

            if (!this.pointHorizonCulling(point)) {
                isVisible = true;
                break;
            }
        }

        /*
         var points    = node.geometry.tops;
         var isVisible = false;
         for (var i = 0, max = points.length; i < max; i++)
         {
               if(!this.pointHorizonCulling(points[i]))
               {
                   isVisible = true;
                   break;
               }
         }
         */

        return isVisible;
        //      if(isVisible === false)
        //          node.tMat.setDebug(1);
        //      else
        //          node.tMat.setDebug(0);
        //

    };


    return NodeProcess;

});
