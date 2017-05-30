import * as THREE from 'three';
import Provider from './Provider';
import Fetcher from './Fetcher';
import PointsVS from '../../../Renderer/Shader/PointsVS.glsl';
import PointsFS from '../../../Renderer/Shader/PointsFS.glsl';
import ItownsPointMaterial from '../../../Renderer/ItownsPointMaterial';

function PointCloudProvider() {
    Provider.call(this);

    this.requests = {};
}

PointCloudProvider.prototype = Object.create(Provider.prototype);
PointCloudProvider.prototype.constructor = PointCloudProvider;

let hrcCount = 0;

// PointCloud
// from potree
function createChildAABB(aabb, childIndex) {
    var min = aabb.min;
    var max = aabb.max;
    var dHalfLength = new THREE.Vector3().copy(max).sub(min).multiplyScalar(0.5);
    var xHalfLength = new THREE.Vector3(dHalfLength.x, 0, 0);
    var yHalfLength = new THREE.Vector3(0, dHalfLength.y, 0);
    var zHalfLength = new THREE.Vector3(0, 0, dHalfLength.z);

    var cmin = min;
    var cmax = new THREE.Vector3().add(min).add(dHalfLength);

    if (childIndex === 1) {
        min = new THREE.Vector3().copy(cmin).add(zHalfLength);
        max = new THREE.Vector3().copy(cmax).add(zHalfLength);
    } else if (childIndex === 3) {
        min = new THREE.Vector3().copy(cmin).add(zHalfLength).add(yHalfLength);
        max = new THREE.Vector3().copy(cmax).add(zHalfLength).add(yHalfLength);
    } else if (childIndex === 0) {
        min = cmin;
        max = cmax;
    } else if (childIndex === 2) {
        min = new THREE.Vector3().copy(cmin).add(yHalfLength);
        max = new THREE.Vector3().copy(cmax).add(yHalfLength);
    } else if (childIndex === 5) {
        min = new THREE.Vector3().copy(cmin).add(zHalfLength).add(xHalfLength);
        max = new THREE.Vector3().copy(cmax).add(zHalfLength).add(xHalfLength);
    } else if (childIndex === 7) {
        min = new THREE.Vector3().copy(cmin).add(dHalfLength);
        max = new THREE.Vector3().copy(cmax).add(dHalfLength);
    } else if (childIndex === 4) {
        min = new THREE.Vector3().copy(cmin).add(xHalfLength);
        max = new THREE.Vector3().copy(cmax).add(xHalfLength);
    } else if (childIndex === 6) {
        min = new THREE.Vector3().copy(cmin).add(xHalfLength).add(yHalfLength);
        max = new THREE.Vector3().copy(cmax).add(xHalfLength).add(yHalfLength);
    }

    return new THREE.Box3(min, max);
}


function parseOctree(hierarchyStepSize, baseurl, name, aabb) {
    return fetch(`${baseurl}/r${name}.hrc`, { credentials: 'include' }).then(response => response.arrayBuffer()).then((blob) => {
        hrcCount++;
        const view = new DataView(blob);

        const stack = [];

        let offset = 0;
        const children = view.getUint8(0); offset += 1;
        const numPoints = view.getUint32(1, true); offset += 4;

        const root = { numPoints, children: [], name, baseurl, bbox: aabb };

        stack.push({ item: root, children, name, numPoints });

        while (stack.length && offset < blob.byteLength) {
            const snode = stack.shift();
            // look up 8 children
            for (let i = 0; i < 8; i++) {
                // does snode have a #i child ?
                if (snode.children & (1 << i) && (offset + 5) <= blob.byteLength) {
                    const c = view.getUint8(offset); offset += 1;
                    const n = view.getUint32(offset, true); offset += 4;
                    const childname = snode.name + i;
                    const bounds = createChildAABB(snode.item.bbox, i);

                    let url = baseurl;
                    if ((childname.length % hierarchyStepSize) == 0) {
                        const myname = childname.substr(name.length);
                        url = `${baseurl}/${myname}`;
                    }
                    const item = { n, children: [], name: childname, baseurl: url, bbox: bounds };

                    snode.item.children.push(item);

                    stack.push({ item, children: c, name: childname, baseurl: url, numPoints: n });
                }
            }
        }

        const promises = [];
        for (const s of stack) {
            if (s.name == root.name) continue;

            if ((s.name.length % hierarchyStepSize) == 0) {
                // promises.push(parseOctree(hierarchyStepSize, s.baseurl, s.name, s.item.bbox).then((r) => {
                //     s.item.children = r.children;
                // }));
            }
        }

        return Promise.all(promises).then(() => root);
    });
}

function readPositionAndColorBinFormat(ab, numPoints) {
    const view = new DataView(ab);
    let offset = 0;

    numPoints = Math.min(numPoints, Math.floor(ab.byteLength / 16));

    const positions = new Float32Array(3 * numPoints);
    const colors = new Uint8Array(4 * numPoints);

    for (let i = 0; i < numPoints; i++) {
        positions[3 * i] = view.getUint32(offset + 0, true);
        positions[3 * i + 1] = view.getUint32(offset + 4, true);
        positions[3 * i + 2] = view.getUint32(offset + 8, true);

        colors[4 * i] = view.getUint8(offset + 12);
        colors[4 * i + 1] = view.getUint8(offset + 13);
        colors[4 * i + 2] = view.getUint8(offset + 14);
        colors[4 * i + 3] = 255;

        offset += 16;
    }
    return [positions, colors];
}

