/**
 * Creates a provider for panoramic images/
 * Get metadata for extrinseque info and also intrinseque
 * @class Manage the panoramic provider (url, request)
 * @author alexandre devaux IGN
 * @requires ThreeJS
 *
 */

/* global Promise*/

import * as THREE from 'three';
import Provider from './Provider';
import BuildingBox_Provider from './BuildingBox_Provider';
import ProjectiveTexturingMaterial from '../../../Renderer/ProjectiveTexturingMaterial';
import BasicMaterial from '../../../Renderer/BasicMaterial';
import PanoramicMesh from '../../../Renderer/PanoramicMesh';


let _options = null;
let _urlPano = '';
let _urlImage = '';
let _urlCam = '';
let _panoramicsMetaDataPromise;


function PanoramicProvider(options) {
    if (options) {
        _options = options;
        _urlPano = options.pano;
        _urlImage = options.url;
        _urlCam = options.cam;
    }
    this.panoInfo = null;
    this.geometry = null;
    this.material = null;
    this.absoluteCenter = null; // pivot in fact here, not absoluteCenter
    this.geometryRoof = null;
    this.panoramicMesh = null;
    this.projectiveTexturedMesh = null;
}

PanoramicProvider.prototype = Object.create(Provider.prototype);
PanoramicProvider.prototype.constructor = PanoramicProvider;


PanoramicProvider.prototype.init = function init(options) {
    _urlPano = options.pano;
    _urlImage = options.url;
    _urlCam = options.cam;
};

/**
 * Return metadata info for panoramic closest to position in parameter
 * @param {type} longitude
 * @param {type} latitude
 * @param {type} distance
 * @returns {Promise}
 */
PanoramicProvider.prototype.getMetaDataFromPos = function getMetaDataFromPos(longitude, latitude) {
    if (_panoramicsMetaDataPromise == null) {
        var requestURL = _urlPano; // TODO : string_format
        _panoramicsMetaDataPromise = new Promise((resolve, reject) => {
            var req = new XMLHttpRequest();
            req.open('GET', requestURL);

            req.onload = function onloadFn() {
                if (req.status === 200) {
                    resolve(JSON.parse(req.response));
                } else {
                    reject(Error(req.statusText));
                }
            };

            req.onerror = function onerrorFn() {
                reject(Error('Network Error'));
            };

            req.send();
        });
    }
    return _panoramicsMetaDataPromise.then((panoramicsMetaData) => {
        var indiceClosest = 0;
        var distMin = 99999;
        for (var i = 0; i < panoramicsMetaData.length; ++i) {
            var p = panoramicsMetaData[i];
            var dist = Math.sqrt((p.longitude - longitude) * (p.longitude - longitude) + (p.latitude - latitude) * (p.latitude - latitude));
            if (dist < distMin) {
                indiceClosest = i;
                distMin = dist;
            }
        }
        // FIXME: not concurrency-safe; modifying state depending on method call parameter
        this.panoInfo = panoramicsMetaData[indiceClosest];
        return panoramicsMetaData[indiceClosest];
    });
};

PanoramicProvider.prototype.getTextureMaterial = function getTextureMaterial(panoInfo, pivot) {
    return ProjectiveTexturingMaterial.init(_options, panoInfo, pivot); // Initialize itself Ori

    // ProjectiveTexturingMaterial.createShaderMat(_options);
    // return ProjectiveTexturingMaterial.getShaderMat();
};


PanoramicProvider.prototype.updateTextureMaterial = function updateTextureMaterial(panoInfo, pivot) {
    ProjectiveTexturingMaterial.updateUniforms(panoInfo, pivot);
};


PanoramicProvider.prototype.getGeometry = function getGeometry(longitude, latitude, altitude) {
    var w = 0.003;
    var bbox = {
        minCarto: {
            longitude: longitude - w,
            latitude: latitude - w,
        },
        maxCarto: {
            longitude: longitude + w,
            latitude: latitude + w,
        },
    };
    // console.log(bbox);
    var options = options || {
        url: 'http://wxs.ign.fr/72hpsel8j8nhb5qgdh07gcyp/geoportail/wfs?',
        typename: 'BDTOPO_BDD_WLD_WGS84G:bati_remarquable,BDTOPO_BDD_WLD_WGS84G:bati_indifferencie',
        bbox,
        epsgCode: 4326,
    };

    var buildingBox_Provider = new BuildingBox_Provider(options);

    return buildingBox_Provider.getData(options.bbox, altitude).then(() => ({
        geometry: buildingBox_Provider.geometry,
        pivot: buildingBox_Provider.pivot,
        roof: buildingBox_Provider.geometryRoof,
    }));
};


// Manages 3 asynchronous functions
// - Get Pano closest to lon lat (panoramic metadata)
// - Get sensors informations (camera calibration)
// - Get Building boxes from WFS
PanoramicProvider.prototype.getTextureProjectiveMesh = function getTextureProjectiveMesh(longitude, latitude, distance) {
    return this.getMetaDataFromPos(longitude, latitude, distance).then(panoInfo => this.getGeometry(panoInfo.longitude, panoInfo.latitude, panoInfo.altitude)).then((data) => {
        this.geometry = data.geometry;
        this.absoluteCenter = data.pivot; // pivot in fact here, not absoluteCenter
        this.geometryRoof = data.roof;

        return this.getTextureMaterial(this.panoInfo, this.absoluteCenter);
    }).then(function thenCb(shaderMaterial) {
        this.material = shaderMaterial; // new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.8});
        // this.projectiveTexturedMesh = new THREE.Mesh(this.geometry, this.material);
        this.panoramicMesh = new PanoramicMesh(this.geometry, this.material, this.absoluteCenter);
        var roofMesh = new PanoramicMesh(this.geometryRoof, new BasicMaterial(new THREE.Color(0xdddddd)), this.absoluteCenter);
        roofMesh.material.side = THREE.DoubleSide;
        roofMesh.material.transparent = true;
        roofMesh.setDisplayed(true);
        roofMesh.material.uniforms.lightingEnabled.value = false;

        this.panoramicMesh.add(roofMesh);

        // console.log(this.panoramicMesh);
        // console.log(roofMesh);
        return this.panoramicMesh;
    });
};

// Update existing panoramic mesh with new images look for the closest to parameters position
PanoramicProvider.prototype.updateMaterialImages = function updateMaterialImages(longitude, latitude, distance) {
    return this.getMetaDataFromPos(longitude, latitude, distance).then((panoInfo) => {
        this.updateTextureMaterial(panoInfo, this.absoluteCenter);
        return panoInfo;
    });
};


PanoramicProvider.prototype.getUrlImageFile = function getUrlImageFile() {
    return _urlImage;
};

PanoramicProvider.prototype.getMetaDataSensorURL = function getMetaDataSensorURL() {
    return _urlCam;
};

PanoramicProvider.prototype.getMetaDataSensor = function getMetaDataSensor() {


};


export default PanoramicProvider;
