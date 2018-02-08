import Protobuf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import * as THREE from 'three';
import Fetcher from './Fetcher';
import CacheRessource from './CacheRessource';
import GeoJSON2Features from '../../../Renderer/ThreeExtended/GeoJSON2Features';
import Feature2Texture from '../../../Renderer/ThreeExtended/Feature2Texture';

const cache = CacheRessource();
const cachePending = new Map();

function assignLayer(object, layer) {
    if (object) {
        object.layer = layer.id;
        object.layers.set(layer.threejsLayer);
        for (const c of object.children) {
            assignLayer(c, layer);
        }
        return object;
    }
}

/**
 * Fetch a vector tile, and return it as VectorTile in a Promise.
 *
 * @param {string} url - the url to fetch from
 * @param {Object=} networkOptions - fetch options (passed directly to fetch)
 *
 * @return {Promise}
 */
const getVectorTileRawByURL = function getVectorTileRawByURL(url, networkOptions) {
    const textureCache = cache.getRessource(url);

    if (textureCache !== undefined) {
        return Promise.resolve(textureCache);
    }

    const pending = cachePending.get(url);
    if (pending) {
        return pending;
    }

    const promise = (cachePending.has(url)) ?
        cachePending.get(url) :
        Fetcher.arrayBuffer(url, networkOptions);

    cachePending.set(url, promise);

    return promise.then(buffer => (new VectorTile(new Protobuf(buffer))));
};

/**
 * Fetch and return a valid GeoJSON, parsed from a VectorTile.
 *
 * @param {string} url - the url to fetch from
 * @param {TileMesh} tile
 * @param {Layer} layer
 * @param {Extent} coords - the coordinates for the layer
 *
 * @return {Promise}
 */
const getVectorTileGeoJSONByUrl = function getVectorTileGeoJSONByUrl(url, tile, layer, coords) {
    return getVectorTileRawByURL(url, layer.networkOptions).then((vector_tile) => {
        const layers = Object.keys(vector_tile.layers);

        if (layers.length < 1) return;

        // We need to create a featureCollection as VectorTile does no support it
        const geojson = {
            type: 'FeatureCollection',
            features: [],
            crs: { type: 'EPSG', properties: { code: 4326 } },
            extent: tile.extent,
        };

        layers.forEach((layer_id) => {
            const l = vector_tile.layers[layer_id];

            for (let i = 0; i < l.length; i++) {
                let feature;
                // We need to move from TMS to Google/Bing/OSM coordinates
                // https://alastaira.wordpress.com/2011/07/06/converting-tms-tile-coordinates-to-googlebingosm-tile-coordinates/
                // Only if the layer.origin is top
                if (layer.origin == 'top') {
                    feature = l.feature(i).toGeoJSON(coords.col, coords.row, coords.zoom);
                } else {
                    const y = 1 << coords.zoom;
                    feature = l.feature(i).toGeoJSON(coords.col, y - coords.row - 1, coords.zoom);
                }
                if (layers.length > 1) {
                    feature.properties.vt_layer = layer_id;
                }

                geojson.features.push(feature);
            }
        });

        return geojson;
    });
};

/**
 * Fetch and return an object containing a THREE.Texture, that can be used
 * directly in a tile. By default, the result is similar to the Raster_Provider.
 *
 * @param {string} url - the url to fetch from
 * @param {TileMesh} tile
 * @param {Layer} layer
 * @param {Extent} coords - the coordinates for the layer
 *
 * @return {Promise}
 */
const getVectorTileTextureByUrl = function getVectorTileTextureByUrl(url, tile, layer, coords) {
    if (layer.type !== 'color') return;

    return getVectorTileGeoJSONByUrl(url, tile, layer, coords).then((geojson) => {
        if (!geojson) return;

        const features = GeoJSON2Features.parse(tile.extent.crs(), geojson,
            layer.extent, { filter: layer.filter, buildExtent: true });

        // sort features before drawing
        if (layer.sort) {
            features.features.sort(layer.sort);
        }

        const colorCoords = tile.extent.as(layer.projection);
        const result = { pitch: new THREE.Vector4(0, 0, 1, 1) };
        result.texture = Feature2Texture.createTextureFromFeature(features, tile.extent, 256, layer.style);
        result.texture.extent = tile.extent;
        result.texture.coords = colorCoords;
        result.texture.coords.zoom = tile.level;

        if (layer.transparent) {
            result.texture.premultiplyAlpha = true;
        }

        return result;
    });
};

/**
 * Fetch and return an object containing Meshes, that can be added to the scene.
 *
 * @param {string} url - the url to fetch from
 * @param {TileMesh} tile
 * @param {Layer} layer
 * @param {Extent} coords - the coordinates for the layer
 *
 * @return {Promise}
 */
const getVectorTileMeshByUrl = function getVectorTileMeshByUrl(url, tile, layer, coords) {
    if (layer.type !== 'geometry') return;

    return getVectorTileGeoJSONByUrl(url, tile, layer, coords).then((geojson) => {
        if (!geojson) return;

        const features = GeoJSON2Features.parse(tile.extent.crs(), geojson,
            layer.extent, { filter: layer.filter, buildExtent: true });

        // We assume that the user has specified the convert method
        return assignLayer(layer.convert(features), layer);
    });
};

export default {
    getVectorTileRawByURL,
    getVectorTileGeoJSONByUrl,
    getVectorTileTextureByUrl,
    getVectorTileMeshByUrl,
};
