//#extension GL_OES_standard_derivatives : enable

precision highp float;
precision highp int;


#define USE_LOGDEPTHBUF
#define USE_LOGDEPTHBUF_EXT

#ifdef USE_LOGDEPTHBUF

    uniform float logDepthBufFC;

    #ifdef USE_LOGDEPTHBUF_EXT

        //#extension GL_EXT_frag_depth : enable
        varying float vFragDepth;

    #endif

#endif

varying vec4 vColor;

void main() {
    gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); //vColor;

#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)
    gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;
#endif
}
