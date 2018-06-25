import { Vector2, Vector4, Uniform, NoBlending, NormalBlending, RawShaderMaterial } from 'three';
import PointsVS from './Shader/PointsVS.glsl';
import PointsFS from './Shader/PointsFS.glsl';
import Capabilities from '../Core/System/Capabilities';

class PointsMaterial extends RawShaderMaterial {
    constructor(options = {}) {
        super(options);
        this.vertexShader = PointsVS;
        this.fragmentShader = PointsFS;

        this.size = options.size || 0;
        this.scale = options.scale || 0.05 * 0.5 / Math.tan(1.0 / 2.0); // autosizing scale
        this.overlayColor = options.overlayColor || new Vector4(0, 0, 0, 0);

        this.uniforms.size = new Uniform(this.size);
        this.uniforms.pickingMode = new Uniform(false);
        this.uniforms.textureMode = new Uniform(false);
        this.uniforms.opacity = new Uniform(this.opacity);
        this.uniforms.overlayColor = new Uniform(this.overlayColor);

        if (Capabilities.isLogDepthBufferSupported()) {
            this.defines = {
                USE_LOGDEPTHBUF: 1,
                USE_LOGDEPTHBUF_EXT: 1,
            };
        }

        if (__DEBUG__) {
            this.defines.DEBUG = 1;
        }
        this.colorLayer = null;

        this.updateUniforms();
    }

    enablePicking(pickingMode) {
        // we don't want pixels to blend over already drawn pixels
        this.uniforms.pickingMode.value = pickingMode;
        this.blending = pickingMode ? NoBlending : NormalBlending;
    }

    updateUniforms() {
        // if size is null, switch to autosizing using the canvas height
        this.uniforms.size.value = (this.size > 0) ? this.size : -this.scale * window.innerHeight;
        this.uniforms.opacity.value = this.opacity;
        this.uniforms.overlayColor.value = this.overlayColor;
    }

    update(source) {
        this.visible = source.visible;
        this.opacity = source.opacity;
        this.transparent = source.transparent;
        this.size = source.size;
        this.scale = source.scale;
        this.overlayColor.copy(source.overlayColor);
        this.updateUniforms();
        return this;
    }

    // Coloring support
    pushLayer(layer, extents) {
        this.colorLayer = layer;

        this.uniforms.textureMode.value = true;
        this.uniforms.texture = new Uniform();
        this.uniforms.offsetScale = new Uniform(new Vector4(0, 0, 1, 1));
        this.uniforms.extentTopLeft = new Uniform(new Vector2(extents[0].west(), extents[0].north()));
        const dim = extents[0].dimensions();
        this.uniforms.extentSize = new Uniform(new Vector2(dim.x, dim.y));
    }

    getLayerTextures(layer) {
        if (layer === this.colorLayer) {
            return [this.uniforms.texture.value];
        }
    }
    setLayerTextures(layer, textures) {
        if (Array.isArray(textures)) {
            textures = textures[0];
        }
        if (layer === this.colorLayer) {
            this.uniforms.texture.value = textures.texture;
            this.uniforms.offsetScale.value.copy(textures.pitch);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    setSequence() {
        // no-op
    }

    // eslint-disable-next-line class-methods-use-this
    setLayerVisibility() {
        // no-op
    }

    // eslint-disable-next-line class-methods-use-this
    setLayerOpacity() {
        // no-op
    }
}

export default PointsMaterial;
