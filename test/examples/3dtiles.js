/* global describe, it, browser */
const assert = require('assert');

describe('3dtiles example', function () {
    // it('should run...', () => {
    //     return browser.newPage().then((page) => {
    //         page.setViewport({ width: 400, height: 300 });
    //         return page.goto('http://localhost:8080/examples/3dtiles.html')
    //             .then(() => page.waitFor('#viewerDiv > canvas'))
    //             .then(() => exampleCanRenderTest(page))
    //             .then((result) => {
    //                 if (process.env.SCREENSHOT_FOLDER) {
    //                     return page.screenshot(
    //                         {path: `${process.env.SCREENSHOT_FOLDER}/3dtiles.png`})
    //                     .then(() => result);
    //                 } else {
    //                     return result;
    //                 }
    //             })
    //         }).then(result => {
    //             assert.equal(true, result);
    //         });
    //     });

    // it('should return the dragon and the globe', () => {
    //     return browser.newPage().then((page) => {
    //         page.setViewport({ width: 400, height: 300 });
    //         return page.goto('http://localhost:8080/examples/3dtiles.html')
    //             .then(() => page.waitFor('#viewerDiv > canvas'))
    //             .then(() => exampleCanRenderTest(page))
    //             .then(() => {
    //                 return page.evaluate(() => {
    //                     return view.pickObjectsAt({x: 195, y: 146}).map(p => p.layer);
    //                 })
    //             })
    //         }).then(layers => {
    //             assert.ok(layers.indexOf('globe') >= 0);
    //             assert.ok(layers.indexOf('3d-tiles-discrete-lod') >= 0);
    //             assert.ok(layers.indexOf('3d-tiles-request-volume') == -1);
    //         })
    //     });

    it('should return points', () => {
        return browser.newPage().then((page) => {
            page.setViewport({ width: 400, height: 300 });
            return page.goto('http://localhost:8080/examples/3dtiles.html')
                .then(() => page.waitFor('#viewerDiv > canvas'))
                .then(() => { console.log('STEP 0'); })
                .then(() => exampleCanRenderTest(page))
                .then(() => {
                    console.log('STEP 1');
                    return page.evaluate(() => {
                        d.zoom();
                    });
                })
                .then(() => page.screenshot({path: `${process.env.SCREENSHOT_FOLDER}/3dtiles2.png`}))
                .then(() => {
                    console.log('GO')
                    return page.evaluate(() => {
                        return new Promise(resolve => {
                            const total = [];
                            view.addFrameRequester('update_end', () => {
                                total.push({
                                    t: view.mainLoop.scheduler.commandsWaitingExecutionCount(),
                                    e: view.mainLoop.scheduler.commandsRunningCount()
                                });
                                view.notifyChange(false);
                            });
                            view.mainLoop.addEventListener('command-queue-empty', () => {
                                resolve(view.pickObjectsAt({x: 200, y: 150}, '3d-tiles-request-volume').length);
                            });
                            setTimeout(() => {
                                const a = [];
                                const b = [];
                                $3dTilesLayerDiscreteLOD.pending.forEach(e => a.push(e));
                                $3dTilesLayerRequestVolume.pending.forEach(e => b.push(e));
                                resolve(
                                {
                                    total,
                                    a,
                                    b
                                }) }, 10000);
                            view.notifyChange(true);

                            //     // if (view.mainLoop.renderingState == 0) {
                            //         resolve(view.pickObjectsAt({x: 200, y: 150}, '3d-tiles-request-volume').length);
                            //     // }
                            // });
                            // view.notifyChange(false);
                        });
                    });
                })
                .then(picking_count => {
                    console.log(picking_count);
                    assert.ok(picking_count > 0);
                })
            });
        });
});
