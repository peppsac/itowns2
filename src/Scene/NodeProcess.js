/**
 * Generated On: 2015-10-5
 * Class: NodeProcess
 * Description: NodeProcess effectue une opération sur un Node.
 */

import BoundingBox from 'Scene/BoundingBox';
import MathExt from 'Core/Math/MathExtented';
import * as THREE from 'three';
import defaultValue from 'Core/defaultValue';
import Projection from 'Core/Geographic/Projection';
import RendererConstant from 'Renderer/RendererConstant';
import { chooseNextLevelToFetch, LayerUpdateState} from 'Scene/LayerUpdateStrategy';
import { CancelledCommandException } from 'Core/Commander/ManagerCommands';
import {l_ELEVATION, l_COLOR} from 'Globe/TileMesh';

function NodeProcess(camera, ellipsoid, bbox) {
    //Constructor

    this.bbox = defaultValue(bbox, new BoundingBox(MathExt.PI_OV_TWO + MathExt.PI_OV_FOUR, MathExt.PI + MathExt.PI_OV_FOUR, 0, MathExt.PI_OV_TWO));

    this.vhMagnitudeSquared = 1.0;

    this.r = defaultValue(ellipsoid.size, new THREE.Vector3());
    this.cV = new THREE.Vector3();
    this.projection = new Projection();

    if (__DEV__) {
        this.counters = {
            network_failure: 0
        };
    }
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

/**
 * @documentation:
 * @param  {type} node  : the node to try to cull
 * @param  {type} camera: the camera used for culling
 * @return {Boolean}      the culling attempt's result
 */
NodeProcess.prototype.isCulled = function(node, camera) {
    return !(this.frustumCullingOBB(node, camera) && this.horizonCulling(node, camera));
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

NodeProcess.prototype.checkNodeSSE = function(node) {
    return 6.0 < node.sse || node.level <= 2;
};

NodeProcess.prototype.subdivideNode = function(node, camera, params) {
    if (!node.pendingSubdivision && node.noChild()) {
        var bboxes = params.tree.subdivideNode(node);
        node.pendingSubdivision = true;

        if (__DEV__) {
            node.materials[0].uniforms.borderColor.value = [1.0, 0.0, 0.0];
        }

        for (var i = 0; i < bboxes.length; i++) {
            var args = {
                layer: params.layersConfig.getGeometryLayers()[0],
                bbox: bboxes[i]
            };
            var quadtree = params.tree;

            quadtree.interCommand.request(args, node).then(function(child) {
                var colorTextureCount = 0;
                var paramMaterial = [];
                var layer;
                var j;

                child.matrixSet = [];


                // update wmts
                var colorLayers = params.layersConfig.getColorLayers();
                for (j = 0; j < colorLayers.length; j++) {
                    layer = colorLayers[j];
                    var tileMatrixSet = layer.options.tileMatrixSet;

                    if (tileMatrixSet && !child.matrixSet[tileMatrixSet]) {
                        child.matrixSet[tileMatrixSet] = this.projection.getCoordWMTS_WGS84(child.tileCoord, child.bbox, tileMatrixSet);
                    }

                    if (layer.tileInsideLimit(child, layer)) {
                        paramMaterial.push({
                            tileMT: tileMatrixSet,
                            layerTexturesOffset: colorTextureCount,
                            visible: params.layersConfig.isColorLayerVisible(layer.id),
                            opacity: params.layersConfig.getColorLayerOpacity(layer.id),
                            fx: layer.fx,
                            idLayer: layer.id
                        });

                        if(tileMatrixSet) {
                            var bcoord = child.matrixSet[tileMatrixSet];
                            colorTextureCount += bcoord[1].row - bcoord[0].row + 1;
                        } else {
                            colorTextureCount += 1;
                        }
                    }
                }
                var elevationLayers = params.layersConfig.getElevationLayers();
                var canHaveElevation = false;
                for (j = 0; j < elevationLayers.length; j++) {
                    layer = elevationLayers[j];
                    tileMatrixSet = layer.options.tileMatrixSet;

                    if (tileMatrixSet && !child.matrixSet[tileMatrixSet]) {
                        child.matrixSet[tileMatrixSet] = this.projection.getCoordWMTS_WGS84(child.tileCoord, child.bbox, tileMatrixSet);
                    }
                    canHaveElevation |= layer.tileInsideLimit(child, layer);
                }

                child.setColorLayerParameters(paramMaterial);
                child.texturesNeeded = colorTextureCount + canHaveElevation;

                // request layers (imagery/elevation) update
                this.refineNodeLayers(child, camera, params);

                return 0;
            }.bind(this), function(err) { console.error("oops " + err); });
        }
    }
};

function refinementCommandCancellationFn(cmd) {
    if (!cmd.requester.parent || !cmd.requester.material) {
        return true;
    }
    // If node A is divided into A1, A2, A3, A4 and the user zooms fast enough on A2
    // We might end up in a situation where:
    //    - commands for A1, A3 or A4 are canceled because they're not visible anymore
    //    - A2 A2 cannot be displayed because A won't be hidden until all of its
    //      children are loaded.

    // allow cancellation of the command if the node isn't visible anymore
    return cmd.requester.parent.childrenLoaded() &&
        cmd.requester.visible === false &&
        2 <= cmd.requester.level;
}

NodeProcess.prototype.refineNodeLayers = function(node, camera, params) {
    // Elevation and Imagery u pdates require separate functions (for now):
    //   * a node can only have 1 elevation texture
    //   * a node inherits elevation texture from parent, even if tileInsideLimit(node)
    //     returns false
    //   * elevation uses a grouping strategy (see TileMesh.levelElevation)
    const layerFunctions = [
        updateNodeElevation.bind(this),
        updateNodeImagery.bind(this)
    ];

    for (let i=0; i<2; i++) {
        if (!node.loaded || node.isLayerTypeImprovable(i)) {
            layerFunctions[i](params.tree, node, params.layersConfig, !node.loaded);
        }
    }
};

NodeProcess.prototype.hideNodeChildren = function(node) {
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        child.setDisplayed(false);
    }
};

/**
 * Return an ancestor of node if it has a texture for this layer
 * that matches its level (not downsampled).
 * Returns null otherwise
 */
function findAncestorWithValidTextureForLayer(node, layerType, layer) {
    var parent = node.parent;
    if (parent && parent.material && parent.material.getLayerTextureOffset) {
        var slot = layerType == l_ELEVATION ? 0 : parent.material.getLayerTextureOffset(layer.id);
        if (slot < 0) {
            return null;
        } else {
            let level = parent.material.getLayerLevel(layerType, slot);
            if (0 <= level) {
                // Return tile at this level  - because parent may have use texture from an ancestor as well
                return node.getNodeAtLevel(level);
            } else {
                return findAncestorWithValidTextureForLayer(parent, layerType, layer);
            }
        }
    } else {
        return null;
    }
}

function updateNodeImagery(quadtree, node, layersConfig, force) {
    let promises = [];

    const ts = Date.now();
    const colorLayers = layersConfig.getColorLayers();
    for (let i = 0; i < colorLayers.length; i++) {
        let layer = colorLayers[i];

        // is tile covered by this layer?
        // We test early (rather than after chooseNextLevelToFetch like elevation)
        // because colorParams only exist for tiles where tileInsideLimit is true
        // (see `subdivideNode`)
        if (!layer.tileInsideLimit(node, layer)) {
            continue;
        }

        if (node.layerUpdateState[layer.id] === undefined) {
            node.layerUpdateState[layer.id] = new LayerUpdateState();
        }

        if (!node.layerUpdateState[layer.id].canTryUpdate(ts)) {
            continue;
        }

        if (!force) {
            // does this tile needs a new texture?
            if (!node.downScaledColorLayer(layer.id)) {
                continue;
            }
            // is fetching data from this layer disabled?
            if (!layersConfig.isColorLayerVisible(layer.id) ||
                layersConfig.isLayerFrozen(layer.id)) {
                continue;
            }
        }

        let args = {
            layer: layer
        };

        let slot = node.materials[RendererConstant.FINAL].getLayerTextureOffset(layer.id);

        let currentLevel = node.materials[RendererConstant.FINAL].getLayerLevel(l_COLOR, slot);
        // if this tile has no texture (level == -1), try use one from an ancestor
        if (currentLevel === -1) {
            args.ancestor = findAncestorWithValidTextureForLayer(node, l_COLOR, layer);
        } else {
            var targetLevel = chooseNextLevelToFetch(layer.updateStrategy.type, node.level, currentLevel, layer.updateStrategy.options);

            if (targetLevel === currentLevel) {
                continue;
            }
            if (targetLevel < node.level) {
                args.ancestor = node.getNodeAtLevel(targetLevel);
            }
        }

        node.layerUpdateState[layer.id].try();

        promises.push(quadtree.interCommand.request(args, node, refinementCommandCancellationFn).then(
            function(result) {
                let level = args.ancestor ? args.ancestor.level : node.level;

                if (__DEV__) {
                    if (!node.colorLevels[layer.id]) node.colorLevels[layer.id] = []
                    node.colorLevels[layer.id].push(level);
                }

                // Assign .level to texture
                if (Array.isArray(result)) {
                    for (let j=0; j<result.length; j++) {
                        result[j].texture.level = level;
                    }

                    node.setTexturesLayer(result, l_COLOR, slot);
                } else if (result.texture) {
                    result.texture.level = level;
                    node.setTexturesLayer([result], l_COLOR, slot);
                } else {
                    // TODO: null texture is probably an error
                    // Maybe add an error counter for the node/layer,
                    // and stop retrying after X attempts.
                }

                node.layerUpdateState[layer.id].success();

                return result;
            },
            function(err) {
                if (err instanceof CancelledCommandException) {
                    node.layerUpdateState[layer.id].success();
                } else {
                    node.layerUpdateState[layer.id].failure(Date.now());

                    if (__DEV__) {
                       this.counters.network_failure++;
                    }
                }
            }.bind(this)
        ));
    }

    return Promise.all(promises).then(function() {
        if (node.parent) {
            node.loadingCheck();
        }
        return node;
    });
}

function updateNodeElevation(quadtree, node, layersConfig, force) {
    // Elevation is currently handled differently from color layers.
    // This is caused by a LayeredMaterial limitation: only 1 elevation texture
    // can be used (where a tile can have N textures x M layers)
    const ts = Date.now();
    const elevationLayers = layersConfig.getElevationLayers();
    let bestLayer = null;
    let ancestor = null;

    let currentElevation = node.materials[RendererConstant.FINAL].getLayerLevel(l_ELEVATION, 0);

    // Step 0: currentElevevation is -1 BUT material.nbTextures[l_ELEVATION] is > 0
    // means that we already tried and failed to download an elevation texture
    if (currentElevation == -1 && 0 < node.material.nbTextures[l_ELEVATION]) {
        return Promise.resolve(node);
    }

    // First step: if currentElevation is empty (level is -1), we *must* use the texture from
    // one of our parent. This allows for smooth transitions when subdividing
    // We don't care about layer status (isLayerFrozen) or limits (tileInsideLimit) because
    // we simply want to use ancestor's texture with a different pitch
    if (currentElevation == -1) {
        for (let i = 0; i < elevationLayers.length; i++) {
            let layer = elevationLayers[i];

            if (currentElevation === -1) {
                let a = findAncestorWithValidTextureForLayer(node, l_ELEVATION, layer);

                if (a != null) {
                    bestLayer = layer;
                    ancestor = a;
                    break;
                }
            }
        }
    }

    // We don't have a texture to reuse. This can happen in two cases:
    //   * no ancestor texture to use
    //   * we already have 1 texture (so currentElevation >= 0)
    // Again, LayeredMaterial's 1 elevation texture limitation forces us to `break` as soon
    // as one layer can supply a texture for this node. So ordering of elevation layers is important.
    if (bestLayer == null) {
        for (let i = 0; i < elevationLayers.length; i++) {
            let layer = elevationLayers[i];

            if (!layer.tileInsideLimit(node, layer)) {
                continue;
            }

            if (layersConfig.isLayerFrozen(layer.id) && !force) {
                continue;
            }

            if (node.layerUpdateState[layer.id] === undefined) {
                node.layerUpdateState[layer.id] = new LayerUpdateState();
            }

            if (!node.layerUpdateState[layer.id].canTryUpdate(ts)) {
                continue;
            }

            let targetLevel = chooseNextLevelToFetch(layer.updateStrategy.type, node.level, currentElevation, layer.updateStrategy.options);
            if (targetLevel <= currentElevation) {
                continue;
            }

            ancestor = node.getNodeAtLevel(targetLevel);
            bestLayer = layer;
            break;
        }
    }

    // If we found a usable layer, perform a query
    if (bestLayer != null) {
        let args = { 'layer': bestLayer, ancestor };

        node.layerUpdateState[bestLayer.id].try();

        return quadtree.interCommand.request(args, node, refinementCommandCancellationFn).then(
            function(terrain) {
                node.layerUpdateState[bestLayer.id].success();

                if (node.material === null) {
                    return;
                }

                if (terrain.texture) {
                    terrain.texture.level = (ancestor || node).level;
                }

                if (terrain.max === undefined) {
                    terrain.min = (ancestor || node).bbox.bottom();
                    terrain.max = (ancestor || node).bbox.top();
                }

                node.setTextureElevation(terrain);
                if (__DEV__) {
                    node.elevationLevels.push((ancestor || node).level);
                }

                return node;
            },
            function(err) {
                if (err instanceof CancelledCommandException) {
                    node.layerUpdateState[bestLayer.id].success();
                } else {
                    node.layerUpdateState[bestLayer.id].failure(Date.now());
                    if (__DEV__) {
                       this.counters.network_failure++;
                    }
                }
            }.bind(this)
        );
    }

    // No elevation texture available for this node, no need to wait for one.
    return Promise.resolve(node);
}


NodeProcess.prototype.processNode = function(node, camera, params) {
    let wasVisible = node.isVisible();
    let isVisible = !this.isCulled(node, camera);

    node.setDisplayed(false);
    node.setSelected(false);

    node.setVisibility(isVisible);

    if (isVisible) {
        // update node's sse value
        node.sse = camera.computeNodeSSE(node);

        let sse = this.checkNodeSSE(node);
        let hidden = sse && node.childrenLoaded();

        if (sse && params.tree.canSubdivideNode(node)) {
            // big screen space error: subdivide node, display children if possible
            this.subdivideNode(node, camera, params);
        }

        if (!hidden)  {
            // node is going to be displayed (either because !sse or because children aren't ready),
            // so try to refine its textures
            this.refineNodeLayers(node, camera, params);
        }

        // display children if possible
        node.setDisplayed(!hidden);

        // todo uniformsProcess
    } else {
        node.setDisplayed(false);
    }

    return wasVisible || isVisible;
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

    quaternion.multiplyQuaternions( node.OBB().quadInverse(), camera.camera3D.quaternion);

    return camera.getFrustumLocalSpace(position, quaternion).intersectsBox(node.OBB().box3D);
};

/**
 * @documentation: Cull node with frustrum and the bounding box of node
 * @param {type} node
 * @param {type} camera
 * @returns {unresolved}
 */
NodeProcess.prototype.frustumBB = function(node /*, camera*/ ) {
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
    this.cV.copy(camera.position()).divide(this.r);
    this.vhMagnitudeSquared = this.cV.lengthSq() - 1.0;
};

/**
 * @documentation: return true if point is occuled by horizon
 * @param {type} pt
 * @returns {Boolean}
 */
NodeProcess.prototype.pointHorizonCulling = function(pt) {
    var vT = pt.divide(this.r).sub(this.cV);

    var vtMagnitudeSquared = vT.lengthSq();

    var dot = -vT.dot(this.cV);

    var isOccluded =
        this.vhMagnitudeSquared < dot &&
        this.vhMagnitudeSquared < dot * dot / vtMagnitudeSquared;

    return isOccluded;
};

/**
 * @documentation: cull node with horizon
 * @param {type} node
 * @returns {Boolean}
 */
var point = new THREE.Vector3();

NodeProcess.prototype.horizonCulling = function(node) {

    // horizonCulling Oriented bounding box
    var points = node.OBB().pointsWorld;
    var isVisible = false;

    var nodePosition = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
    for (var i = 0, max = points.length; i < max; i++) {
        point.addVectors(nodePosition, points[i]);
        if (!this.pointHorizonCulling(point)) {
            isVisible = true;
            break;
        }
    }

    return isVisible;
};


export default NodeProcess;
