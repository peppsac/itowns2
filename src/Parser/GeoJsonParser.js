import Coordinates from '../Core/Geographic/Coordinates';
import Extent from '../Core/Geographic/Extent';

function readCRS(json) {
    if (json.crs) {
        if (json.crs.type.toLowerCase() == 'epsg') {
            return `EPSG:${json.crs.properties.code}`;
        } else if (json.crs.type.toLowerCase() == 'name') {
            const epsgIdx = json.crs.properties.name.toLowerCase().indexOf('epsg:');
            if (epsgIdx >= 0) {
                // authority:version:code => EPSG:[...]:code
                const codeStart = json.crs.properties.name.indexOf(':', epsgIdx + 5);
                if (codeStart > 0) {
                    return `EPSG:${json.crs.properties.name.substr(codeStart + 1)}`;
                }
            }
        }
        throw new Error(`Unsupported CRS type '${json.crs}'`);
    }
    // assume default crs
    return 'EPSG:4326';
}

function readCoordinates(coordinates, target, extent) {
    // coordinates is a list of pair [[x1, y1], [x2, y2], ..., [xn, yn]]
    const offset = target.count * 3;

    // resize the output array
    const old = target._values;
    target._values = new Float64Array(old.length + 3 * coordinates.length);
    target._values.set(old);

    let i = 0;
    for (const pair of coordinates) {
        target._values[offset + i + 0] = pair[0];
        target._values[offset + i + 1] = pair[1];
        // TODO: 1 is a default z value, makes this configurable
        target._values[offset + i + 2] = (pair.length == 0) ? pair[2] : 1;
        i += 3;
    }
    // expand extent if present
    if (extent) {
        extent.expandByPoints(target);
    }

    return target;
}

// Helper struct that returns an object { type: "", coordinates: [...], extent}:
// - type is the geom type
// - Coordinates is an array of Coordinate
// - extent is optional, it's coordinates's extent
// Multi-* geometry types are merged in one.
const GeometryToCoordinates = {
    point(crsIn, coordsIn, filteringExtent, options, target) {
        const extent = options.buildExtent ? new Extent(crsIn, Infinity, -Infinity, Infinity, -Infinity) : undefined;
        const offset = target ? target.count : 0;
        const coordinates = readCoordinates(coordsIn,
            target ? target.vertices : new Coordinates(crsIn, 0), extent);

        if (filteringExtent && !filteringExtent.isPointInside(coordinates)) {
            return;
        }
        return { type: 'point', vertices: coordinates, offset, count: 1, extent };
    },
    polygon(crsIn, coordsIn, filteringExtent, options, target) {
        const extent = options.buildExtent ? new Extent(crsIn, Infinity, -Infinity, Infinity, -Infinity) : undefined;
        // read contour first
        const offset = target ? target.count : 0;
        const coordinates = readCoordinates(coordsIn[0],
            target ? target.vertices : new Coordinates(crsIn, 0), extent);

        if (filteringExtent && !filteringExtent.isPointInside(coordinates)) {
            return;
        }
        const contourCount = coordinates.count;
        let hole_offset = contourCount;
        const holes = [];
        // Then read optional holes
        for (let i = 1; i < coordsIn.length; i++) {
            readCoordinates(coordsIn[i], coordinates, extent);
            const count = coordinates.count - hole_offset;
            holes.push({
                hole_offset,
                count,
            });
            hole_offset += count;
        }

        return {
            type: 'polygon',
            vertices: coordinates,
            offset,
            count: contourCount,
            holes,
            extent,
        };
    },
    lineString(crsIn, coordsIn, filteringExtent, options, target) {
        const extent = options.buildExtent ? new Extent(crsIn, Infinity, -Infinity, Infinity, -Infinity) : undefined;
        const offset = target ? target.count : 0;
        const coordinates = readCoordinates(coordsIn,
            target ? target.vertices : new Coordinates(crsIn, 0), extent);

        if (filteringExtent && !filteringExtent.isPointInside(coordinates)) {
            return;
        }
        return {
            type: 'linestring',
            vertices: coordinates,
            count: coordinates.count - offset,
            offset,
            extent,
        };
    },
    multiPoint(crsIn, coordsIn, filteringExtent, options) {
        const points = [];
        points.type = 'multipoint';
        for (const pt of coordsIn) {
            const l = this.point(crsIn, pt, filteringExtent, options,
                points.length > 0 ? points[0] : undefined);
            if (!l) {
                return;
            }
            filteringExtent = undefined;
            points.push(l);
            if (options.buildExtent) {
                points.extent = points.extent || l.extent;
                points.extent.union(l.extent);
            }
        }
        return points;
    },

    multiLineString(crsIn, coordsIn, filteringExtent, options) {
        const lines = [];
        lines.type = 'multilinestring';
        for (const line of coordsIn) {
            const l = this.lineString(crsIn, line, filteringExtent, options,
                lines.length > 0 ? lines[0] : undefined);
            if (!l) {
                return;
            }
            // only test the first line
            filteringExtent = undefined;
            lines.push(l);
            if (options.buildExtent) {
                lines.extent = lines.extent || l.extent;
                lines.extent.union(l.extent);
            }
        }
        return lines;
    },
    multiPolygon(crsIn, coordsIn, filteringExtent, options) {
        const polygons = [];
        polygons.type = 'multipolygon';
        for (const polygon of coordsIn) {
            const p = this.polygon(crsIn, polygon, filteringExtent, options,
                polygons.length > 0 ? polygons[0] : undefined);
            if (!p) {
                return;
            }
            // only test the first poly
            filteringExtent = undefined;
            polygons.push(p);
            if (options.buildExtent) {
                polygons.extent = polygons.extent || p.extent;
                polygons.extent.union(p.extent);
            }
        }
        return polygons;
    },
};

