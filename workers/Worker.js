import * as Implem from '../src/Renderer/ThreeExtended/GeoJSON2FeaturesImplementation';
import proj4 from 'proj4';
import Extent from '../src/Core/Geographic/Extent';

proj4.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs');

self.addEventListener('message', (evt) => {
    // rebuild functions
    const cmd = evt.data;
    if (cmd.options.style) {
        cmd.options.style = new Function(...cmd.options.style.argNames, cmd.options.style.body);
    }
    if (cmd.options.filter) {
        cmd.options.filter = new Function(...cmd.options.filter.argNames, cmd.options.filter.body);
    }

    if (cmd.filteringExtent) {
        const s = cmd.filteringExtent._internalStorageUnit;
        cmd.filteringExtent = new Extent(
            cmd.filteringExtent._crs,
            ...cmd.filteringExtent._values);
        cmd.filteringExtent._internalStorageUnit = s;
    }

    let features;
    switch (cmd.json.type.toLowerCase()) {
        case 'featurecollection':
            features = Implem.readFeatureCollection(cmd.crsIn, cmd.crsOut, cmd.json, cmd.filteringExtent, cmd.options);
            break;
        case 'feature':
            features = Implem.readFeature(cmd.crsIn, cmd.crsOut, cmd.json, cmd.filteringExtent, cmd.options);
            break;
        default:
            throw new Error(`Unsupported GeoJSON type: '${json.type}`);
    }

    postMessage({ features, promiseId: evt.data.promiseId });
});
