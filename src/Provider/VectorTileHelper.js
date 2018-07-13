import * as THREE from 'three';
import Fetcher from './Fetcher';
import Cache from '../Core/Scheduler/Cache';
import VectorTileParser from '../Parser/VectorTileParser';
import Feature2Texture from '../Renderer/ThreeExtended/Feature2Texture';

const getVectorTileByUrl = function getVectorTileByUrl(url, tile, layer, coords) {
    return Fetcher.arrayBuffer(url, layer.networkOptions).then(buffer =>
        VectorTileParser.parse(buffer, {
            format: layer.format,
            extent: tile.extent,
            filteringExtent: layer.extent,
            filter: layer.filter,
            origin: layer.origin,
            coords,
        }));
};

/**
 * @module VectorTileHelper
 */
export default {
    /**
     * Get a vector tile file, parse it and return a [FeatureCollection]{@link
     * module:GeoJsonParser.FeatureCollection}. See [VectorTileParser]{@link
     * module:VectorTileParser.parse} for more details on the parsing.
     *
     * @param {string} url - The URL of the tile to fetch, NOT the template: use a
     * Provider instead if needed.
     * @param {TileMesh} tile
     * @param {Layer} layer
     * @param {Extent} coords
     *
     * @return {Promise} A Promise resolving with a Feature Collection.
     * @function
     */
    getVectorTileByUrl,

    /**
     * Get a vector tile, parse it and return a [THREE.Texture]{@link https://threejs.org/docs/#api/textures/Texture}.
     *
     * @param {string} url - The URL of the tile to fetch, NOT the template: use a
     * Provider instead if needed.
     * @param {TileMesh} tile
     * @param {Layer} layer
     * @param {Extent} coords
     *
     * @return {Object} Contains a <code>texture</code> property that is the
     * resulting texture of the vector tile.
     */
    getVectorTileTextureByUrl(url, tile, layer, coords) {
        if (layer.type !== 'color') return;

        return Cache.get(url) || Cache.set(url, getVectorTileByUrl(url, tile, layer, coords).then((features) => {
            let texture;

            const backgroundColor = (layer.backgroundLayer && layer.backgroundLayer.paint) ?
                new THREE.Color(layer.backgroundLayer.paint['background-color']) :
                undefined;
            if (features) {
                texture = Feature2Texture.createTextureFromFeature(
                    features,
                    coords.crs() == 'TMS' ? tile.extent : coords.as(tile.extent.crs()),
                    256,
                    layer.style,
                    backgroundColor);
            } else if (backgroundColor) {
                const data = new Uint8Array(3);
                data[0] = backgroundColor.r * 255;
                data[1] = backgroundColor.g * 255;
                data[2] = backgroundColor.b * 255;
                texture = new THREE.DataTexture(data, 1, 1, THREE.RGBFormat);
                texture.needsUpdate = true;
            } else {
                texture = new THREE.Texture();
            }

            texture.extent = tile.extent;
            texture.coords = coords;

            if (layer.transparent) {
                texture.premultiplyAlpha = true;
            }

            return texture;
        }));
    },
};
