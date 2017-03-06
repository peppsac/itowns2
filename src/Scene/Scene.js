/**
 * Generated On: 2015-10-5
 * Class: Scene
 * Description: La Scene est l'instance principale du client. Elle est le chef orchestre de l'application.
 */

/* global window, requestAnimationFrame */

import CustomEvent from 'custom-event';
import c3DEngine from '../Renderer/c3DEngine';
import Scheduler from '../Core/Commander/Scheduler';
import CoordStars from '../Core/Geographic/CoordStars';
import StyleManager from './Description/StyleManager';
import LayersConfiguration from './LayersConfiguration';

var instanceScene = null;


const RENDERING_PAUSED = 0;
const RENDERING_ACTIVE = 1;

function Scene(positionCamera, size, viewerDiv, debugMode, gLDebug) {
    if (instanceScene !== null) {
        throw new Error('Cannot instantiate more than one Scene');
    }

    this.cameras = null;
    this.selectNodes = null;
    this.scheduler = Scheduler(this);
    this.orbitOn = false;

    this.stylesManager = new StyleManager();

    this.gLDebug = gLDebug;
    this._size = size;
    this.gfxEngine = c3DEngine(this, positionCamera.as('EPSG:4978').xyz(), viewerDiv, debugMode, gLDebug);

    this.needsRedraw = false;
    this.lastRenderTime = 0;
    this.maxFramePerSec = 60;

    this.time = 0;
    this.orbitOn = false;
    this.rAF = null;

    this.viewerDiv = viewerDiv;
    this.renderingState = RENDERING_PAUSED;
    this.layersConfiguration = new LayersConfiguration();
}

Scene.prototype.constructor = Scene;

/**
 * @documentation: return current camera
 * @returns {Scene_L7.Scene.gfxEngine.camera}
 */
Scene.prototype.currentCamera = function currentCamera() {
    return this.gfxEngine.camera;
};

Scene.prototype.currentControls = function currentControls() {
    return this.gfxEngine.controls;
};

Scene.prototype.getPickPosition = function getPickPosition(mouse) {
    return this.gfxEngine.getPickingPositionFromDepth(mouse);
};

Scene.prototype.getStyle = function getStyle(name) {
    return this.stylesManager.getStyle(name);
};

Scene.prototype.removeStyle = function removeStyle(name) {
    return this.stylesManager.removeStyle(name);
};

Scene.prototype.getStyles = function getStyles() {
    return this.stylesManager.getStyles();
};

Scene.prototype.size = function size() {
    return this._size;
};

/**
 *
 * @returns {undefined}
 */
Scene.prototype.updateScene3D = function updateScene3D() {
    this.gfxEngine.update();
};


/**
 * Notifies the scene it needs to be updated due to changes exterior to the
 * scene itself (e.g. camera movement).
 * Using a non-0 delay allows to delay update - useful to reduce CPU load for
 * non-interactive events (e.g: texture loaded)
 * needsRedraw param indicates if notified change requires a full scene redraw.
 */
Scene.prototype.notifyChange = function notifyChange(delay, needsRedraw) {
    if (delay) {
        window.setTimeout(() => { this.scheduleUpdate(needsRedraw); }, delay);
    } else {
        this.scheduleUpdate(needsRedraw);
    }
};

Scene.prototype.scheduleUpdate = function scheduleUpdate(forceRedraw) {
    this.needsRedraw |= forceRedraw;

    if (this.renderingState !== RENDERING_ACTIVE) {
        this.renderingState = RENDERING_ACTIVE;

        requestAnimationFrame(() => { this.step(); });
    }
};


function updateElement(context, layer, element, childrenStages) {
    const elements = layer.update(context, layer, element);

    if (elements) {
        for (const element of elements) {
            for (const s of childrenStages) {
                updateElement(context, s.layer, element, s.grafted);
            }
        }
    }
}

