/* global describe, it */
import assert from 'assert';
import { TextDecoder } from '../src/utils/polyfill';
import Scheduler from '../src/Core/Scheduler/Scheduler';

const scheduler = new Scheduler();
global.window = {
    addEventListener() {},
    setTimeout,
};

scheduler.addProtocolProvider('test', {
    executeCommand: (cmd) => {
        setTimeout(() => {
            cmd.done = true;
            cmd._r(cmd);
        }, 0);
        return new Promise((resolve) => {
            cmd._r = resolve;
        });
    }
});

const view = {
    notifyChange: () => {}
};

function cmd(layerId = 'foo', prio = 0) {
    return {
        layer: {
            id: layerId,
            protocol: 'test'
        },
        view,
        priority: prio
    };
}

describe('Command execution', function () {
    it('should execute one command', function (done) {
        scheduler.execute(cmd()).then((c) => {
            assert.ok(c.done);
            done();
        });
    });

    it('should execute 100 commands', function (done) {
        const promises = [];
        for (let i = 0; i < 100; i++) {
            promises.push(scheduler.execute(cmd()));
        }

        Promise.all(promises).then((commands) => {
            for (const cmd of commands) {
                assert.ok(cmd.done);
            }
            done();
        });
    });

    it('should execute balance commands between layers', function (done) {
        const results = [];
        const promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(scheduler.execute(cmd('layer0', 1000)).then(
                (c) => { results.push(c); }
            ));
            promises.push(scheduler.execute(cmd('layer1', 1)).then(
                (c) => { results.push(c); }
            ));
        }

        Promise.all(promises).then(() => {
            for (let i = 0; i < 100; i++) {
                assert.equal(results[i].layer.id, ('layer' + (i % 2)));
            }
            done();
        });
    });
});