function readGeometry(crsIn, crsOut, json, filteringExtent, options) {
    if (json.coordinates.length == 0) {
        return;
    }
    switch (json.type.toLowerCase()) {
        case 'point':
            return GeometryToCoordinates.point(crsIn, [json.coordinates], filteringExtent, options);
        case 'multipoint':
            return GeometryToCoordinates.multiPoint(crsIn, json.coordinates, filteringExtent, options);
        case 'linestring':
            return GeometryToCoordinates.lineString(crsIn, json.coordinates, filteringExtent, options);
        case 'multilinestring':
            return GeometryToCoordinates.multiLineString(crsIn, json.coordinates, filteringExtent, options);
        case 'polygon':
            return GeometryToCoordinates.polygon(crsIn, json.coordinates, filteringExtent, options);
        case 'multipolygon':
            return GeometryToCoordinates.multiPolygon(crsIn, json.coordinates, filteringExtent, options);
        case 'geometrycollection':
        default:
            throw new Error(`Unhandled geometry type ${json.type}`);
    }
}

function readFeature(crsIn, crsOut, json, filteringExtent, options) {
    if (options.filter && !options.filter(json.properties)) {
        return;
    }
    const feature = {};
    feature.geometry = readGeometry(crsIn, crsOut, json.geometry, filteringExtent, options);

    if (!feature.geometry) {
        return;
    }

    // project to the requested crs
    // TODO: shouldn't be done in the parser but in the code using the
    // output of the parser
    if (crsIn != crsOut) {
        if (feature.geometry.extent) {
            feature.geometry.extent = feature.geometry.extent.as(crsOut);
        }

        switch (feature.geometry.type) {
            case 'point':
                feature.geometry.vertices = feature.geometry.vertices.as(crsOut);
                break;
            case 'linestring':
                feature.geometry.vertices = feature.geometry.vertices.as(crsOut);
                break;
            case 'polygon':
                feature.geometry.vertices = feature.geometry.vertices.as(crsOut);
                break;
            default:
                for (const v of feature.geometry) {
                    v.vertices = v.vertices.as(crsOut);
                    if (v.extent) {
                        v.extent = v.extent.as(crsOut);
                    }
                }
                break;
        }
    }

    feature.properties = json.properties || {};
    // copy other properties
    for (const key of Object.keys(json)) {
        if (['type', 'geometry', 'properties'].indexOf(key.toLowerCase()) < 0) {
            feature.properties[key] = json[key];
        }
    }

    return feature;
}

