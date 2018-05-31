import * as THREE from 'three';

function Ellipsoid(size) {
    this.rayon_1 = size.x;
    this.rayon_2 = size.y;
    this.rayon_3 = size.z;

    this.size = new THREE.Vector3(size.x, size.y, size.z);

    this._radiiSquared = new THREE.Vector3(size.x * size.x, size.y * size.y, size.z * size.z);

    this._oneOverRadiiSquared = new THREE.Vector3(size.x === 0.0 ? 0.0 : 1.0 / (size.x * size.x),
        size.y === 0.0 ? 0.0 : 1.0 / (size.y * size.y),
        size.z === 0.0 ? 0.0 : 1.0 / (size.z * size.z));
}

Ellipsoid.prototype.geodeticSurfaceNormal = function geodeticSurfaceNormal(cartesian, index = 0) {
    var result = new THREE.Vector3(
        cartesian.x(index) * this._oneOverRadiiSquared.x,
        cartesian.y(index) * this._oneOverRadiiSquared.y,
        cartesian.z(index) * this._oneOverRadiiSquared.z);
    return result.normalize();
};

Ellipsoid.prototype.geodeticSurfaceNormalCartographic = function geodeticSurfaceNormalCartographic(coordCarto, index = 0, target = new THREE.Vector3()) {
    var longitude = THREE.Math.degToRad(coordCarto.longitude(index));
    var latitude = THREE.Math.degToRad(coordCarto.latitude(index));
    var cosLatitude = Math.cos(latitude);

    var x = cosLatitude * Math.cos(longitude);
    var y = cosLatitude * Math.sin(longitude);
    var z = Math.sin(latitude);

    return target.set(x, y, z);
};

Ellipsoid.prototype.setSize = function setSize(size) {
    this.rayon_1 = size.x;
    this.rayon_2 = size.y;
    this.rayon_3 = size.z;

    this._radiiSquared = new THREE.Vector3(size.x * size.x, size.y * size.y, size.z * size.z);
};


Ellipsoid.prototype.cartographicToCartesian = function cartographicToCartesian(inputCoords, outputCoords) {
    if (inputCoords.count != outputCoords.count) {
        throw new Error(`Input and output arrays must have the same length (${inputCoords.count} != ${outputCoords.count}`);
    }

    const tmp = new THREE.Vector3();
    for (let i = 0; i < inputCoords.count; i++) {
        const n = inputCoords.getGeodesicNormal(i).clone();

        tmp.multiplyVectors(this._radiiSquared, n);

        const gamma = Math.sqrt(n.dot(tmp));

        tmp.divideScalar(gamma);

        n.multiplyScalar(inputCoords.altitude(i));

        tmp.add(n);

        tmp.toArray(outputCoords._values, 3 * i);
    }

    return outputCoords;
};

/**
 * Convert cartesian coordinates to geographic according to the current ellipsoid of revolution.
 * @param {number[]} input - The coordinates to convert (3 values per coordinates)
 * @param {number[]} output - The coordinates to convert (must be the same length as input)
 * @returns {number[]} output
 */
Ellipsoid.prototype.cartesianToCartographic = function cartesianToCartographic(input, output) {
    if (input.length != output.length) {
        throw new Error(`Input and output arrays must have the same length (${input.length} != ${output.length}`);
    }
    // for details, see for example http://www.linz.govt.nz/data/geodetic-system/coordinate-conversion/geodetic-datum-conversions/equations-used-datum
    // TODO the following is only valable for oblate ellipsoid of revolution. do we want to support triaxial ellipsoid?
    const a = this.rayon_1; // x
    const b = this.rayon_3; // z
    const e = Math.abs((a * a - b * b) / (a * a));
    const f = 1 - Math.sqrt(1 - e);
    const oneMinusF = 1 - f;
    const exa = e * a;

    for (let i = 0; i < input.length; i += 3) {
        const R = Math.sqrt(input[i + 0] * input[i + 0] + input[i + 1] * input[i + 1] + input[i + 2] * input[i + 2]);
        const rsqXY = Math.sqrt(input[i + 0] * input[i + 0] + input[i + 1] * input[i + 1]);

        const theta = Math.atan2(input[i + 1], input[i + 0]);
        const nu = Math.atan(input[i + 2] / rsqXY * (oneMinusF + exa / R));

        const sinu = Math.sin(nu);
        const cosu = Math.cos(nu);

        const phi = Math.atan((input[i + 2] * oneMinusF + exa * sinu * sinu * sinu) / (oneMinusF * (rsqXY - exa * cosu * cosu * cosu)));

        const h = (rsqXY * Math.cos(phi)) + input[i + 2] * Math.sin(phi) - a * Math.sqrt(1 - e * Math.sin(phi) * Math.sin(phi));

        output[i + 0] = THREE.Math.radToDeg(theta);
        output[i + 1] = THREE.Math.radToDeg(phi);
        output[i + 2] = h;
    }
    return output;
};

