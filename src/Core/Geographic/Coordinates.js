/**
 * Generated On: 2015-10-5
 * Class: Coordinates
 * Description: Coordonnées cartographiques
 */

import * as THREE from 'three';
import proj4 from 'proj4';
import Ellipsoid from '../Math/Ellipsoid';

proj4.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs');

const projectionCache = {};

export function ellipsoidSizes() {
    return {
        x: 6378137,
        y: 6378137,
        z: 6356752.3142451793,
    };
}

const ellipsoid = new Ellipsoid(ellipsoidSizes());

export const UNIT = {
    DEGREE: 1,
    METER: 2,
};

function _unitFromProj4Unit(projunit) {
    if (projunit === 'degrees') {
        return UNIT.DEGREE;
    } else if (projunit === 'm') {
        return UNIT.METER;
    } else {
        return undefined;
    }
}

export function crsToUnit(crs) {
    switch (crs) {
        case 'EPSG:4326' : return UNIT.DEGREE;
        case 'EPSG:4978' : return UNIT.METER;
        default: {
            const p = proj4.defs(crs);
            if (!p) {
                return undefined;
            }
            return _unitFromProj4Unit(p.units);
        }
    }
}

export function reasonnableEpsilonForCRS(crs) {
    if (is4326(crs)) {
        return 0.01;
    } else {
        return 0.001;
    }
}

function _crsToUnitWithError(crs) {
    const u = crsToUnit(crs);
    if (crs === undefined || u === undefined) {
        throw new Error(`Invalid crs paramater value '${crs}'`);
    }
    return u;
}

export function assertCrsIsValid(crs) {
    _crsToUnitWithError(crs);
}

export function crsIsGeographic(crs) {
    return (_crsToUnitWithError(crs) != UNIT.METER);
}

export function crsIsGeocentric(crs) {
    return (_crsToUnitWithError(crs) == UNIT.METER);
}

function _assertIsGeographic(crs) {
    if (!crsIsGeographic(crs)) {
        throw new Error(`Can't query crs ${crs} long/lat`);
    }
}

function _assertIsGeocentric(crs) {
    if (!crsIsGeocentric(crs)) {
        throw new Error(`Can't query crs ${crs} x/y/z`);
    }
}

function instanceProj4(crsIn, crsOut) {
    if (projectionCache[crsIn]) {
        const p = projectionCache[crsIn];
        if (p[crsOut]) {
            return p[crsOut];
        }
    } else {
        projectionCache[crsIn] = {};
    }
    const p = proj4(crsIn, crsOut);
    projectionCache[crsIn][crsOut] = p;
    return p;
}

export function is4326(crs) {
    return crs.indexOf('EPSG:4326') == 0;
}

