import * as THREE from 'three';
import Earcut from 'earcut';

function getAltitude(options, properties, contour) {
    if (options.altitude) {
        if (typeof options.altitude === 'function') {
            return options.altitude(properties, contour);
        } else {
            return options.altitude;
        }
    }
    return 0;
}

function getExtrude(options, properties) {
    if (options.extrude) {
        if (typeof options.extrude === 'function') {
            return options.extrude(properties);
        } else {
            return options.extrude;
        }
    }
    return 0;
}

function randomColor() {
    const randomColor = new THREE.Color();
    randomColor.setHex(Math.random() * 0xffffff);
    return randomColor;
}

function getColor(options, properties) {
    if (options.color) {
        if (typeof options.color === 'function') {
            return options.color(properties);
        } else {
            return options.color;
        }
    }
    return randomColor();
}

function fillColorArray(colors, length, r, g, b, offset) {
    const len = offset + length;
    for (let i = offset; i < len; ++i) {
        colors[3 * i] = r;
        colors[3 * i + 1] = g;
        colors[3 * i + 2] = b;
    }
}

/*
 * Convert coordinates to vertices positionned at a given altitude
 *
 * @param  {Coordinate[]} contour - Coordinates of a feature
 * @param  {number | number[] } altitude - Altitude of the feature
 * @return {Vector3[]} vertices
 */
const vec = new THREE.Vector3();
function coordinatesToVertices(contour, altitude, target, offset = 0) {
    // loop over contour coodinates
    for (const coordinate of contour) {
        // convert coordinate to position
        coordinate.xyz(vec);
        // move the vertex following the normal, to put the point on the good altitude
        vec.addScaledVector(coordinate.geodesicNormal, altitude);
        // fill the vertices array at the offset position
        vec.toArray(target, offset);
        offset += 3;
    }
}

/*
 * Add indices for the side faces.
 * We loop over the contour and create a side face made of two triangles.
 *
 * For a ring made of (n) coordinates, there are (n*2) vertices.
 * The (n) first vertices are on the roof, the (n) other vertices are on the floor.
 *
 * If index (i) is on the roof, index (i+length) is on the floor.
 *
 * @param {number[]} indices - Indices of vertices
 * @param {number} length - total vertices count in the geom (excluding the extrusion ones)
 * @param {object} ring - ring needing side faces
 * @param {number} ring.offset - beginning of the ring
 * @param {number} ring.count - vertices count in the ring
 */
function addExtrudedPolygonSideFaces(indices, length, ring, isClockWise) {
    // loop over contour length, and for each point of the contour,
    // add indices to make two triangle, that make the side face
    for (let i = ring.offset; i < ring.offset + ring.count - 1; ++i) {
        if (isClockWise) {
            // first triangle indices
            indices.push(i);
            indices.push(i + length);
            indices.push(i + 1);
            // second triangle indices
            indices.push(i + 1);
            indices.push(i + length);
            indices.push(i + length + 1);
        } else {
            // first triangle indices
            indices.push(i + length);
            indices.push(i);
            indices.push(i + length + 1);
            // second triangle indices
            indices.push(i + length + 1);
            indices.push(i);
            indices.push(i + 1);
        }
    }
}

function prepareBufferGeometry(vert, altitude, color) {
    const multiplyVerticesCount = altitude instanceof Array ? altitude.length : 1;

    const vertices = new Float32Array(3 * vert.length * multiplyVerticesCount);
    const colors = new Uint8Array(3 * vert.length * multiplyVerticesCount);

    if (multiplyVerticesCount == 1) {
        coordinatesToVertices(vert, altitude, vertices);
        fillColorArray(colors, vert.length, color.r * 255, color.g * 255, color.b * 255, 0);
    } else {
        for (let i = 0; i < altitude.length; i++) {
            coordinatesToVertices(vert, altitude[i], vertices, 3 * vert.length * i);
            fillColorArray(colors, vert.length, color[i].r * 255, color[i].g * 255, color[i].b * 255, vert.length * i);
        }
    }

    const geom = new THREE.BufferGeometry();
    geom.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    return geom;
}


