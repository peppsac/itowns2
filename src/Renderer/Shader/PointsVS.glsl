//#version 100

precision highp float;
precision highp int;

#define EPSILON 1e-6
#define USE_LOGDEPTHBUF
#define USE_LOGDEPTHBUF_EXT

#ifdef USE_LOGDEPTHBUF

    #define EPSILON 1e-6
    #ifdef USE_LOGDEPTHBUF_EXT

        varying float vFragDepth;

    #endif

    uniform float logDepthBufFC;

#endif

uniform float size;
uniform float scale;
attribute vec4 unique_id;
varying vec4 vColor;

void main() {
    vColor = unique_id;
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    gl_PointSize = size; // * (scale / - mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

#ifdef USE_LOGDEPTHBUF
    gl_Position.z = log2(max( EPSILON, gl_Position.w + 1.0 )) * logDepthBufFC;
    #ifdef USE_LOGDEPTHBUF_EXT
        vFragDepth = 1.0 + gl_Position.w;
    #else
        gl_Position.z = (gl_Position.z - 1.0) * gl_Position.w;
    #endif
#endif

}
