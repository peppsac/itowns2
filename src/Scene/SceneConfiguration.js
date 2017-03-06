/**
 * SceneConfiguration holds the layers added to the Viewer and their respective configuration.
 * Layer's config is a simply JS object so it can store any kind of value.
 */

function SceneConfiguration() {
    this.layerTrees = [];

    // layers state (visibility, opacity)
    this.layersState = {};
}

SceneConfiguration.prototype.constructor = SceneConfiguration;

// Helper func to call fn() on each layer
function _traverseLayers(fn, stage) {
    fn(stage.layer);
    for (const child of stage.children) {
        _traverseLayers(fn, child);
    }
}

// Helper func to call fn() on each stage
function _traverseLayerTrees(fn, stage) {
    fn(stage);
    for (const child of stage.children) {
        _traverseLayerTrees(fn, child);
    }
}

/**
 * Add a layer to the scene.
 * If parentLayerId is a valid layer id, the layer will be attached to parentLayerId
 */
SceneConfiguration.prototype.addLayer = function addLayer(layer, parentLayerId) {
    if (layer.id in this.layersState) {
        throw new Error(`Layer id ${layer.id} already added`);
    }

    if (parentLayerId === undefined) {
        this.layerTrees.push({ layer, children: [] });
    } else if (!(parentLayerId in this.layersState)) {
        throw new Error(`Cannot attach layer ${layer.id} to non-added layer ${parentLayerId}`);
    } else {
        // traverse stages and attach as a child of parentLayerId
        this.traverseLayerTrees((stage) => {
            if (stage.layer.id === parentLayerId) {
                stage.children.push({ layer, children: [] });
            }
        });
    }

    this.layersState[layer.id] = {};
};

SceneConfiguration.prototype.removeLayer = function removeLayer(id) {
    if (this.layersState[id]) {
        for (let i = 0; i < this.layerTrees.length; i++) {
            const stage = this.layerTrees[i];
            if (stage.layer.id === id) {
                this.layerTrees.splice(i, 1);
                break;
            }
        }
        this.traverseLayerTrees((stage) => {
            for (let i = 0; i < stage.children.length; i++) {
                if (stage.children[i].layer.id === id) {
                    stage.children.splice(i, 1);
                }
            }
        });


        delete this.layersState[id];
        return true;
    }
    return false;
};

SceneConfiguration.prototype.traverseLayers = function traverseLayers(fn) {
    for (const stage of this.layerTrees) {
        _traverseLayers(fn, stage);
    }
};

SceneConfiguration.prototype.traverseLayerTrees = function traverseLayerTrees(fn) {
    for (const stage of this.layerTrees) {
        _traverseLayerTrees(fn, stage);
    }
};

SceneConfiguration.prototype.setLayerAttribute = function setLayerAttribute(id, attribute, value) {
    if (this.layersState[id]) {
        this.layersState[id][attribute] = value;
    } else {
        // eslint-disable-next-line no-console
        console.warn(`Invalid layer id '${id}'. Ignoring attribute definition`);
    }
};

SceneConfiguration.prototype.getLayerAttribute = function getLayerAttribute(id, attribute) {
    return this.layersState[id][attribute];
};

SceneConfiguration.prototype.getLayers = function getLayers(filter) {
    const result = [];
    this.traverseLayers((layer) => {
        if (!filter || filter(layer, this.layersState[layer.id])) {
            result.push(layer);
        }
    });
    return result;
};

// The following code is specific to color layers when using LayeredMaterial, so it probably doesn't
// belong tto this file.
SceneConfiguration.prototype.moveLayerToIndex = function moveLayerToIndex(id, newIndex) {
    if (this.layersState[id]) {
        var oldIndex = this.layersState[id].sequence;
        for (var i in this.layersState) {
            if (Object.prototype.hasOwnProperty.call(this.layersState, i)) {
                var state = this.layersState[i];
                if (state.sequence === newIndex) {
                    state.sequence = oldIndex;
                    this.layersState[id].sequence = newIndex;
                    break;
                }
            }
        }
    }
};

SceneConfiguration.prototype.moveLayerDown = function moveLayerDown(id) {
    if (this.layersState[id] && this.layersState[id].sequence > 0) {
        this.moveLayerToIndex(id, this.layersState[id].sequence - 1);
    }
};

SceneConfiguration.prototype.moveLayerUp = function moveLayerUp(id) {
    if (this.layersState[id] && this.layersState[id].sequence) {
        this.moveLayerToIndex(id, this.layersState[id].sequence + 1);
    }
};

SceneConfiguration.prototype.getColorLayersIdOrderedBySequence = function getColorLayersIdOrderedBySequence() {
    var seq = this.getLayers(l => this.getLayerAttribute(l.id, 'type') === 'color').map(l => l.id);
    seq.sort((a, b) => this.layersState[a].sequence - this.layersState[b].sequence);
    return seq;
};

export default SceneConfiguration;
