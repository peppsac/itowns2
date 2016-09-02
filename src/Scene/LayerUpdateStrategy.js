/**
 * This modules implements various layer update strategies.
 *
 * Default strategy is STRATEGY_MIN_NETWORK_TRAFFIC which aims
 * to reduce the amount of network traffic.
 */

export const STRATEGY_MIN_NETWORK_TRAFFIC = 0;
export const STRATEGY_GROUP               = 1;
export const STRATEGY_PROGRESSIVE         = 2;
export const STRATEGY_DICHOTOMY           = 3;

function _minimizeNetworkTraffic(nodeLevel /*, currentLevel, options */) {
    return nodeLevel;
}

// Maps nodeLevel to groups defined in layer's options
// eg with groups = [3, 7, 12]:
//     * nodeLevel = 2 -> 3
//     * nodeLevel = 4 -> 3
//     * nodeLevel = 7 -> 7
//     * nodeLevel = 15 -> 12
function _group(nodeLevel, currentLevel, options) {
    var f = options.groups.filter(val => (val <= nodeLevel));
    return f.length ? f[f.length - 1] : options.groups[0];
}

function _progressive(nodeLevel, currentLevel, options) {
    return Math.min(nodeLevel,
        currentLevel + (options.increment || 1));
}

// Load textures at mid-point between current level and node's level.
// This produces smoother transitions and a single fetch updates multiple
// tiles thanks to caching.
function _dichotomy(nodeLevel, currentLevel /*, options */) {
    return Math.min(
        nodeLevel,
        Math.ceil((currentLevel + nodeLevel) / 2));
}

export function chooseNextLevelToFetch(strategy, nodeLevel, currentLevel, options) {
    switch (strategy) {
        case STRATEGY_GROUP:
            return _group(nodeLevel, currentLevel, options);
        case STRATEGY_PROGRESSIVE:
            return _progressive(nodeLevel, currentLevel, options);
        case STRATEGY_DICHOTOMY:
            return _dichotomy(nodeLevel, currentLevel, options);
        // default strategy
        case STRATEGY_MIN_NETWORK_TRAFFIC:
        default:
            return _minimizeNetworkTraffic(nodeLevel, currentLevel, options);
    }
}


const UPDATE_IDLE = 0;
const UPDATE_PENDING = 1;
const UPDATE_ERROR = 2;

const PAUSE_BETWEEN_ERRORS = [ 1000.0, 3000.0, 7000.0 ];

function LayerUpdateState() {
    this.state = UPDATE_IDLE;
    this.lastErrorTimestamp = 0;
    this.errorCount = 0;

}

LayerUpdateState.prototype.constructor = LayerUpdateState;

LayerUpdateState.prototype.canTryUpdate = function(timestamp) {
    switch (this.state) {
        case UPDATE_IDLE: {
            return true;
        }
        case UPDATE_PENDING: {
            return false;
        }
        case UPDATE_ERROR:
        default: {
            if (3 <= this.errorCount) {
                return false;
            } else {
                return PAUSE_BETWEEN_ERRORS[this.errorCount] <= (timestamp - this.lastErrorTimestamp);
            }
        }
    }
}

LayerUpdateState.prototype.try = function() {
    this.state = UPDATE_PENDING;
}

LayerUpdateState.prototype.success = function() {
    this.lastErrorTimestamp = 0;
    this.state = UPDATE_IDLE;
}

LayerUpdateState.prototype.failure = function(timestamp) {
    this.lastErrorTimestamp = timestamp;
    this.state = UPDATE_ERROR;
    this.errorCount++;
}

export { LayerUpdateState };