// Only support explicit conversions
function _convert(coordsIn, newCrs, target) {
    if (target && coordsIn.count != target.count) {
        throw new Error(`target.count should match input coords.count (${target.count} != ${coordsIn.count}`);
    }
    target = target || new Coordinates(newCrs, coordsIn.count);
    if (newCrs === coordsIn.crs) {
        return target.copy(coordsIn);
    } else {
        if (is4326(coordsIn.crs) && newCrs === 'EPSG:4978') {
            ellipsoid.cartographicToCartesian(coordsIn, target);
            target.crs = newCrs;
            // TODO target._normal = coordsIn.geodesicNormal;
            return target;
        }

        if (coordsIn.crs === 'EPSG:4978' && is4326(newCrs)) {
            ellipsoid.cartesianToCartographic(coordsIn._values, target._values);
            target.crs = newCrs;
            return target;
        }

        if (coordsIn.crs in proj4.defs && newCrs in proj4.defs) {
            const crsIn = coordsIn.crs;

            // there is a bug for converting anything from and to 4978 with proj4
            // https://github.com/proj4js/proj4js/issues/195
            // the workaround is to use an intermediate projection, like EPSG:4326
            if (newCrs == 'EPSG:4978') {
                const p = instanceProj4(crsIn, 'EPSG:4326');
                for (let i = 0; i < coordsIn._values.length; i += 3) {
                    const proj = p.forward(Array.prototype.slice.call(coordsIn._values, i, i + 2));
                    target._values[i] = proj[0];
                    target._values[i + 1] = proj[1];
                    target._values[i + 2] = coordsIn._values[i + 2];
                }
                target.crs = 'EPSG:4326';
                return target.as('EPSG:4978', target);
            } else if (coordsIn.crs === 'EPSG:4978') {
                coordsIn.as('EPSG:4326', target);
                const p = instanceProj4(target.crs, newCrs);
                for (let i = 0; i < target._values.length; i += 3) {
                    const proj = p.forward(Array.prototype.slice.call(target._values, i, i + 2));
                    target._values[i] = proj[0];
                    target._values[i + 1] = proj[1];
                    target._values[i + 2] = target._values[i + 2];
                }
                target.crs = newCrs;
                return target;
            } else if (is4326(crsIn) && newCrs == 'EPSG:3857') {
                const p = instanceProj4(crsIn, newCrs);
                for (let i = 0; i < coordsIn._values.length; i += 3) {
                    const v1 = THREE.Math.clamp(coordsIn._values[i], -89.999999, 89.999999);
                    const proj = p.forward([v1, coordsIn._values[i + 1]]);
                    target._values[i] = proj[0];
                    target._values[i + 1] = proj[1];
                    target._values[i + 2] = coordsIn._values[i + 2];
                }
                target.crs = newCrs;
                return target;
            } else {
                // here is the normal case with proj4
                const p = instanceProj4(crsIn, newCrs);
                for (let i = 0; i < coordsIn._values.length; i += 3) {
                    const proj = p.forward(Array.prototype.slice.call(coordsIn._values, i, i + 2));
                    target._values[i] = proj[0];
                    target._values[i + 1] = proj[1];
                    target._values[i + 2] = coordsIn._values[i + 2];
                }
                target.crs = newCrs;
                return target;
            }
        }

        throw new Error(`Cannot convert from crs ${coordsIn.crs} to ${newCrs}`);
    }
}

/**
 * Build a Coordinates object, given a {@link http://inspire.ec.europa.eu/theme/rs|crs} and a number of coordinates value. Coordinates can be in geocentric system, geographic system or an instance of {@link https://threejs.org/docs/#api/math/Vector3|THREE.Vector3}.
 * If crs = 'EPSG:4326', coordinates must be in geographic system.
 * If crs = 'EPSG:4978', coordinates must be in geocentric system.
 * @constructor
 * @param       {string} crs - Geographic or Geocentric coordinates system.
 * @param       {number|THREE.Vector3} coordinates - The globe coordinates to aim to.
 * @param       {number} coordinates.longitude - Geographic Coordinate longitude
 * @param       {number} coordinates.latitude - Geographic Coordinate latitude
 * @param       {number} coordinates.altitude - Geographic Coordinate altiude
 * @param       {number} coordinates.x - Geocentric Coordinate X
 * @param       {number} coordinates.y - Geocentric Coordinate Y
 * @param       {number} coordinates.z - Geocentric Coordinate Z
 * @example
 * new Coordinates('EPSG:4978', 20885167, 849862, 23385912); //Geocentric coordinates
 * // or
 * new Coordinates('EPSG:4326', 2.33, 48.24, 24999549); //Geographic coordinates
 */

function Coordinates(crs, ...coordinates) {
    this.set(crs, ...coordinates);
    this._normals = {};

    Object.defineProperty(this, 'count',
        {
            configurable: true,
            get: () => this._values.length / 3,
        });
    let deprectatedWarnCount = 0;
    Object.defineProperty(this, 'geodesicNormal',
        {
            configurable: true,
            get: () => {
                if (deprectatedWarnCount < 3) {
                    console.warn('geodesicNormal property is deprectated. Use getGeodesicNormal(index) instead');
                    deprectatedWarnCount++;
                }
                return this.getGeodesicNormal(0);
            },
        });
}

const planarNormal = new THREE.Vector3(0, 0, 1);