function readFeatureCollection(crsIn, crsOut, json, filteringExtent, options) {
    const collec = [];

    for (const feature of json.features) {
        const f = readFeature(crsIn, crsOut, feature, filteringExtent, options);
        if (f) {
            if (options.buildExtent) {
                if (collec.extent) {
                    collec.extent.union(f.geometry.extent);
                } else {
                    collec.extent = f.geometry.extent.clone();
                }
            }
            collec.push(f);
        }
    }
    return collec;
}

/**
 * The GeoJsonParser module provide a [parse]{@link module:GeoJsonParser.parse}
 * method that takes a GeoJSON in and gives an object formatted for iTowns
 * containing all necessary informations to display this GeoJSON.
 *
 * @module GeoJsonParser
 */
export default {
    /**
     * Similar to the geometry of a feature in a GeoJSON, but adapted to iTowns.
     * The difference is that coordinates are stored as {@link Coordinates}
     * instead of raw values. If needed (especially if the geometry is a
     * <code>polygon</code>), more information is provided.
     *
     * @typedef FeatureGeometry
     * @type {Object}
     *
     * @property {string} type - Geometry type, can be <code>point</code>,
     * <code>multipoint</code>, <code>linestring</code>,
     * <code>multilinestring</code>, <code>polygon</code> or
     * <code>multipolygon</code>.
     * @property {Coordinates[]} vertices - All the vertices of the geometry.
     * @property {?number[]} contour - If this geometry is a
     * <code>polygon</code>, <code>contour</code> contains the indices that
     * compose the contour (outer ring).
     * @property {?Array} holes - If this geometry is a <code>polygon</code>,
     * <code>holes</code> contains an array of indices representing holes in the
     * polygon.
     * @property {?Extent} extent - The 2D extent containing all the geometries.
    */

    /**
     * Similar to a feature in a GeoJSON, but adapted to iTowns.
     *
     * @typedef Feature
     * @type {Object}
     *
     * @property {FeatureGeometry|FeatureGeometry[]} geometry - The feature's
     * geometry. Can be a [FeatureGeometry]{@link
     * module:GeoJsonParser~FeatureGeometry} or an array of FeatureGeometry.
     * @property {Object} properties - Properties of the features. It can be
     * anything specified in the GeoJSON under the <code>properties</code>
     * property.
    */

    /**
     * Parse a GeoJSON file content and return a [Feature]{@link
     * module:GeoJsonParser~Feature} or an array of Features.
     *
     * @param {string} json - The GeoJSON file content to parse.
     * @param {Object} options - Options controlling the parsing.
     * @param {string} options.crsOut - The CRS to convert the input coordinates
     * to.
     * @param {string} options.crsIn - Override the data CRS.
     * @param {Extent} [options.filteringExtent] - Optional filter to reject
     * features outside of this extent.
     * @param {boolean} [options.buildExtent=false] - If true the geometry will
     * have an extent property containing the area covered by the geom
     * @param {function} [options.filter] - Filter function to remove features
     *
     * @return {Promise} A promise resolving with a [Feature]{@link
     * module:GeoJsonParser~Feature} or an array of Features.
     */
    parse(json, options = {}) {
        const crsOut = options.crsOut;
        const filteringExtent = options.filteringExtent;
        if (typeof (json) === 'string') {
            json = JSON.parse(json);
        }
        options.crsIn = options.crsIn || readCRS(json);
        switch (json.type.toLowerCase()) {
            case 'featurecollection':
                return Promise.resolve(readFeatureCollection(options.crsIn, crsOut, json, filteringExtent, options));
            case 'feature':
                return Promise.resolve(readFeature(options.crsIn, crsOut, json, filteringExtent, options));
            default:
                throw new Error(`Unsupported GeoJSON type: '${json.type}`);
        }
    },
};
