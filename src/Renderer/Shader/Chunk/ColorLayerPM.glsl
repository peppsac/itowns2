if(visibility[REPLACE_INDEX]) {
    vec4 paramsA = paramLayers[REPLACE_INDEX];

    if(paramsA.w > 0.0) {
        int textureIndex = REPLACE_TEXTURE_INDEX + pmSubTextureIndex;
        vec2 uvIn = uvPM;
        vec4 p = paramByIndex(offsetScaleAtlas, textureIndex);

        vec2 uv = vec2(
            uvIn.x * p.z + p.x,
            1.0 - ((1.0 - uvIn.y) * p.w + p.y));
        vec4 layerColor = texture2D(atlasTextures[REPLACE_INDEX], uv);

        if (weights[REPLACE_INDEX] < 1.0) {
            vec4 oldp = paramByIndex(oldOffsetScaleAtlas, textureIndex);

            vec2 olduv = vec2(
                uvIn.x * oldp.z + oldp.x,
                1.0 - ((1.0 - uvIn.y) * oldp.w + oldp.y));

            vec4 oldLayerColor = texture2D(oldAtlasTextures[REPLACE_INDEX], olduv);
            layerColor = mix(oldLayerColor, layerColor, weights[REPLACE_INDEX]);
        }

        if (layerColor.a > 0.0) {
            diffuseColor = mixLayerColor(diffuseColor, layerColor, paramsA);
        }
    }
}
