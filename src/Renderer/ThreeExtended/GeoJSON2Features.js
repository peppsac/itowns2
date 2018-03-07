/**
 * Generated On: 2016-09-28
 * Class: FeatureToolBox
 * Description:
 */
import * as Implem from './GeoJSON2FeaturesImplementation';
import Extent from '../../Core/Geographic/Extent';
import MyWorker from 'file./../../workers/Worker.js';

const myWorker = new MyWorker();
const pendingPromises = [];

function fixExtent(obj) {
    for (let e in obj) {
        if (e == 'extent') {
            obj[e] = new Extent(obj[e]._crs, ...obj[e]._values);
        } else if (e == 'geometries') {
            for (let i = 0; i < obj[e].length; i++) {
                fixExtent(obj[e][i]);
            }
        } else if (e == 'featureVertices') {
            for (let f in obj[e]) {
                fixExtent(obj[e][f]);
            }
        }
    }
}

myWorker.onmessage = (evt) => {
    for (let i = 0; i<pendingPromises.length; i++) {
        if (pendingPromises[i]._id === evt.data.promiseId) {
            // modify all extent...
            fixExtent(evt.data.features);

            pendingPromises[i].foobar.resolve(evt.data.features);
            pendingPromises.splice(i, 1);
            return;
        }
    }
};

function passFunctionToWorker(func) {
    const funcStr = func.toString()

    //Get the name of the argument. We know there is a single argument
    //in the worker function, between the first '(' and the first ')'.
    const argNames = funcStr.substring(
        funcStr.indexOf("(") + 1, funcStr.indexOf(")")).split(',');

    //Now get the function body - between the first '{' and the last '}'.
    const body = funcStr.substring(funcStr.indexOf("{") + 1, funcStr.lastIndexOf("}"));
    return {
        argNames,
        body,
    };
}

let pId = 0;

export default {
    parse(crsOut, json, filteringExtent, options = {}) {
        if (typeof(options.style) == 'function') {
            options.style = passFunctionToWorker(options.style);
        }
        if (typeof(options.filter) == 'function') {
            options.filter = passFunctionToWorker(options.filter);
        }

        options.crsIn = options.crsIn || Implem.readCRS(json);

        let foobar = {};
        const p = new Promise((resolve, reject) => {
            foobar.resolve = resolve;
            foobar.reject = reject;
        });
        p.foobar = foobar;
        p._id = pId++;
        pendingPromises.push(p);
        myWorker.postMessage(
            {
                promiseId: p._id,
                crsIn: options.crsIn,
                options,
                crsOut,
                json,
                filteringExtent,
                options
            });

        return p;

        switch (json.type.toLowerCase()) {
            case 'featurecollection':
                return Promise.resolve(Implem.readFeatureCollection(options.crsIn, crsOut, json, filteringExtent, options));
            case 'feature':
                return Promise.resolve(Implem.readFeature(options.crsIn, crsOut, json, filteringExtent, options));
            default:
                throw new Error(`Unsupported GeoJSON type: '${json.type}`);
        }
    },
};
