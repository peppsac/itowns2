import SchemeTile from '../Core/Geographic/SchemeTile';

function frustumCullingOBB(node, camera) {
    return camera.isBox3DVisible(node.OBB().box3D, node.OBB().matrixWorld);
}

export function planarCulling(node, camera) {
    return !frustumCullingOBB(node, camera);
}

function _isTileBigOnScreen(camera, node) {
    const onScreen = camera.box3DSizeOnScreen(node.geometry.OBB.box3D, node.matrixWorld);

    const dim = {
        x: 0.5 * (onScreen.max.x - onScreen.min.x),
        y: 0.5 * (onScreen.max.y - onScreen.min.y),
    };

    return (dim.x > 0.3 && dim.y >= 0.3);
}

export function planarSubdivisionControl(maxLevel) {
    return function _planarSubdivisionControl(context, layer, node) {
        if (maxLevel <= node.level) {
            return false;
        }

        return _isTileBigOnScreen(context.camera, node);
    };
}

export function planarSchemeTile(bbox) {
    const planeSchemeTile = new SchemeTile();
    planeSchemeTile.add(bbox);
    return planeSchemeTile;
}
