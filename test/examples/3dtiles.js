/* global describe, it, browser */
const assert = require('assert');

describe('3dtiles example', function () {
    it('should run...', () => {
        return browser.newPage().then((page) => {
            page.setViewport({ width: 400, height: 300 });
            return page.goto('http://localhost:8080/examples/3dtiles.html')
                .then(() => page.waitFor('#viewerDiv > canvas'))
                .then(() => exampleCanRenderTest(page))
                .then((result) => {
                    console.log('Rendering complete', process.env.SCREENSHOT_FOLDER);
                    if (process.env.SCREENSHOT_FOLDER) {
                        return page.screenshot(
                            {path: `${process.env.SCREENSHOT_FOLDER}/3dtiles.png`})
                        .then(() => result);
                    } else {
                        return result;
                    }
                })
            }).then(result => {
                assert.equal(true, result);
            });
        });
});
