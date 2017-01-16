import { TextureLoader } from 'three';

const textureLoader = new TextureLoader();

function checkResponse(response) {
    if (response.status < 200 || response.status >= 300) {
        var error = new Error(`Error loading ${response.url}: status ${response.status}`);
        error.status = response.status;
        throw error;
    }

    if (__DEV__) {
        if (100 * Math.random() < window.itowns.viewer.Debug.networkErrorRate) {
            throw new Error('Simulated error');
        }
    }
}

export default {

    json(url) {
        return fetch(url).then((response) => {
            checkResponse(response);
            return response.json();
        });
    },

    xml(url) {
        return fetch(url).then((response) => {
            checkResponse(response);
            return response.text();
        }).then(text => new window.DOMParser().parseFromString(text, 'text/xml'));
    },

    texture(url) {
        let res;
        let rej;
        const promise = new Promise((resolve, reject) => {
            res = resolve;
            rej = reject;
        });

        const texture = textureLoader.load(url, res, () => {}, rej);
        return { texture, promise };
    },
};
