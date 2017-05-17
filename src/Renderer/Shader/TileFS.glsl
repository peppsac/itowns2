// BUG CHROME 50 UBUNTU 16.04
// Lose context on compiling shader with too many IF STATEMENT
// runconformance/glsl/bugs/conditional-discard-in-loop.html
// conformance/glsl/bugs/nested-loops-with-break-and-continue.html
// Resolve CHROME unstable 52

const vec4 CFog = vec4( 0.76, 0.85, 1.0, 1.0);
const vec4 CWhite = vec4(1.0,1.0,1.0,1.0);
const vec4 CBlueOcean = vec4( 0.04, 0.23, 0.35, 1.0);
const vec4 COrange = vec4( 1.0, 0.3, 0.0, 1.0);
const vec4 CRed = vec4( 1.0, 0.0, 0.0, 1.0);


// Per layer uniforms
uniform vec4        paramLayers[ColorLayersCount];
uniform bool        visibility[ColorLayersCount];
uniform sampler2D   atlasTextures [ColorLayersCount];
uniform vec4        offsetScaleAtlas[8];

uniform float       distanceFog;
uniform int         colorLayersCount;
uniform vec3        lightPosition;

// Options global
uniform bool        selected;
uniform bool        lightingEnabled;

varying vec2        vUv_WGS84;
varying float       vUv_PM;
varying vec3        vNormal;

#if defined(DEBUG)
    uniform bool showOutline;
    const float sLine = 0.008;
#endif

vec4 paramByIndex(int index) {
REPLACE_PARAM_BY_INDEX
}

vec4 mixLayerColor(vec4 diffuseColor, vec4 layerColor, vec4 layerParams) {
    float lum = 1.0;

    if (layerParams.z > 0.0) {
        float a = max(0.05,1.0 - length(layerColor.xyz-CWhite.xyz));
        if(layerParams.z > 2.0) {
            a = (layerColor.r + layerColor.g + layerColor.b)*0.333333333;
            layerColor*= layerColor*layerColor;
        }
        lum = 1.0-pow(abs(a),layerParams.z);
    }

    return mix( diffuseColor,layerColor, lum*layerParams.w * layerColor.a);
}

void main() {
    #if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
	   gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;
    #endif

    #if defined(DEBUG)
    if (showOutline && (vUv_WGS84.x < sLine || vUv_WGS84.x > 1.0 - sLine || vUv_WGS84.y < sLine || vUv_WGS84.y > 1.0 - sLine)) {
        gl_FragColor = CRed;
        return;
    }

    #endif

    // Reconstruct PM uv and PM subtexture id (see TileGeometry)
    vec2 uvPM ;
    uvPM.x             = vUv_WGS84.x;
    float y            = vUv_PM;
    int pmSubTextureIndex = int(floor(y));
    uvPM.y             = y - float(pmSubTextureIndex);

    #if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
    float depth = gl_FragDepthEXT / gl_FragCoord.w;
    float fogIntensity = 1.0/(exp(depth/distanceFog));
    #else
    float fogIntensity = 1.0;
    #endif

    vec4 diffuseColor = CBlueOcean;

    // --------------8<----------------------
    REPLACE_COLOR_LAYER
    // --------------8<----------------------

    // Selected
    if(selected) {
        diffuseColor = mix(COrange, diffuseColor, 0.5 );
    }

    // Fog
    gl_FragColor = mix(CFog, diffuseColor, fogIntensity);
    gl_FragColor.a = 1.0;

    if(lightingEnabled) {   // Add lighting
        float light = min(2. * dot(vNormal, lightPosition),1.);
        gl_FragColor.rgb *= light;
    }
}
