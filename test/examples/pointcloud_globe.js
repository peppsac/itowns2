/* global describe, it, browser */
const assert = require('assert');

describe('pointcloud_globe example', function () {
    it('should run...', () => {
        return browser.newPage().then((page) => {
            page.setViewport({ width: 400, height: 300 });
            return page.goto('http://localhost:8080/examples/pointcloud_globe.html')
                .then(() => page.waitFor('#viewerDiv > canvas'))
                .then(() => exampleCanRenderTest(page))
                .then((result) => {
                    if (process.env.SCREENSHOT_FOLDER) {
                        return page.screenshot(
                            {path: `${process.env.SCREENSHOT_FOLDER}/pointcloud_globe.png`})
                        .then(() => result);
                    } else {
                        return result;
                    }
                })
            }).then(result => {
                assert.ok(result);
            });
        });
});
