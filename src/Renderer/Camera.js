/**
 * Generated On: 2015-10-5
 * Class: Camera
 * Description: La camera scene, interface avec la camera du 3DEngine.
 */

/* global Float64Array*/

import * as THREE from 'three';

function Camera(width, height, debug) {
    this.ratio = width / height;
    this.FOV = 30;

    this.camera3D = new THREE.PerspectiveCamera(this.FOV, this.ratio);

    // /!\ WARNING Matrix JS are in Float32Array
    this.camera3D.matrixWorld.elements = new Float64Array(16);

    this.camera3D.matrixAutoUpdate = false;
    this.camera3D.rotationAutoUpdate = false;

    this._viewMatrix = new THREE.Matrix4();
    this._visibilityTestingOffset = new THREE.Vector3();
    this.width = width;
    this.height = height;

    this.cameraHelper = debug ? new THREE.CameraHelper(this.camera3D) : undefined;
}

/**
 */
Camera.prototype.position = function position() {
    return this.camera3D.position;
};

Camera.prototype.camHelper = function camHelper() {
    return this.cameraHelper;
};

Camera.prototype.createCamHelper = function createCamHelper() {
    this.cameraHelper = new THREE.CameraHelper(this.camera3D);

    var dir = new THREE.Vector3(0, 0, -1);
    var quaternion = new THREE.Quaternion();

    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.HFOV / 2);
    dir.applyQuaternion(quaternion);
    var origin = new THREE.Vector3();
    var length = 100000000;
    var hex = 0xffff00;

    this.arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
    this.cameraHelper.add(this.arrowHelper);
};

Camera.prototype.resize = function resize(width, height) {
    this.width = width;
    this.height = height;
    this.ratio = width / height;

    this.camera3D.aspect = this.ratio;
    this.camera3D.updateProjectionMatrix();

    if (this.cameraHelper) {
        var dir = new THREE.Vector3(0, 0, -1);
        var quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.HFOV / 2);
        dir.applyQuaternion(quaternion);

        this.arrowHelper.setDirection(dir);
        this.cameraHelper.update();
    }
};

Camera.prototype.update = function update() {
    // update matrix
    this.camera3D.updateMatrix();
    this.camera3D.updateMatrixWorld();

    // keep our visibility testing matrix ready
    this._visibilityTestingOffset.setFromMatrixPosition(this.camera3D.matrixWorld);
    const c = this.camera3D.matrixWorld;
    // cancel out translation
    c.setPosition({ x: 0, y: 0, z: 0 });
    this._viewMatrix.getInverse(c);
    this._viewMatrix.premultiply(this.camera3D.projectionMatrix);
    // restore translation
    c.setPosition(this._visibilityTestingOffset);
};

Camera.prototype.getDistanceFromOrigin = function getDistanceFromOrigin() {
    return this.camera3D.position.length();
};

Camera.prototype.setPosition = function setPosition(position) {
    this.camera3D.position.copy(position);
};

Camera.prototype.setRotation = function setRotation(rotation) {
    this.camera3D.quaternion.copy(rotation);
};

const temp = new THREE.Vector3();
const frustum = new THREE.Frustum();
const obbViewMatrix = new THREE.Matrix4();
Camera.prototype.isBox3DVisible = function isBox3DVisible(box3d, matrixWorld) {
    temp.setFromMatrixPosition(matrixWorld);
    matrixWorld.elements[12] -= this._visibilityTestingOffset.x;
    matrixWorld.elements[13] -= this._visibilityTestingOffset.y;
    matrixWorld.elements[14] -= this._visibilityTestingOffset.z;

    obbViewMatrix.multiplyMatrices(this._viewMatrix, matrixWorld);

    matrixWorld.setPosition(temp);

    frustum.setFromMatrix(obbViewMatrix);
    return frustum.intersectsBox(box3d);
};

export default Camera;
