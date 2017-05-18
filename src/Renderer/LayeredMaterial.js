/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


import * as THREE from 'three';
import BasicMaterial from './BasicMaterial';
import TileVS from './Shader/TileVS.glsl';
import TileFS from './Shader/TileFS.glsl';
import ColorLayer from './Shader/Chunk/ColorLayer.glsl';
import ColorLayerPM from './Shader/Chunk/ColorLayerPM.glsl';
import Capabilities from '../Core/System/Capabilities';
import pack from './AtlasBuilder';

export const EMPTY_TEXTURE_ZOOM = -1;

var emptyTexture = new THREE.Texture();
emptyTexture.coords = { zoom: EMPTY_TEXTURE_ZOOM };

var emptyTexture2 = new THREE.Texture();
emptyTexture2.coords = [{ zoom: EMPTY_TEXTURE_ZOOM }];

const layerTypesCount = 2;
var vector = new THREE.Vector3(0.0, 0.0, 0.0);
var vector4 = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);
var fooTexture;

export const l_ELEVATION = 0;
export const l_COLOR = 1;

// Array not suported in IE
var fillArray = function fillArray(array, remp) {
    for (var i = 0; i < array.length; i++)
        { array[i] = remp; }
};

var moveElementArray = function moveElementArray(array, oldIndex, newIndex)
{
    array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
};

/* eslint-disable */
var moveElementsArraySafe = function moveElementsArraySafe(array,index, howMany, toIndex) {
    index = parseInt(index) || 0;
    index = index < 0 ? array.length + index : index;
    toIndex = parseInt(toIndex) || 0;
    toIndex = toIndex < 0 ? array.length + toIndex : toIndex;
    if((toIndex > index) && (toIndex <= index + howMany)) {
        toIndex = index + howMany;
    }

    var moved;
    array.splice.apply(array, [toIndex, 0].concat(moved = array.splice(index, howMany)));
    return moved;
};
/* eslint-enable */

