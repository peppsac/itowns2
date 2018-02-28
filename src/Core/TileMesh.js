/**
 * Generated On: 2015-10-5
 * Class: TileMesh
 * Description: Tuile de maillage, noeud du quadtree MNT. Le Materiel est issus du QuadTree ORTHO.
 */

import * as THREE from 'three';
import LayeredMaterial from '../Renderer/LayeredMaterial';
import { l_ELEVATION } from '../Renderer/LayeredMaterialConstants';
import RendererConstant from '../Renderer/RendererConstant';
import OGCWebServiceHelper, { SIZE_TEXTURE_TILE } from './Scheduler/Providers/OGCWebServiceHelper';

function TileMesh(geometry, params) {
    // Constructor
    THREE.Mesh.call(this);

    this.matrixAutoUpdate = false;
    this.rotationAutoUpdate = false;

    if (!params.extent) {
        throw new Error('params.extent is mandatory to build a TileMesh');
    }

    this.level = params.level;
    this.extent = params.extent;

    this.geometry = geometry;

    this.obb = this.geometry.OBB.clone();

    this.boundingSphere = this.OBB().box3D.getBoundingSphere();

    this.material = [];
    for (let i = 0; i<10;i++) {
        this.material.push(new LayeredMaterial(params.materialOptions));
        // this.material[i].renderOrder = i;
    }
    for (const m of this.material) {
        m.transparent = false;
        m.opacity = 1;
        m.uniforms.opacity.value = 1;
        //m.wireframe = true;
    }

    this.onBeforeRender = (a, b, c, d, mat) => {
        mat.transparent = true;
    };

    this.onAfterRender = (a, b, c, d, mat) => {
        mat.transparent = false;
    };

    // this.material[0].wireframe = true;

    this.frustumCulled = false;

    this.updateGeometricError();

    // Layer
    this.setDisplayed(false);

    this.layerUpdateState = {};

    for (const m of this.material) {
        m.setUuid(this.id);
    }

    this._state = RendererConstant.FINAL;
}

TileMesh.prototype = Object.create(THREE.Mesh.prototype);
TileMesh.prototype.constructor = TileMesh;

TileMesh.prototype.updateMatrixWorld = function updateMatrixWorld(force) {
    THREE.Mesh.prototype.updateMatrixWorld.call(this, force);
    this.OBB().update();
};

TileMesh.prototype.isVisible = function isVisible() {
    return this.visible;
};

TileMesh.prototype.setDisplayed = function setDisplayed(show) {
    for (const m of this.material) {
        m.visible = show;
    }
};

TileMesh.prototype.setVisibility = function setVisibility(show) {
    this.visible = show;
};

TileMesh.prototype.isDisplayed = function isDisplayed() {
    return this.material[0].visible;
};

// switch material in function of state
TileMesh.prototype.changeState = function changeState(state) {
    if (state == this._state) {
        return;
    }

    for (const m of this.material) {
        if (state == RendererConstant.DEPTH) {
            m.defines.DEPTH_MODE = 1;
            delete m.defines.MATTE_ID_MODE;
        } else if (state == RendererConstant.ID) {
            m.defines.MATTE_ID_MODE = 1;
            delete m.defines.DEPTH_MODE;
        } else {
            delete m.defines.MATTE_ID_MODE;
            delete m.defines.DEPTH_MODE;
        }
        m.needsUpdate = true;
    }

    this._state = state;
};

function applyChangeState(n, s) {
    if (n.changeState) {
        n.changeState(s);
    }
}

TileMesh.prototype.pushRenderState = function pushRenderState(state) {
    if (this._state == state) {
        return () => { };
    }

    const oldState = this._state;
    this.traverse(n => applyChangeState(n, state));

    return () => {
        this.traverse(n => applyChangeState(n, oldState));
    };
};

TileMesh.prototype.setFog = function setFog(fog) {
    this.material[0].setFogDistance(fog);
};

TileMesh.prototype.setSelected = function setSelected(select) {
    this.material[0].setSelected(select);
};

TileMesh.prototype.setTextureElevation = function setTextureElevation(elevation) {
    if (this.material === null) {
        return;
    }

    const offsetScale = elevation.pitch || new THREE.Vector4(0, 0, 1, 1);
    this.setBBoxZ(elevation.min, elevation.max);

    this.material[0].setTexture(elevation.texture, l_ELEVATION, 0, offsetScale);
};


