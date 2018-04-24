const puppeteer = require('puppeteer');
const { execFile } = require('child_process');
const net = require('net');

function _waitServerReady(resolve) {
    const client = net.createConnection({ port: 8080 }, () => {
        resolve(true);
    });
    client.on('error', () => {
        setTimeout(() => {
            _waitServerReady(resolve);
        }, 100);
    });
}

function waitServerReady() {
    return new Promise(resolve => {
        _waitServerReady(resolve);
    });
}

before (async function () {
    // start itowns
    console.log('Starting itowns...');
    global.itownsProcess = execFile('npm', ['start'], (error, stdout, stderr) => {
        console.log(stdout);
        console.log(stderr);
    });

    // wait for port 8080 to be ready
    await waitServerReady();

    // Helper function: returns true when all layers are
    // ready and rendering has been done
    global.exampleCanRenderTest = (page) => {
        return page.evaluate(() => {
            return new Promise(resolve => {

                function getView() {
                    if (typeof(view) === 'object') {
                        return Promise.resolve(view);
                    }
                    if (typeof(globeView) === 'object') {
                        return Promise.resolve(globeView);
                    }
                    resolve(false);
                }

                getView().then((v) => {
                    v.addEventListener('layers-initialized', () => {
                        resolve(true);
                    });

                    // add dummy layer to rearm 'layers-initialized' event
                    v.addLayer({
                        id: '_________',
                        update: () => {},
                        type: 'geometry',
                    });
                });
            });
        });
    };
    global.browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});

});

// close browser and reset global variables
after (function () {
    browser.close();
    // stop itowns
    global.itownsProcess.kill('SIGINT');
});

