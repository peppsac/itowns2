/**
 * Generated On: 2015-10-5
 * Class: CacheRessource
 * Description: Cette classe singleton est un cache des ressources et services
 */

var instanceCache = null;

function CacheRessource() {
    // Constructor

    this.cacheObjects = [];
    this._maximumSize = null;

    if (__DEV__) {
        this.statistics = { hit: 0, miss: 0, count: 0 };
    }
}

/**
 * @param url
 */
CacheRessource.prototype.getRessource = function getRessource(url) {
    if (__DEV__) {
        if (url != 16) {
            if (url in this.cacheObjects) {
                this.statistics.hit++;
            } else {
                this.statistics.miss++;
            }
        }
    }
    return this.cacheObjects[url];
};

CacheRessource.prototype.addRessource = function addRessource(url, ressource) {
    if (__DEV__) {
        this.statistics.count++;
    }
    this.cacheObjects[url] = ressource;
};


/**
 * @param id
 */
CacheRessource.prototype.getRessourceByID = function getRessourceByID(/* id*/) {
    // TODO: Implement Me

};

export default function () {
    instanceCache = instanceCache || new CacheRessource();
    return instanceCache;
}
