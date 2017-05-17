if(visibility[REPLACE_INDEX]) {
    vec4 paramsA = paramLayers[REPLACE_INDEX];

    if(paramsA.w > 0.0) {
        vec2 uvIn = vUv_WGS84;

        vec2 uv = vec2(
            uvIn.x * offsetScaleAtlas[REPLACE_TEXTURE_INDEX].z + offsetScaleAtlas[REPLACE_TEXTURE_INDEX].x,
            1.0 - ((1.0 - uvIn.y) * offsetScaleAtlas[REPLACE_TEXTURE_INDEX].w + offsetScaleAtlas[REPLACE_TEXTURE_INDEX].y));
        vec4 layerColor = texture2D(atlasTextures[REPLACE_INDEX], uv);

        if (layerColor.a > 0.0) {
            diffuseColor = mixLayerColor(diffuseColor, layerColor, paramsA);
        }
    }
}
