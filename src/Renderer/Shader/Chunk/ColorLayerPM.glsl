if(visibility[REPLACE_INDEX]) {
    vec4 paramsA = paramLayers[REPLACE_INDEX];

    if(paramsA.w > 0.0) {
        int textureIndex = REPLACE_TEXTURE_INDEX + pmSubTextureIndex;
        vec2 uvIn = uvPM;
        vec4 p = paramByIndex(textureIndex);

        vec2 uv = vec2(
            uvIn.x * p.z + p.x,
            1.0 - ((1.0 - uvIn.y) * p.w + p.y));
        vec4 layerColor = texture2D(atlasTextures[REPLACE_INDEX], uv);

        if (layerColor.a > 0.0) {
            diffuseColor = mixLayerColor(diffuseColor, layerColor, paramsA);
        }
    }
}
