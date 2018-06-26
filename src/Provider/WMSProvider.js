import Extent from '../Core/Geographic/Extent';
import OGCWebServiceHelper from './OGCWebServiceHelper';
import URLBuilder from './URLBuilder';
import { STRATEGY_MIN_NETWORK_TRAFFIC, STRATEGY_PROGRESSIVE, STRATEGY_DICHOTOMY } from '../Core/Layer/LayerUpdateStrategy';

const supportedFormats = ['image/png', 'image/jpg', 'image/jpeg'];

function tileTextureCount(tile, layer) {
    return tile.extent.crs() == layer.projection ? 1 : tile.getCoordsForLayer(layer).length;
}

function preprocessDataLayer(layer) {
    if (!layer.name) {
        throw new Error('layer.name is required.');
    }
    if (!layer.extent) {
        throw new Error('layer.extent is required');
    }
    if (!layer.projection) {
        throw new Error('layer.projection is required');
    }

    if (!(layer.extent instanceof Extent)) {
        layer.extent = new Extent(layer.projection, layer.extent);
    }

    if (!layer.options.zoom) {
        layer.options.zoom = { min: 0, max: 21 };
    }

    layer.format = layer.format || 'image/png';
    if (!supportedFormats.includes(layer.format)) {
        throw new Error(`Layer ${layer.name}: unsupported format '${layer.format}', should be one of '${supportedFormats.join('\', \'')}'`);
    }

    layer.width = layer.heightMapWidth || 256;
    layer.version = layer.version || '1.3.0';
    layer.style = layer.style || '';
    layer.transparent = layer.transparent || false;

    if (!layer.axisOrder) {
        // 4326 (lat/long) axis order depends on the WMS version used
        if (layer.projection == 'EPSG:4326') {
            // EPSG 4326 x = lat, long = y
            // version 1.1.0 long/lat while version 1.3.0 mandates xy (so lat,long)
            layer.axisOrder = (layer.version === '1.1.0' ? 'wsen' : 'swne');
        } else {
            // xy,xy order
            layer.axisOrder = 'wsen';
        }
    }
    let crsPropName = 'SRS';
    if (layer.version === '1.3.0') {
        crsPropName = 'CRS';
    }

    layer.url = `${layer.url
                  }?SERVICE=WMS&REQUEST=GetMap&LAYERS=${layer.name
                  }&VERSION=${layer.version
                  }&STYLES=${layer.style
                  }&FORMAT=${layer.format
                  }&TRANSPARENT=${layer.transparent
                  }&BBOX=%bbox` +
                  `&${crsPropName}=${layer.projection
                  }&WIDTH=${layer.width
                  }&HEIGHT=${layer.width}`;
}

function tileInsideLimit(tile, layer) {
    const extents = tile.getCoordsForLayer(layer);
    for (let i = 0; i < extents.length; i++) {
        const extent = extents[i].as(layer.extent.crs());
        if (extent.isInside(layer.extent)) {
            return true;
        }
    }
    return false;
}

function canTextureBeImproved(layer, extents, textures, previousError) {
    for (let i = 0; i < extents.length; i++) {
        const extent = extents[i].as(layer.extent.crs());

        // if texture extent matches extent => we're good
        if (textures[i] && textures[i].extent && textures[i].extent.isInside(extent)) {
            return;
        }
    }

    return selectAllExtentsToDownload(layer, extents, textures, previousError);
}

function selectAllExtentsToDownload(layer, extents, textures, previousError) {
    const result = [];
    for (let i = 0; i < extents.length; i++) {
        const extent = chooseExtentToDownload(
            layer,
            extents[i],
            (textures && textures[i]) ? textures[i].extent : null,
            previousError);
        // if the choice is the same as the current one => stop updating
        if (textures[i] && textures[i].extent && textures[i].extent.isInside(extent)) {
            return;
        }
        const pitch = extents[i].offsetToParent(extent);
        result.push({ extent, pitch });
    }
    return result;
}

export function chooseExtentToDownload(layer, extent, currentExtent) {
    if (layer.updateStrategy.type == STRATEGY_MIN_NETWORK_TRAFFIC) {
        return extent;
    }
    if (!currentExtent) {
        return layer.extent;
    }
    // Do a quadtree subdivision of the layer's extent and align downloaded
    // textures on this grid to increase texture reuse between nodes.
    const dim = extent.dimensions();
    const cur = currentExtent.dimensions();
    const lay = layer.extent.dimensions();

    const nodeDepth = Math.floor(Math.log2(1 / (dim.x / lay.x)));
    const currentDepth = Math.floor(Math.log2(1 / (cur.x / lay.x)));

    if (nodeDepth <= (currentDepth + 1)) {
        return extent;
    }

    const offsetScale = extent.offsetToParent(layer.extent);
    let nextDepth = currentDepth;
    switch (layer.updateStrategy.type) {
        case STRATEGY_PROGRESSIVE:
            nextDepth = currentDepth + 1;
            break;
        default:
        case STRATEGY_DICHOTOMY:
            nextDepth = Math.ceil((currentDepth + nodeDepth) / 2);
            break;
    }

    if (nodeDepth <= nextDepth) {
        return extent;
    }

    const p = Math.pow(2, nextDepth);
    const ratio = 1 / p;
    // Compute the x/y cell in which the center of the extent lives.
    // The center is at: offset.x + (offset.x + offset.z) / 2.
    // We do this because taking one edge can lead to invalid result (6.99999 => 6)
    const x = ratio * Math.floor((2 * offsetScale.x + offsetScale.z) / (2 * ratio));
    const y = ratio * Math.floor((2 * offsetScale.y + offsetScale.w) / (2 * ratio));

    const ex = new Extent(currentExtent.crs(), {
        west: layer.extent.west() + x * lay.x,
        east: layer.extent.west() + (x + ratio) * lay.x,
        north: layer.extent.north() - y * lay.y,
        south: layer.extent.north() - (y + ratio) * lay.y,
    });
    if (__DEBUG__) {
        if (!extent.isInside(ex)) {
            throw new Error('Invalid computed extent');
        }
    }
    return ex;
}

function getColorTexture(layer, toDownload) {
    const urld = URLBuilder.bbox(toDownload.extent, layer);
    const result = { pitch: toDownload.pitch };

    return OGCWebServiceHelper.getColorTextureByUrl(urld, layer.networkOptions).then((texture) => {
        result.texture = texture;
        result.texture.extent = toDownload.extent;
        if (layer.transparent) {
            texture.premultiplyAlpha = true;
        }
        return result;
    }, (err) => {
        err.extent = toDownload.extent;
        throw err;
    });
}

function executeCommand(command) {
    const promises = [];
    for (let i = 0; i < command.toDownload.length; i++) {
        promises.push(getColorTexture(command.layer, command.toDownload[i]));
    }
    return Promise.all(promises);
}

export default {
    preprocessDataLayer,
    executeCommand,
    tileTextureCount,
    tileInsideLimit,
    canTextureBeImproved,
};
