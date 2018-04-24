/* global describe, it, browser */
const assert = require('assert');

describe('cubic_planar example', function () {
    it('should run...', () => {
        return browser.newPage().then((page) => {
            page.setViewport({ width: 400, height: 300 });
            return page.goto('http://localhost:8080/examples/cubic_planar.html')
                .then(() => page.waitFor('#viewerDiv > canvas'))
                .then(() => exampleCanRenderTest(page))
                .then((result) => {
                    if (process.env.SCREENSHOT_FOLDER) {
                        return page.screenshot(
                            {path: `${process.env.SCREENSHOT_FOLDER}/cubic_planar.png`})
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
