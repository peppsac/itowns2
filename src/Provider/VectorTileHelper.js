import * as THREE from 'three';
import Fetcher from './Fetcher';
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
     * Get a vector tile file, parse it and return a [Feature]{@link module:GeoJsonParser.Feature}
     * or an array of Features. See [VectorTileParser]{@link module:VectorTileParser.parse}
     * for more details on the parsing.
     *
     * @param {string} url - The URL of the tile to fetch, NOT the template: use a
     * Provider instead if needed.
     * @param {TileMesh} tile
     * @param {Layer} layer
     * @param {Extent} coords
     *
     * @return {Promise} A Promise resolving with a Feature or an array a
     * Features.
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
     * @return {THREE.Texture}
     */
    getVectorTileTextureByUrl(url, tile, layer, coords) {
        if (layer.type !== 'color') return;

        return getVectorTileByUrl(url, tile, layer, coords).then((features) => {
            let texture;
            if (features) {
                texture = Feature2Texture.createTextureFromFeature(
                    features,
                    coords.crs() == 'TMS' ? tile.extent : coords.as(tile.extent.crs()),
                    256, layer.style);
            } else {
                texture = new THREE.Texture();
            }

            texture.extent = tile.extent;
            texture.coords = coords;

            if (layer.transparent) {
                texture.premultiplyAlpha = true;
            }

            return texture;
        });
    },
};
