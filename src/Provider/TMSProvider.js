import * as THREE from 'three';
import OGCWebServiceHelper from './OGCWebServiceHelper';
import URLBuilder from './URLBuilder';
import Extent from '../Core/Geographic/Extent';
<<<<<<< HEAD
import { chooseExtentToDownload } from './WMTSProvider';
=======
import VectorTileHelper from './VectorTileHelper';
>>>>>>> cdc4871b... feat(core): add vector tile loading in TMS

function preprocessDataLayer(layer) {
    if (!layer.extent) {
        // default to the full 3857 extent
        layer.extent = new Extent('EPSG:3857',
            -20037508.342789244, 20037508.342789244,
            -20037508.342789255, 20037508.342789244);
    }
    if (!(layer.extent instanceof (Extent))) {
        if (!layer.projection) {
            throw new Error(`Missing projection property for layer '${layer.id}'`);
        }
        layer.extent = new Extent(layer.projection, ...layer.extent);
    }
    layer.origin = layer.origin || (layer.protocol == 'xyz' ? 'top' : 'bottom');
    if (!layer.options.zoom) {
        layer.options.zoom = {
            min: 0,
            max: 18,
        };
    }
    layer.fx = layer.fx || 0.0;
}

function getVectorTile(tile, coords, layer) {
    const url = URLBuilder.xyz(coords, layer);

    if (layer.type == 'color') {
        return VectorTileHelper.getVectorTileTextureByUrl(url, tile, layer, coords);
    }
}

function canTextureBeImproved(layer, extents, textures, previousError) {
    for (const extent of extents) {
        if (!extentInsideLimit(extent, layer)) {
            return;
        }
        if (extent.zoom > layer.options.zoom.max) {
            return;
        }
    }

    if (!textures || textures.length < extents.length) {
        return selectAllExtentsToDownload(layer, extents, textures, previousError);
    }

    for (let i = 0; i < extents.length; i++) {
        if (!textures[i].extent || textures[i].extent.zoom < extents[i].zoom) {
            return selectAllExtentsToDownload(layer, extents, textures, previousError);
        }
    }
}

function selectAllExtentsToDownload(layer, extents, textures, previousError) {
    const result = [];
    for (let i = 0; i < extents.length; i++) {
        const pitch = new THREE.Vector4(0, 0, 1, 1);
        const extent = chooseExtentToDownload(extents[i], (textures && textures[i].extent) ? textures[i].extent : null, layer, pitch, previousError);
        // if the choice is the same as the current one => stop updating
        if (textures && textures[i].extent && textures[i].extent.zoom == extent.zoom) {
            return;
        }
        result.push({ extent, pitch });
    }
    return result;
}

function executeCommand(command) {
    const layer = command.layer;

    const promises = [];
    const supportedFormats = {
        'application/x-protobuf;type=mapbox-vector': getVectorTile.bind(this),
    };
    const func = supportedFormats[layer.format];

    for (const toDownload of command.toDownload) {
        if (func) {
            // TODO
            promises.push(func(tile, coordTMS, layer));
        } else {
            const urld = URLBuilder.xyz(toDownload.extent, layer);

            promises.push(OGCWebServiceHelper.getColorTextureByUrl(urld, layer.networkOptions).then((texture) => {
                const result = {};
                result.texture = texture;
                result.texture.coords = toDownload.extent;
                result.pitch = toDownload.pitch;
                if (layer.transparent) {
                    texture.premultiplyAlpha = true;
                }
                return result;
            }));
        }
    }
    return Promise.all(promises);
}

function tileTextureCount(tile, layer) {
    return tileInsideLimit(tile, layer) ? 1 : 0;
}

function tileInsideLimit(tile, layer) {
    // assume 1 TMS texture per tile (ie: tile geometry CRS is the same as layer's CRS)
    return extentInsideLimit(tile.getCoordsForLayer(layer)[0], layer);
}

function extentInsideLimit(extent, layer) {
    return layer.options.zoom.min <= extent.zoom &&
            extent.zoom <= layer.options.zoom.max;
}

export default {
    preprocessDataLayer,
    executeCommand,
    tileTextureCount,
    tileInsideLimit,
    canTextureBeImproved,
};