function computeGeodesicNormal(coord, index) {
    if (is4326(coord.crs)) {
        return ellipsoid.geodeticSurfaceNormalCartographic(coord, index);
    }
    // In globe mode (EPSG:4978), we compute the normal.
    if (coord.crs == 'EPSG:4978') {
        return ellipsoid.geodeticSurfaceNormal(coord, index);
    }
    // In planar mode, normal is the up vector.
    return planarNormal;
}

Coordinates.prototype.getGeodesicNormal = function geodesicNormal(index = 0) {
    // TODO: normal cache
    return computeGeodesicNormal(this, index);
};

Coordinates.prototype.set = function set(crs, ...coordinates) {
    _crsToUnitWithError(crs);
    this.crs = crs;

    if (coordinates.length == 1) {
        if (coordinates[0] instanceof THREE.Vector3) {
            this._values = new Float64Array(3);
            this._values[0] = coordinates[0].x;
            this._values[1] = coordinates[0].y;
            this._values[2] = coordinates[0].z;
        } else if (coordinates[0] instanceof Float64Array) {
            this._values = coordinates[0];
        } else if (coordinates[0] instanceof Float32Array) {
            this._values = coordinates[0];
        } else if (Number.isInteger(coordinates[0])) {
            this._values = new Float64Array(3 * coordinates[0]);
        }
    } else {
        this._values = new Float64Array(3);
        for (let i = 0; i < coordinates.length && i < 3; i++) {
            this._values[i] = coordinates[i];
        }
        for (let i = coordinates.length; i < 3; i++) {
            this._values[i] = 0;
        }
    }
    this._normal = undefined;
    return this;
};

Coordinates.prototype.clone = function clone(target) {
    let r;
    if (target) {
        Coordinates.call(target, this.crs, ...this._values);
        r = target;
    } else {
        r = new Coordinates(this.crs, ...this._values);
    }
    r._values = Float64Array.from(this._values);
    if (this._normal) {
        r._normal = this._normal.clone();
    }
    return r;
};

Coordinates.prototype.copy = function copy(src) {
    this.set(src.crs, ...src._values);
    this._values = Float64Array.from(src._values);
    return this;
};

/**
 * Returns the longitude in geographic coordinates. Coordinates must be in geographic system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coordinates = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * coordinates.longitude(); // Longitude in geographic system
 * // returns 2.33
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 * coordinates.longitude(); // Longitude in geographic system
 * // returns 2.330201911389028
 *
 * @return     {number} - The longitude of the position.
 */

Coordinates.prototype.longitude = function longitude(index = 0) {
    _assertIsGeographic(this.crs);
    return this._values[3 * index + 0];
};

/**
 * Returns the latitude in geographic coordinates. Coordinates must be in geographic system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coordinates = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * coordinates.latitude(); // Latitude in geographic system
 * // returns : 48.24
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 * coordinates.latitude(); // Latitude in geographic system
 * // returns : 48.24830764643365
 *
 * @return     {number} - The latitude of the position.
 */

Coordinates.prototype.latitude = function latitude(index = 0) {
    return this._values[3 * index + 1];
};

/**
 * Returns the altitude in geographic coordinates. Coordinates must be in geographic system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coordinates = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * coordinates.altitude(); // Altitude in geographic system
 * // returns : 24999549
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 * coordinates.altitude(); // Altitude in geographic system
 * // returns : 24999548.046711832
 *
 * @return     {number} - The altitude of the position.
 */

Coordinates.prototype.altitude = function altitude(index = 0) {
    _assertIsGeographic(this.crs);
    return this._values[3 * index + 2];
};

/**
 * Set the altiude.
 * @example coordinates.setAltitude(number)
 * @param      {number} - Set the altitude.
 */

Coordinates.prototype.setAltitude = function setAltitude(altitude, index = 0) {
    _assertIsGeographic(this.crs);
    this._values[3 * index + 2] = altitude;
};

 /**
 * Returns the longitude in geocentric coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.x();  // Geocentric system
 * // returns : 20885167
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.x(); // Geocentric system
 * // returns : 20888561.0301258
 *
 * @return     {number} - The longitude of the position.
 */

Coordinates.prototype.x = function x(index = 0) {
    _assertIsGeocentric(this.crs);
    return this._values[3 * index + 0];
};