const LayeredMaterial = function LayeredMaterial(options) {
    BasicMaterial.call(this);

    const maxTexturesUnits = Capabilities.getMaxTextureUnitsCount();
    const nbSamplers = Math.min(maxTexturesUnits - 1, 16 - 1) - 1;
    this.vertexShader = TileVS;


    options = options || { };
    let vsOptions = '';
    if (options.useRgbaTextureElevation) {
        throw new Error('Restore this feature');
    } else if (options.useColorTextureElevation) {
        vsOptions = '\n#define COLOR_TEXTURE_ELEVATION\n';
        vsOptions += `\nconst float _minElevation = ${options.colorTextureElevationMinZ.toFixed(1)};\n`;
        vsOptions += `\nconst float _maxElevation = ${options.colorTextureElevationMaxZ.toFixed(1)};\n`;
    } else {
        // default
        vsOptions = '\n#define DATA_TEXTURE_ELEVATION\n';
    }

    this.vertexShader = this.vertexShaderHeader + vsOptions + TileVS;

    // handle on textures uniforms
    this.textures = [];
    // handle on textures offsetScale uniforms
    this.offsetScale = [];
    // handle Loaded textures count by layer's type uniforms
    this.loadedTexturesCount = [0, 0];

    // Uniform three js needs no empty array
    // WARNING TODO: prevent empty slot, but it's not the solution
    this.offsetScale[l_COLOR] = Array(nbSamplers);
    this.offsetScaleAtlas = Array(nbSamplers);
    this.oldOffsetScaleAtlas = Array(nbSamplers);
    this.offsetScale[l_ELEVATION] = [vector];
    fillArray(this.offsetScale[l_COLOR], vector);
    fillArray(this.offsetScaleAtlas, vector4);
    fillArray(this.oldOffsetScaleAtlas, vector4);

    this.textures[l_ELEVATION] = [emptyTexture];
    this.textures[l_COLOR] = Array(nbSamplers);
    var paramLayers = Array(8);
    this.layerTexturesCount = Array(8);

    fillArray(this.textures[l_COLOR], emptyTexture);
    fillArray(paramLayers, vector4);
    fillArray(this.layerTexturesCount, 0);

    // Elevation texture
    this.uniforms.dTextures_00 = new THREE.Uniform(this.textures[l_ELEVATION]);

    // Color textures's layer
    this.uniforms.dTextures_01 = new THREE.Uniform(this.textures[l_COLOR]);

    // Visibility layer
    this.uniforms.visibility = new THREE.Uniform([true, true, true, true, true, true, true, true]);

    // Loaded textures count by layer's type
    this.uniforms.loadedTexturesCount = new THREE.Uniform(this.loadedTexturesCount);

    // Count color layers
    this.uniforms.colorLayersCount = new THREE.Uniform(1);

    // Layer setting
    // Offset color texture slot | Projection | fx | Opacity
    this.uniforms.paramLayers = new THREE.Uniform(paramLayers);

    // Elevation texture cropping
    this.uniforms.offsetScale_L00 = new THREE.Uniform(this.offsetScale[l_ELEVATION]);

    // Color texture cropping
    this.uniforms.offsetScale_L01 = new THREE.Uniform(this.offsetScale[l_COLOR]);
    this.uniforms.offsetScaleAtlas = new THREE.Uniform(this.offsetScaleAtlas);
    this.uniforms.oldOffsetScaleAtlas = new THREE.Uniform(this.oldOffsetScaleAtlas);

    // Light position
    this.uniforms.lightPosition = new THREE.Uniform(new THREE.Vector3(-0.5, 0.0, 1.0));

    this.colorLayersId = [];
    this.elevationLayersId = [];


    const atlasTextures = Array(8)
    fillArray(atlasTextures, emptyTexture2);
    this.uniforms.atlasTextures = new THREE.Uniform(atlasTextures);
    const oldAtlasTextures = Array(8)
    fillArray(oldAtlasTextures, emptyTexture2);
    this.uniforms.oldAtlasTextures = new THREE.Uniform(oldAtlasTextures);
    const weights = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    this.uniforms.weights = new THREE.Uniform(weights);
    this.uniforms.elevationWeight = new THREE.Uniform(1.0);


    if (__DEBUG__) {
        this.checkLayersConsistency = function checkLayersConsistency(node, imageryLayers) {
            for (const layer of imageryLayers) {
                const index = this.indexOfColorLayer(layer.id);
                if (index < 0) {
                    continue;
                }

                const offset = this.getTextureOffsetByLayerIndex(index);
                const count = this.getTextureCountByLayerIndex(index);
                let total = 0;
                for (let i = 0; i < this.loadedTexturesCount[1]; i++) {
                    if (!this.uniforms.dTextures_01.value[i].image) {
                        throw new Error(`${node.id} - Missing texture at index ${i} for layer ${layer.id}`);
                    }

                    const critere1 = (offset <= i && i < (offset + count));
                    const search = layer.name ? `LAYERS=${layer.name}&` : `LAYER=${layer.options.name}&`;
                    const critere2 = this.uniforms.dTextures_01.value[i].image.currentSrc.indexOf(search) > 0;

                    if (critere1 && !critere2) {
                        throw new Error(`${node.id} - Texture should belong to ${layer.id} but comes from ${this.uniforms.dTextures_01.value[i].image.currentSrc}`);
                    } else if (!critere1 && critere2) {
                        throw new Error(`${node.id} - Texture shouldn't belong to ${layer.id}`);
                    } else if (critere1) {
                        total++;
                    }
                }
                if (total != count) {
                    throw new Error(`${node.id} - Invalid total texture count. Found: ${total}, expected: ${count} for ${layer.id}`);
                }
            }
        };
    }

    this._updateFragmentShader();
};

LayeredMaterial.prototype = Object.create(BasicMaterial.prototype);
LayeredMaterial.prototype.constructor = LayeredMaterial;

