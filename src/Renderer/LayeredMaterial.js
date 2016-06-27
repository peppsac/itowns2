/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


define('Renderer/LayeredMaterial', ['THREE',
    'Renderer/BasicMaterial',
    'Renderer/c3DEngine',
    'Core/System/JavaTools',
    'Renderer/Shader/GlobeVS.glsl',
    'Renderer/Shader/GlobeFS.glsl'
], function(
    THREE,
    BasicMaterial,
    gfxEngine,
    JavaTools,
    GlobeVS,
    GlobeFS) {

    var emptyTexture = new THREE.Texture();

    emptyTexture.level = -1;
    //emptyTexture.layerId = null;
    var nbLayer = 2;


    var vector = new THREE.Vector3(0.0, 0.0, 0.0);
    var vector2 = new THREE.Vector2(0.0, 0.0);
    var vector4 = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);

    var LayeredMaterial = function(id) {

        BasicMaterial.call(this);

        var maxTexturesUnits =  gfxEngine().glParams.maxTexturesUnits;
        this.vertexShader = GlobeVS;

        var customFS = '#extension GL_EXT_frag_depth : enable\n';
        customFS += 'const int   TEX_UNITS   =' + (maxTexturesUnits-1).toString() + ';\n';

        this.fragmentShader = customFS + GlobeFS;

        this.Textures = [];
        this.pitScale = [];
        this.nbTextures = [];
        //this.paramLayers = [];
        //this.mapLayerColor = [];

        this.nColorLayer = 1;

        // Uniform three js needs no empty array
        for (var l = 0; l < nbLayer; l++) {

            // WARNING TODO prevent empty slot, but it's not the solution
            this.pitScale[l] = Array(maxTexturesUnits-1).fill(vector);
            this.nbTextures[l] = 0;
        }

        this.Textures[0] = [emptyTexture];
        this.Textures[1] = Array(maxTexturesUnits-1).fill(emptyTexture);

        this.paramLayers = Array(8).fill(vector4);
        this.paramBLayers = Array(8).fill(vector2);

        this.uniforms.dTextures_00 = {
            type: "tv",
            value: this.Textures[0]
        };
        this.uniforms.dTextures_01 = {
            type: "tv",
            value: this.Textures[1]
        };
        this.uniforms.nbTextures = {
            type: "iv1",
            value: this.nbTextures
        };
        this.uniforms.nColorLayer = {
            type: "i",
            value: this.nColorLayer
        };

        // PIT n Textures
        // Projection
        // Visible
        // Opacity

        this.uniforms.paramLayers = {
            type: "v4v",
            value: this.paramLayers
        };

        this.uniforms.paramBLayers = {
            type: "v2v",
            value: this.paramBLayers
        };

        this.uniforms.pitScale_L00 = {
            type: "v3v",
            value: this.pitScale[0]
        };
        this.uniforms.pitScale_L01 = {
            type: "v3v",
            value: this.pitScale[1]
        };
        this.uniforms.pickingRender = {
            type: "i",
            value: 0
        };
        this.uniforms.lightingOn = {
             type: "i",
             value: gfxEngine().lightingOn
        },
        this.uniforms.lightPosition = {
            type: "v3",
            value: new THREE.Vector3(-0.5, 0.0, 1.0)
        };

        this.setUuid(id || 0);
        this.wireframe = false;
        //this.wireframe = true;

    };

    LayeredMaterial.prototype = Object.create(BasicMaterial.prototype);
    LayeredMaterial.prototype.constructor = LayeredMaterial;

    LayeredMaterial.prototype.dispose = function() {

        this.dispatchEvent({
            type: 'dispose'
        });

        for (var l = 0; l < nbLayer; l++)
            for (var i = 0, max = this.Textures[l].length; i < max; i++)
                if (this.Textures[l][i] instanceof THREE.Texture)
                    this.Textures[l][i].dispose();

        var jT = new JavaTools();

        jT.freeArray(this.Textures[0]);
        jT.freeArray(this.Textures[1]);

        jT.freeArray(this.uniforms.dTextures_00.value);
        jT.freeArray(this.uniforms.dTextures_01.value);
    };

    LayeredMaterial.prototype.nbLoadedTextures = function() {

        return this.nbTextures[0] + this.nbTextures[1];
    };

    LayeredMaterial.prototype.setTexture = function(texture, layer, slot, pitScale) {
        if (texture === undefined ||texture.image === undefined) {
            console.error('Invalid texture');
            return;
        }

        if(this.Textures[layer][slot] === undefined || this.Textures[layer][slot].image === undefined) {
            this.nbTextures[layer] += 1 ;
        }

        // BEWARE: array [] -> size: 0; array [10]="wao" -> size: 11
        this.Textures[layer][slot] = texture ? texture : emptyTexture;
        this.pitScale[layer][slot] = pitScale ? pitScale : new THREE.Vector3(0.0,0.0,1.0);

        // TEMP
        if(texture === null)
        {
            var l = this.getIdLayer(slot);
            if(l)
                this.paramLayers[l].z = 0;
        }

    };

    LayeredMaterial.prototype.getIdLayer = function(slot)
    {
        for (var l = 0; l < this.paramLayers.length; l++)
        {
            if(slot===this.paramLayers[l].x)
                return l;
        }


    };

    LayeredMaterial.prototype.setParam = function(param)
    {
        this.uniforms.nColorLayer.value = param.length;
        for (var l = 0; l < param.length; l++)
        {
            this.paramLayers[l] = new THREE.Vector4(param[l].pit, param[l].tileMT  === 'PM' ? 1 : 0,param[l].visible,param[l].opacity);
            this.paramBLayers[l] = new THREE.Vector2(param[l].fx, 0.0);
        }
    }

    LayeredMaterial.prototype.setTexturesLayer = function(textures, layer){

        for (var i = 0, max = textures.length; i < max; i++) {
            var tex = textures[i];
            if(tex) {
                this.setTexture(tex.texture, layer, i, tex.pitch);
            }

        }
    };

    LayeredMaterial.prototype.getDelta = function()
    {

        if(this.paramLayers[0])
            return this.paramLayers[0].y;
        else
            return 0;

    };

    LayeredMaterial.prototype.enablePickingRender = function(enable) {
        this.uniforms.pickingRender.value = enable === true ? 1 : 0;

    };

    LayeredMaterial.prototype.setLightingOn = function (enable){
        this.uniforms.lightingOn.value = enable === true ? 1 : 0;
    };

    LayeredMaterial.prototype.setLayerOpacity = function (id,opacity){

        if(this.paramLayers[id])
        {
            this.paramLayers[id].w = opacity;
        }
    };

    LayeredMaterial.prototype.setLayerVibility = function (id,visible){

        if(this.paramLayers[id])
        {
            this.paramLayers[id].z = visible ? 1 : 0;
        }
    };

    LayeredMaterial.prototype.setNbLayersColor = function (n)
    {
        this.uniforms.nColorLayer.value = n;
    };

    LayeredMaterial.prototype.getLevelLayerColor = function (id)
    {

        var level  = this.Textures[id][0].level;

        return level;
    };


    return LayeredMaterial;
});