Ellipsoid.prototype.intersection = function intersection(ray) {
    var EPSILON = 0.0001;
    var O_C = ray.origin;
    var dir = ray.direction;
    // normalizeVector( dir );

    var a =
        ((dir.x * dir.x) / (this.size.x * this.size.x)) + ((dir.y * dir.y) / (this.size.y * this.size.y)) + ((dir.z * dir.z) / (this.size.z * this.size.z));

    var b =
        ((2 * O_C.x * dir.x) / (this.size.x * this.size.x)) + ((2 * O_C.y * dir.y) / (this.size.y * this.size.y)) + ((2 * O_C.z * dir.z) / (this.size.z * this.size.z));
    var c =
        ((O_C.x * O_C.x) / (this.size.x * this.size.x)) + ((O_C.y * O_C.y) / (this.size.y * this.size.y)) + ((O_C.z * O_C.z) / (this.size.z * this.size.z)) - 1;

    var d = ((b * b) - (4 * a * c));
    if (d < 0 || a === 0 || b === 0 || c === 0)
        { return false; }

    d = Math.sqrt(d);

    var t1 = (-b + d) / (2 * a);
    var t2 = (-b - d) / (2 * a);

    if (t1 <= EPSILON && t2 <= EPSILON) return false; // both intersections are behind the ray origin
    // var back = (t1 <= EPSILON || t2 <= EPSILON); // If only one intersection (t>0) then we are inside the ellipsoid and the intersection is at the back of the ellipsoid
    var t = 0;
    if (t1 <= EPSILON)
        { t = t2; }
    else
    if (t2 <= EPSILON)
        { t = t1; }
    else
        { t = (t1 < t2) ? t1 : t2; }

    if (t < EPSILON) return false; // Too close to intersection

    var inter = new THREE.Vector3();

    inter.addVectors(ray.origin, dir.clone().setLength(t));

    return inter;
    /*
    var normal = intersection.clone();//-ellipsoid.center;
    normal.x = 2*normal.x/(this.size.x*this.size.x);
    normal.y = 2*normal.y/(this.size.y*this.size.y);
    normal.z = 2*normal.z/(this.size.z*this.size.z);

    //normal.w = 0.f;
    normal *= (back) ? -1.f : 1.f;
    normalizeVector(normal);
    */
};

Ellipsoid.prototype.computeDistance = function computeDistance(coordCarto1, coordCarto2) {
    var longitude1 = THREE.Math.degToRad(coordCarto1.longitude());
    var latitude1 = THREE.Math.degToRad(coordCarto1.latitude());
    var longitude2 = THREE.Math.degToRad(coordCarto2.longitude());
    var latitude2 = THREE.Math.degToRad(coordCarto2.latitude());

    var distRad = Math.acos(Math.sin(latitude1) * Math.sin(latitude2) + Math.cos(latitude1) * Math.cos(latitude2) * Math.cos(longitude2 - longitude1));

    var a = this.rayon_1;
    var b = this.rayon_3;
    var e = Math.sqrt((a * a - b * b) / (a * a));
    var latMoy = (latitude1 + latitude2) / 2;
    var rho = (a * (1 - e * e)) / Math.sqrt(1 - e * e * Math.sin(latMoy) * Math.sin(latMoy));
    var N = a / Math.sqrt(1 - e * e * Math.sin(latMoy) * Math.sin(latMoy));

    var distMeter = distRad * Math.sqrt(rho * N);
    return distMeter;
};


export default Ellipsoid;