Scene.prototype.update = function update() {
    this.gfxEngine.camera.update();

    // Browse Layer tree
    const config = this.layersConfiguration;

    // TODO?
    const context = {
        camera: this.gfxEngine.camera,
        scheduler: this.scheduler,
        scene: this,
    };


    // call pre-update on all layers
    config.traverseLayers((layer) => {
        if (layer.preUpdate) {
            layer.preUpdate(context, layer);
        }
    });

    // update layers
    for (const stage of config.stages) {
        const elements = [];
        const layer = stage.layer;
        // level 0 layers get a first element-less call
        layer.update(context, layer).forEach(e => elements.push(e));

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            // update this element
            const newElements = layer.update(context, layer, element);

            for (const s of stage.children) {
                updateElement(context, s.layer, element, s.children);
            }

            // append elements to update queue
            if (newElements) {
                newElements.forEach(e => elements.push(e));
            }
        }
    }
};

Scene.prototype.step = function step() {
    // update data-structure
    this.update();

    // Check if we're done (no command left).
    // We need to make sure we didn't executed any commands because these commands
    // might spawn other commands in a next update turn.
    const executedDuringUpdate = this.scheduler.resetCommandsCount('executed');
    if (this.scheduler.commandsWaitingExecutionCount() == 0 && executedDuringUpdate == 0) {
        this.viewerDiv.dispatchEvent(new CustomEvent('globe-built'));

        // one last rendering before pausing
        this.renderScene3D();

        // reset rendering flag
        this.renderingState = RENDERING_PAUSED;
    } else {
        const ts = Date.now();

        // update rendering
        if ((1000.0 / this.maxFramePerSec) < (ts - this.lastRenderTime)) {
            // only perform rendering if needed
            if (this.needsRedraw || executedDuringUpdate > 0) {
                this.renderScene3D();
                this.lastRenderTime = ts;
            }
        }

        requestAnimationFrame(() => { this.step(); });
    }
};

/**
 */
Scene.prototype.renderScene3D = function renderScene3D() {
    this.gfxEngine.renderScene();
    this.needsRedraw = false;
};

Scene.prototype.scene3D = function scene3D() {
    return this.gfxEngine.scene3D;
};

Scene.prototype.selectNodeId = function selectNodeId(id) {
    // browse three.js scene, and mark selected node
    this.gfxEngine.scene3D.traverse((node) => {
        // only take of selectable nodes
        if (node.setSelected) {
            node.setSelected(node.id === id);

            if (node.id === id) {
                // eslint-disable-next-line no-console
                console.info(node);
            }
        }
    });
};

Scene.prototype.updateMaterialUniform = function updateMaterialUniform(uniformName, value) {
    this.gfxEngine.scene3D.traverse((obj) => {
        if (!obj.material || !obj.material.uniforms) {
            return;
        }
        if (uniformName in obj.material.uniforms) {
            obj.material.uniforms[uniformName].value = value;
        }
    });
};

// Should be moved in time module: A single loop update registered object every n millisec
Scene.prototype.animateTime = function animateTime(value) {
    if (value) {
        this.time += 4000;

        if (this.time) {
            var nMilliSeconds = this.time;
            var coSun = CoordStars.getSunPositionInScene(new Date().getTime() + 3.6 * nMilliSeconds, 0, 0);
            this.lightingPos = coSun;
            this.updateMaterialUniform('lightPosition', this.lightingPos.clone().normalize());
            this.layers[0].node.updateLightingPos(this.lightingPos);
            if (this.orbitOn) { // ISS orbit is 0.0667 degree per second -> every 60th of sec: 0.00111;
                var p = this.gfxEngine.camera.camera3D.position;
                var r = Math.sqrt(p.z * p.z + p.x * p.x);
                var alpha = Math.atan2(p.z, p.x) + 0.0001;
                p.x = r * Math.cos(alpha);
                p.z = r * Math.sin(alpha);
            }

            this.gfxEngine.update();
            // this.gfxEngine.renderScene();
        }
        this.rAF = requestAnimationFrame(this.animateTime.bind(this));
    } else
        { window.cancelAnimationFrame(this.rAF); }
};

Scene.prototype.orbit = function orbit(value) {
    // this.gfxEngine.controls = null;
    this.orbitOn = value;
};

export default function (coordinate, viewerDiv, debugMode, gLDebug) {
    instanceScene = instanceScene || new Scene(coordinate, viewerDiv, debugMode, gLDebug);
    return instanceScene;
}