function geometryToPoint(geometry, properties, options, multiGeomAttributes) {
    const vertices = multiGeomAttributes ? multiGeomAttributes.vertices : geometry.vertices;

    // get altitude / color from properties
    const altitude = getAltitude(options, properties, vertices);
    const color = getColor(options, properties);

    const geom = prepareBufferGeometry(
        vertices,
        altitude,
        color);

    return new THREE.Points(geom);
}

function geometryToLine(geometry, properties, options, multiGeomAttributes) {
    const vertices = multiGeomAttributes ? multiGeomAttributes.vertices : geometry.vertices;

    // get altitude / color from properties
    const altitude = getAltitude(options, properties, vertices);
    const color = getColor(options, properties);

    const geom = prepareBufferGeometry(
        vertices,
        altitude,
        color);

    if (!multiGeomAttributes) {
        return new THREE.Line(geom);
    } else {
        const indices = [];
        // Multi line case
        for (let i = 0; i < geometry.length; i++) {
            const start = multiGeomAttributes[i].offset + geometry[i].contour.offset;
            const end = multiGeomAttributes[i].offset + multiGeomAttributes[i].count;
            for (let j = start; j < end; j++) {
                indices.push(j);
                indices.push(j + 1);
            }
        }
        geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        return new THREE.LineSegments(geom);
    }
}

function geometryToPolygon(geometry, properties, options, multiGeomAttributes) {
    const vertices = multiGeomAttributes ? multiGeomAttributes.vertices : geometry.vertices;

    // get altitude / color from properties
    const altitude = getAltitude(options, properties, vertices);
    const color = getColor(options, properties);

    const geom = prepareBufferGeometry(
        vertices,
        altitude,
        color);

    const indices = [];
    // Build indices
    if (!multiGeomAttributes) {
        // Single polygon case
        const holes = geometry.holes.map(h => h.offset);
        const triangles = Earcut(geom.attributes.position.array, holes, 3);
        for (const indice of triangles) {
            indices.push(indice);
        }
    } else {
        // Multi polygon case
        for (let i = 0; i < geometry.length; i++) {
            const holes = geometry[i].holes.map(h => h.offset);
            const start = multiGeomAttributes[i].offset + geometry[i].contour.offset;
            const end = multiGeomAttributes[i].offset + multiGeomAttributes[i].count;
            const triangles = Earcut(geom.attributes.position.array.slice(start * 3, end * 3),
                holes,
                3);
            for (const indice of triangles) {
                indices.push(start + indice);
            }
        }
    }

    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return new THREE.Mesh(geom);
}


function geometryToExtrudedPolygon(geometry, properties, options, multiGeomAttributes) {
    const vertices = multiGeomAttributes ? multiGeomAttributes.vertices : geometry.vertices;

    // get altitude / color from properties
    const altitudes = [
        getAltitude(options, properties, vertices),
        getExtrude(options, properties),
    ];
    const colors = [
        getColor(options, properties)];
    colors.push(colors[0].clone());
    colors[0].multiplyScalar(155 / 255);

    const geom = prepareBufferGeometry(
        vertices,
        altitudes,
        colors);

    const indices = [];
    // Build indices
    if (!multiGeomAttributes) {
        // Single polygon case
        const isClockWise = THREE.ShapeUtils.isClockWise(
            vertices.slice(geometry.contour.offset,
                geometry.contour.offset +
                geometry.contour.count).map(c => c.xyz()));

        const holes = geometry.holes.map(h => h.offset);
        const triangles = Earcut(geom.attributes.position.array.slice(
            vertices.length * 3), holes, 3);
        for (const indice of triangles) {
            indices.push(indice);
        }
        addExtrudedPolygonSideFaces(
            indices,
            vertices.length,
            geometry.contour,
            isClockWise);
        if (holes.length > 0) {
            for (let j = 0; j < geometry.holes.length; j++) {
                addExtrudedPolygonSideFaces(
                    indices,
                    vertices.length,
                    geometry.holes[j],
                    isClockWise);
            }
        }
    } else {
        // Multi polygon case
        const isClockWise = THREE.ShapeUtils.isClockWise(
            vertices.slice(
                multiGeomAttributes[0].offset + geometry[0].contour.offset,
                multiGeomAttributes[0].offset +
                geometry[0].contour.offset +
                geometry[0].contour.count).map(c => c.xyz()));

        for (let i = 0; i < geometry.length; i++) {
            const holes = geometry[i].holes.map(h => h.offset);
            // triangulate the top face
            const start = vertices.length + multiGeomAttributes[i].offset + geometry[i].contour.offset;
            const end = vertices.length + multiGeomAttributes[i].offset + multiGeomAttributes[i].count;
            const triangles = Earcut(geom.attributes.position.array.slice(start * 3, end * 3),
                holes,
                3);
            for (const indice of triangles) {
                indices.push(start + indice);
            }
            addExtrudedPolygonSideFaces(
                indices,
                vertices.length,
                {
                    count: geometry[i].contour.count,
                    offset: multiGeomAttributes[i].offset + geometry[i].contour.offset,
                },
                isClockWise);
            if (holes.length > 0) {
                for (let j = 0; j < geometry[i].holes.length; j++) {
                    addExtrudedPolygonSideFaces(
                        indices,
                        vertices.length,
                        {
                            count: geometry[i].holes[j].count,
                            offset: multiGeomAttributes[i].offset + geometry[i].holes[j].offset,
                        },
                        isClockWise);
                }
            }
        }
    }

    geom.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return new THREE.Mesh(geom);
}