LayeredMaterial.prototype._updateFragmentShader = function _updateFragmentShader() {
    const colorCount = this.colorLayersId.length;

    let header = this.fragmentShaderHeader;
    header += `const int ColorLayersCount = ${Math.max(1, colorCount)};\n`;

    let paramByIndexContent = '';
    for (let i=0; i<8; i++) {
        paramByIndexContent += `if (index == ${i}) return osa[${i}];\n`;
    }

    let layerColors = '';
    const re = /REPLACE_INDEX/g;
    const re2 = /REPLACE_TEXTURE_INDEX/g;
    for (let i=0; i<colorCount; i++) {
        let s = this.getLayerUV(i) ? ColorLayerPM : ColorLayer;

        layerColors += s.replace(re, i)
            .replace(re2, this.getTextureOffsetByLayerIndex(i));
    }

    this.fragmentShader = header +
        TileFS.replace('REPLACE_COLOR_LAYER', layerColors)
            .replace('REPLACE_PARAM_BY_INDEX', paramByIndexContent);

    // console.log(this.fragmentShader);
}

LayeredMaterial.prototype.dispose = function dispose() {
    // TODO: WARNING  verify if textures to dispose aren't attached with ancestor

    this.dispatchEvent({
        type: 'dispose',
    });

    for (let l = 0; l < layerTypesCount; l++) {
        for (let i = 0, max = this.textures[l].length; i < max; i++) {
            if (this.textures[l][i] instanceof THREE.Texture) {
                this.textures[l][i].dispose();
            }
        }
    }
};

LayeredMaterial.prototype.setSequence = function setSequence(sequenceLayer) {
    return;
    let offsetLayer = 0;
    let offsetTexture = 0;

    const originalOffsets = new Array(...this.uniforms.offsetScale_L01.value);
    const originalTextures = new Array(...this.uniforms.dTextures_01.value);

    for (let l = 0; l < sequenceLayer.length; l++) {
        const layer = sequenceLayer[l];
        const oldIndex = this.indexOfColorLayer(layer);
        if (oldIndex > -1) {
            const newIndex = l - offsetLayer;
            const texturesCount = this.layerTexturesCount[oldIndex];

            // individual values are swapped in place
            if (newIndex !== oldIndex) {
                moveElementArray(this.colorLayersId, oldIndex, newIndex);
                moveElementArray(this.layerTexturesCount, oldIndex, newIndex);
                moveElementArray(this.uniforms.paramLayers.value, oldIndex, newIndex);
                moveElementArray(this.uniforms.visibility.value, oldIndex, newIndex);
            }
            const oldOffset = this.getTextureOffsetByLayerIndex(newIndex);
            // consecutive values are copied from original
            for (let i = 0; i < texturesCount; i++) {
                this.uniforms.offsetScale_L01.value[offsetTexture + i] = originalOffsets[oldOffset + i];
                this.uniforms.dTextures_01.value[offsetTexture + i] = originalTextures[oldOffset + i];
            }


            this.setTextureOffsetByLayerIndex(newIndex, offsetTexture);
            offsetTexture += texturesCount;
        } else {
            offsetLayer++;
        }
    }

    this.uniforms.colorLayersCount.value = this.getColorLayersCount();
};

LayeredMaterial.prototype.removeColorLayer = function removeColorLayer(layer) {
    return;
    const layerIndex = this.indexOfColorLayer(layer);

    if (layerIndex === -1) {
        return;
    }

    const offset = this.getTextureOffsetByLayerIndex(layerIndex);
    const texturesCount = this.getTextureCountByLayerIndex(layerIndex);

    // remove layer
    this.colorLayersId.splice(layerIndex, 1);
    this.uniforms.colorLayersCount.value = this.getColorLayersCount();

    // remove nb textures
    this.layerTexturesCount.splice(layerIndex, 1);
    this.layerTexturesCount.push(0);

    // Remove Layers Parameters
    this.uniforms.paramLayers.value.splice(layerIndex, 1);
    this.uniforms.paramLayers.value.push(vector4);

    // Remove visibility Parameters
    this.uniforms.visibility.value.splice(layerIndex, 1);
    this.uniforms.visibility.value.push(true);

    // Dispose Layers textures
    for (let i = offset, max = offset + texturesCount; i < max; i++) {
        if (this.textures[l_COLOR][i] instanceof THREE.Texture) {
            this.textures[l_COLOR][i].dispose();
        }
    }

    const removedTexturesLayer = this.textures[l_COLOR].splice(offset, texturesCount);
    this.offsetScale[l_COLOR].splice(offset, texturesCount);

    const loadedTexturesLayerCount = removedTexturesLayer.reduce((sum, texture) => sum + (texture.coords.zoom > EMPTY_TEXTURE_ZOOM), 0);

    // refill remove textures
    for (let i = 0, max = texturesCount; i < max; i++) {
        this.textures[l_COLOR].push(emptyTexture);
        this.offsetScale[l_COLOR].push(vector);
    }

    // Update slot start texture layer
    for (let j = layerIndex, mx = this.getColorLayersCount(); j < mx; j++) {
        this.uniforms.paramLayers.value[j].x -= texturesCount;
    }

    this.loadedTexturesCount[l_COLOR] -= loadedTexturesLayerCount;

    this.uniforms.offsetScale_L01.value = this.offsetScale[l_COLOR];
    // this.uniforms.offsetScaleAtlas.value = this.offsetScale[l_COLOR];
    this.uniforms.dTextures_01.value = this.textures[l_COLOR];
};