/**
 * Returns the latitude in geocentric coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.y();  // Geocentric system
 * // returns : 849862
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.y(); // Geocentric system
 * // returns : 849926.376770819
 *
 * @return     {number} - The latitude of the position.
 */

Coordinates.prototype.y = function y(index = 0) {
    _assertIsGeocentric(this.crs);
    return this._values[3 * index + 1];
};

/**
 * Returns the altitude in geocentric coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.z();  // Geocentric system
 * // returns : 23385912
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.z(); // Geocentric system
 * // returns : 23382883.536591515
 *
 * @return     {number} - The altitude of the position.
 */

Coordinates.prototype.z = function z(index = 0) {
    _assertIsGeocentric(this.crs);
    return this._values[3 * index + 2];
};

/**
 * Returns a position in cartesian coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.xyz();  // Geocentric system
 * // returns : Vector3
 * // x: 20885167
 * // y: 849862
 * // z: 23385912
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.xyz(); // Geocentric system
 * // returns : Vector3
 * // x: 20885167
 * // y: 849862
 * // z: 23385912
 *
 * @return     {Position} - position
 */

Coordinates.prototype.xyz = function xyz(indexOrTarget, target) {
    _assertIsGeocentric(this.crs);
    if (!Number.isInteger(indexOrTarget)) {
        target = indexOrTarget;
        indexOrTarget = 0;
    }
    const v = target || new THREE.Vector3();
    v.fromArray(this._values.slice(3 * indexOrTarget));
    return v;
};

Coordinates.prototype.xyzArray = function xyzArray(target) {
    _assertIsGeocentric(this.crs);
    return this._values;
};

/**
 * Returns coordinates in the wanted {@link http://inspire.ec.europa.eu/theme/rs|CRS}.
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 *
 * //or
 *
 * new Coordinates('EPSG:4326', longitude: 2.33, latitude: 48.24, altitude: 24999549).as('EPSG:4978'); // Geocentric system
 *
 * // or
 *
 * new Coordinates('EPSG:4978', x: 20885167, y: 849862, z: 23385912).as('EPSG:4326'); // Geographic system
 *
 * @param      {string} - {@link http://inspire.ec.europa.eu/theme/rs|crs} : Geocentric (ex: 'EPSG:4326') or Geographic (ex: 'EPSG:4978').
 * @return     {Position} - position
 */

Coordinates.prototype.as = function as(crs, target) {
    if (crs === undefined || crsToUnit(crs) === undefined) {
        throw new Error(`Invalid crs paramater value '${crs}'`);
    }
    if (this.crs == crs) {
        // TODO: add
        return this;
    }
    return _convert(this, crs, target);
};

/**
 * Returns the normalized offset from top-left in extent of this Coordinates
 * e.g: extent.center().offsetInExtent(extent) would return (0.5, 0.5).
 * @param {Extent} extent
 * @param {Vector2} target optional Vector2 target. If not present a new one will be created
 * @return {Vector2} normalized offset in extent
 */
Coordinates.prototype.offsetInExtent = function offsetInExtent(extent, target) {
    if (this.crs != extent.crs()) {
        throw new Error('unsupported mix');
    }

    const dimension = {
        x: Math.abs(extent.east() - extent.west()),
        y: Math.abs(extent.north() - extent.south()),
    };

    const x = crsIsGeocentric(this.crs) ? this.x() : this.longitude();
    const y = crsIsGeocentric(this.crs) ? this.y() : this.latitude();

    const originX = (x - extent.west()) / dimension.x;
    const originY = (extent.north() - y) / dimension.y;

    target = target || new THREE.Vector2();
    target.set(originX, originY);
    return target;
};

export const C = {

    /**
     * Return a Coordinates object from a position object. The object just
     * needs to have x, y, z properties.
     *
     * @param {string} crs - The crs of the original position
     * @param {Object} position - the position to transform
     * @param {number} position.x - the x component of the position
     * @param {number} position.y - the y component of the position
     * @param {number} position.z - the z component of the position
     * @return {Coordinates}
     */
    EPSG_4326: function EPSG_4326(...args) {
        return new Coordinates('EPSG:4326', ...args);
    },
};

export default Coordinates;