/*
 * Convert all feature coordinates in one mesh.
 *
 * Read the altitude of each feature in the properties of the feature, using the function given in the param style : style.altitude(properties).
 * For polygon, read extrude amout using the function given in the param style.extrude(properties).
 *
 * param  {structure with coordinate[] and featureVertices[]} coordinates - representation of all the features
 * param  {properties[]} properties - properties of all the features
 * param  {callbacks} callbacks defines functions to read altitude and extrude amout from feature properties
 * return {THREE.Mesh} mesh
 */
function geometryToMesh(geometry, properties, options) {
    if (!geometry) {
        return;
    }

    // concat vertices of multigeometries in one big array
    let multiGeometries;
    if (geometry.type.indexOf('multi') == 0) {
        // vertices count
        let vertices = [];
        multiGeometries = [];
        let offset = 0;
        for (let i = 0; i < geometry.length; i++) {
            vertices = vertices.concat(geometry[i].vertices);
            multiGeometries.push({
                offset,
                count: geometry[i].vertices.length,
            });
            offset += geometry[i].vertices.length;
        }
        multiGeometries.vertices = vertices;
    }


    var mesh;
    switch (geometry.type) {
        case 'point':
        case 'multipoint': {
            mesh = geometryToPoint(geometry, properties, options, multiGeometries);
            break;
        }
        case 'linestring':
        case 'multilinestring': {
            mesh = geometryToLine(geometry, properties, options, multiGeometries);
            break;
        }
        case 'polygon':
        case 'multipolygon': {
            if (options.extrude) {
                mesh = geometryToExtrudedPolygon(
                    geometry,
                    properties,
                    options,
                    multiGeometries);
            }
            else {
                mesh = geometryToPolygon(
                    geometry,
                    properties,
                    options,
                    multiGeometries);
            }
            break;
        }
        default:
    }

    // set mesh material
    mesh.material.vertexColors = THREE.VertexColors;
    mesh.material.color = new THREE.Color(0xffffff);
    return mesh;
}

function featureToThree(feature, options) {
    const mesh = geometryToMesh(feature.geometry, feature.properties, options);
    mesh.properties = feature.properties;
    return mesh;
}

function featureCollectionToThree(featureCollection, options) {
    const group = new THREE.Group();
    group.minAltitude = Infinity;
    for (const feature of featureCollection) {
        const mesh = featureToThree(feature, options);
        group.add(mesh);
        group.minAltitude = Math.min(mesh.minAltitude, group.minAltitude);
    }
    return group;
}

export default {

    convert(options = {}) {
        return function _convert(feature) {
            if (!feature) return;

            if (feature instanceof Array) {
                return featureCollectionToThree(feature, options);
            } else {
                return featureToThree(feature, options);
            }
        };
    },
};