LayeredMaterial.prototype.setTexturesLayer = function setTexturesLayer(textures, layerType, layer) {
    const index = this.indexOfColorLayer(layer);
    const slotOffset = this.getTextureOffsetByLayerIndex(index);

    const { atlas, uv } = this.updateAtlas(textures.map(t => t.texture), textures.map(t => t.offsetScale || new THREE.Vector3(0.0, 0.0, 1.0)));

    this.uniforms.oldAtlasTextures.value[index] = this.uniforms.atlasTextures.value[index];
    if (this.uniforms.oldAtlasTextures.value[index].id === emptyTexture2.id) {
        this.uniforms.weights.value[index] = 1.0;
    } else {
        this.uniforms.weights.value[index] = 0.0;
    }

    atlas.coords = [];
    for (let i=0; i<uv.length; i++) {
        atlas.coords.push(textures[i].texture.coords);
        this.uniforms.oldOffsetScaleAtlas.value[slotOffset + i] = this.uniforms.offsetScaleAtlas.value[slotOffset + i];
        this.uniforms.offsetScaleAtlas.value[slotOffset + i] = uv[i];
    }
    this.uniforms.atlasTextures.value[index] = atlas;
    this.loadedTexturesCount[l_COLOR] += textures.length;
};

LayeredMaterial.prototype.updateAtlas = function updateAtlas(textures, offsetScale /*index*/) {
    const images = [];
    const uvs = [];

    for (let i=0; i<textures.length; i++) {
        const img = textures[i]; // .image;
        images.push(img);
        uvs.push(offsetScale[i])
    }

    const { atlas, uv } = pack(images, uvs);


    atlas.uv = uv;
    return { atlas, uv };
}

LayeredMaterial.prototype.setTexture = function setTexture(texture, layerType, slot, offsetScale) {
    if (this.textures[layerType][slot] === undefined || this.textures[layerType][slot].image === undefined) {
        this.loadedTexturesCount[layerType] += 1;
    }

    // BEWARE: array [] -> size: 0; array [10]="wao" -> size: 11
    this.textures[layerType][slot] = texture || emptyTexture;
    this.offsetScale[layerType][slot] = offsetScale || new THREE.Vector3(0.0, 0.0, 1.0);

};

LayeredMaterial.prototype.setColorLayerParameters = function setColorLayerParameters(params) {
    if (this.getColorLayersCount() === 0) {
        for (let l = 0; l < params.length; l++) {
            this.pushLayer(params[l]);
        }
    }
};

LayeredMaterial.prototype.pushLayer = function pushLayer(param) {
    const newIndex = this.getColorLayersCount();
    const offset = newIndex === 0 ? 0 : this.getTextureOffsetByLayerIndex(newIndex - 1) + this.getTextureCountByLayerIndex(newIndex - 1);

    this.uniforms.paramLayers.value[newIndex] = new THREE.Vector4();

    this.setTextureOffsetByLayerIndex(newIndex, offset);
    this.setLayerUV(newIndex, param.tileMT === 'PM' ? 1 : 0);
    this.setLayerFx(newIndex, param.fx);
    this.setLayerOpacity(newIndex, param.opacity);
    this.setLayerVisibility(newIndex, param.visible);
    this.setLayerTexturesCount(newIndex, param.texturesCount);
    this.colorLayersId.push(param.idLayer);

    this.uniforms.colorLayersCount.value = this.getColorLayersCount();

    this._updateFragmentShader();
};