function readPositionAndColorCustomBinFormat(ab, numPoints) {
    const positions = new Float32Array(ab, 6 * 4, 3 * numPoints);
    const icolors = new Uint8Array(ab, 6 * 4 + 3 * 4 * numPoints, 4 * numPoints);

    return [positions, icolors];
}

function createPickingMaterial(pointSize, canvasHeight) {
    return new THREE.ShaderMaterial( {
        uniforms: {
            size: { value: pointSize },
            scale: { value: canvasHeight * 0.5 },
        },
        vertexShader: PointsVS,
        fragmentShader: PointsFS,
    });
}

let nextuuid = 1;
function loadBin(url, readPositionAndColor, hasBbox, unused, cmd) {
    return fetch(url, { credentials: 'include' }).then(foo => foo.arrayBuffer()).then((ab) => {
        // hardcoded position + color
        const numPoints = (ab.byteLength - (hasBbox ? 6 * 4 : 0)) / (3 * 4 + 4 * 1);

        const [positions, colors] = readPositionAndColor(ab, numPoints);

        let tightbbox;
        if (hasBbox) {
            const view = new DataView(ab, 0, 6 * 4);
            const min = new THREE.Vector3(view.getFloat32(0, true), view.getFloat32(4, true), view.getFloat32(8, true));
            const max = new THREE.Vector3(view.getFloat32(12, true), view.getFloat32(16, true), view.getFloat32(20, true));
            tightbbox = new THREE.Box3(min, max);
        } else {
            const min = new THREE.Vector3(positions[0], positions[1], positions[2]);
            const max = min.clone();
            for (let i = 1; i < numPoints; i++) {
                const v = { x: positions[3 * i], y: positions[3 * i + 1], z: positions[3 * i + 2] };
                min.min(v);
                max.max(v);
            }
            tightbbox = new THREE.Box3(min, max);
        }

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 4, true));

        // generate unique id for picking
        const ids = new Uint8Array(4 * numPoints);
        const base_id = nextuuid++;
        if (numPoints > 0xffff) {
            throw new Error('unhandled value');
        }
        for (let i = 0; i < numPoints; i++) {
            // todo numpoints > 16bits
            const v     = (base_id << 16) | i;
            ids[4 * i + 0] = (v & 0xff000000) >> 24;
            ids[4 * i + 1] = (v & 0x00ff0000) >> 16;
            ids[4 * i + 2] = (v & 0x0000ff00) >> 8;
            ids[4 * i + 3] = (v & 0x000000ff) >> 0;
        }

        geometry.addAttribute('unique_id', new THREE.BufferAttribute(ids, 4, true));


        geometry.computeBoundingSphere(); // TODO: use tightbbox

        let material = new THREE.PointsMaterial({
            size: 2.05,
            // color: 0xff0000,
            vertexColors: THREE.VertexColors,
            sizeAttenuation: false });

        let pickingMaterial = createPickingMaterial(2.05, cmd.view.mainLoop.gfxEngine.getWindowSize().y);


        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.baseId = base_id;
        points.realPointCount = numPoints;
        points.tightbbox = tightbbox;
        points.materials = {
            color: material,
            picking: pickingMaterial,
        };

        return points;
    });
}


PointCloudProvider.prototype.preprocessDataLayer = function preprocessDataLayer(layer) {
    if (!layer.file) {
        layer.file = 'cloud.js';
    }
    Fetcher.json(`${layer.url}/${layer.file}`, { credentials: 'include' }).then((cloud) => {
        // eslint-disable-next-line no-console
        layer.metadata = cloud;
        const bbox = new THREE.Box3(
            new THREE.Vector3(cloud.boundingBox.lx, cloud.boundingBox.ly, cloud.boundingBox.lz),
            new THREE.Vector3(cloud.boundingBox.ux, cloud.boundingBox.uy, cloud.boundingBox.uz));

        parseOctree(cloud.hierarchyStepSize, `${layer.url}/${cloud.octreeDir}/r`, '', bbox).then((root) => {
            // eslint-disable-next-line no-console
            console.log(`${hrcCount} files loaded`);
            // eslint-disable-next-line no-console
            console.log('LAYER metadata:', root);
            layer.root = root;
        });
    });
};


PointCloudProvider.prototype.executeCommand = function executeCommand(command) {
    const layer = command.layer;
    var node = command.requester;

    const extension = layer.useBrotli ? 'bin.br' : 'bin';
    const url = `${node.baseurl}/r${node.name}.${extension}`;

    if (!(url in this.requests)) {
        const hasBbox = layer.file.indexOf('custombin.js') >= 0;

        this.requests[url] = loadBin(`${node.baseurl}/r${node.name}.${extension}`,
                                     layer.customBinFormat ? readPositionAndColorCustomBinFormat : readPositionAndColorBinFormat, hasBbox,
                                     node.numPoints || node.n, command).then((points) => {
                                         points.position.copy(node.bbox.min);
                                         points.scale.set(layer.metadata.scale, layer.metadata.scale, layer.metadata.scale);
                                         points.tightbbox.min.x *= layer.metadata.scale;
                                         points.tightbbox.min.y *= layer.metadata.scale;
                                         points.tightbbox.min.z *= layer.metadata.scale;
                                         points.tightbbox.max.x *= layer.metadata.scale;
                                         points.tightbbox.max.y *= layer.metadata.scale;
                                         points.tightbbox.max.z *= layer.metadata.scale;
                                         points.tightbbox.translate(node.bbox.min);
                                         points.updateMatrix();
                                         points.updateMatrixWorld(true);
                                         points.layers.set(layer.threejsLayer);
                                         return points;
                                     });
    }


    return this.requests[url];
};

export default PointCloudProvider;