TileMesh.prototype.setBBoxZ = function setBBoxZ(min, max) {
    if (min == undefined && max == undefined) {
        return;
    }
    if (Math.floor(min) !== Math.floor(this.obb.z.min) || Math.floor(max) !== Math.floor(this.obb.z.max)) {
        this.OBB().updateZ(min, max);
        this.OBB().box3D.getBoundingSphere(this.boundingSphere);
        this.updateGeometricError();
    }
};

TileMesh.prototype.updateGeometricError = function updateGeometricError() {
    // The geometric error is calculated to have a correct texture display.
    // For the projection of a texture's texel to be less than or equal to one pixel
    this.geometricError = this.boundingSphere.radius / SIZE_TEXTURE_TILE;
};

TileMesh.prototype.setTexturesLayer = function setTexturesLayer(textures, layerType, layerId, sequence) {
    if (this.material === null) {
        return;
    }
    if (textures) {
        this.material[sequence].setTexturesLayer(textures, layerType, layerId);
    }
};

TileMesh.prototype.getLayerTextures = function getLayerTextures(layerType, layerId) {
    const mat = this.material[0];
    return mat.getLayerTextures(layerType, layerId);
};

TileMesh.prototype.isColorLayerLoaded = function isColorLayerLoaded(layerId) {
    const mat = this.material[0];
    return mat.getColorLayerLevelById(layerId) > -1;
};

TileMesh.prototype.isElevationLayerLoaded = function isElevationLayerLoaded() {
    return this.material[0].loadedTexturesCount[l_ELEVATION] > 0;
};

TileMesh.prototype.isColorLayerDownscaled = function isColorLayerDownscaled(layer) {
    const mat = this.material[layer.sequence];
    return mat.isColorLayerDownscaled(layer.id, this.getZoomForLayer(layer));
};

TileMesh.prototype.OBB = function OBB() {
    return this.obb;
};

TileMesh.prototype.getIndexLayerColor = function getIndexLayerColor(idLayer) {
    return this.material[0].indexOfColorLayer(idLayer);
};

TileMesh.prototype.removeColorLayer = function removeColorLayer(idLayer) {
    if (this.layerUpdateState && this.layerUpdateState[idLayer]) {
        delete this.layerUpdateState[idLayer];
    }
    this.material[0].removeColorLayer(idLayer);
};

TileMesh.prototype.changeSequenceLayers = function changeSequenceLayers(sequence) {
    const layerCount = this.material[0].getColorLayersCount();

    // Quit if there is only one layer
    if (layerCount < 2) {
        return;
    }

    this.material[0].setSequence(sequence);
};

TileMesh.prototype.getCoordsForLayer = function getCoordsForLayer(layer) {
    if (layer.protocol.indexOf('wmts') == 0) {
        OGCWebServiceHelper.computeTileMatrixSetCoordinates(this, layer.options.tileMatrixSet);
        return this.wmtsCoords[layer.options.tileMatrixSet];
    } else if (layer.protocol == 'wms' && this.extent.crs() != layer.projection) {
        if (layer.projection == 'EPSG:3857') {
            const tilematrixset = 'PM';
            OGCWebServiceHelper.computeTileMatrixSetCoordinates(this, tilematrixset);
            return this.wmtsCoords[tilematrixset];
        } else {
            throw new Error('unsupported projection wms for this viewer');
        }
    } else if (layer.protocol == 'tms' || layer.protocol == 'xyz') {
        // Special globe case: use the P(seudo)M(ercator) coordinates
        if (this.extent.crs() === 'EPSG:4326' &&
                (['EPSG:3857', 'EPSG:4326'].indexOf(layer.extent.crs()) >= 0)) {
            OGCWebServiceHelper.computeTileMatrixSetCoordinates(this, 'PM');
            return this.wmtsCoords.PM;
        } else {
            return OGCWebServiceHelper.computeTMSCoordinates(this, layer.extent, layer.origin);
        }
    } else {
        return [this.extent];
    }
};

TileMesh.prototype.getZoomForLayer = function getZoomForLayer(layer) {
    if (layer.protocol.indexOf('wmts') == 0) {
        OGCWebServiceHelper.computeTileMatrixSetCoordinates(this, layer.options.tileMatrixSet);
        return this.wmtsCoords[layer.options.tileMatrixSet][0].zoom;
    } else {
        return this.level;
    }
};

export default TileMesh;