LayeredMaterial.prototype.indexOfColorLayer = function indexOfColorLayer(layerId) {
    return this.colorLayersId.indexOf(layerId);
};

LayeredMaterial.prototype.getColorLayersCount = function getColorLayersCount() {
    return this.colorLayersId.length;
};

LayeredMaterial.prototype.getTextureOffsetByLayerIndex = function getTextureOffsetByLayerIndex(index) {
    return this.uniforms.paramLayers.value[index].x;
};

LayeredMaterial.prototype.getTextureCountByLayerIndex = function getTextureCountByLayerIndex(index) {
    return this.layerTexturesCount[index];
};

LayeredMaterial.prototype.getLayerTextureOffset = function getLayerTextureOffset(layerId) {
    const index = this.indexOfColorLayer(layerId);
    return index > -1 ? this.getTextureOffsetByLayerIndex(index) : -1;
};

LayeredMaterial.prototype.setLightingOn = function setLightingOn(enable) {
    this.uniforms.lightingEnabled.value = enable;
};

LayeredMaterial.prototype.setLayerFx = function setLayerFx(index, fx) {
    this.uniforms.paramLayers.value[index].z = fx;
};

LayeredMaterial.prototype.setTextureOffsetByLayerIndex = function setTextureOffsetByLayerIndex(index, offset) {
    this.uniforms.paramLayers.value[index].x = offset;
};

LayeredMaterial.prototype.setLayerUV = function setLayerUV(index, idUV) {
    this.uniforms.paramLayers.value[index].y = idUV;
};

LayeredMaterial.prototype.getLayerUV = function setLayerUV(index) {
    return this.uniforms.paramLayers.value[index].y;
};

LayeredMaterial.prototype.setLayerOpacity = function setLayerOpacity(index, opacity) {
    if (this.uniforms.paramLayers.value[index])
        { this.uniforms.paramLayers.value[index].w = opacity; }
};

LayeredMaterial.prototype.setLayerVisibility = function setLayerVisibility(index, visible) {
    this.uniforms.visibility.value[index] = visible;
};

LayeredMaterial.prototype.setLayerTexturesCount = function setLayerTexturesCount(index, count) {
    this.layerTexturesCount[index] = count;
};

LayeredMaterial.prototype.getLoadedTexturesCount = function getLoadedTexturesCount() {
    return this.loadedTexturesCount[l_ELEVATION] + this.loadedTexturesCount[l_COLOR];
};

LayeredMaterial.prototype.isColorLayerDownscaled = function isColorLayerDownscaled(layerId, zoom) {
    const index = this.indexOfColorLayer(layerId);
    return this.uniforms.atlasTextures.value[index].coords[0].zoom < zoom;
};

LayeredMaterial.prototype.getColorLayerLevelById = function getColorLayerLevelById(colorLayerId) {
    const index = this.indexOfColorLayer(colorLayerId);
    if (index === -1) {
        return EMPTY_TEXTURE_ZOOM;
    }
    return this.uniforms.atlasTextures.value[index].coords[0].zoom;

    // const slot = this.getTextureOffsetByLayerIndex(index);
    // const texture = this.textures[l_COLOR][slot];

    // return texture ? texture.coords.zoom : EMPTY_TEXTURE_ZOOM;
};

LayeredMaterial.prototype.getElevationLayerLevel = function getElevationLayerLevel() {
    return this.textures[l_ELEVATION][0].coords.zoom;
};

LayeredMaterial.prototype.getLayerTextures = function getLayerTextures(layerType, layerId) {
    if (layerType === l_ELEVATION) {
        return this.textures[l_ELEVATION];
    }

    const index = this.indexOfColorLayer(layerId);

    if (index !== -1) {
        const count = this.getTextureCountByLayerIndex(index);
        const textureIndex = this.getTextureOffsetByLayerIndex(index);
        return this.textures[l_COLOR].slice(textureIndex, textureIndex + count);
    } else {
        throw new Error(`Invalid layer id "${layerId}"`);
    }
};

export default LayeredMaterial;
