precision highp float;
precision highp int;

#include <logdepthbuf_pars_vertex>
#define EPSILON 1e-6

uniform float size;
uniform float scale;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
uniform vec2 resolution;
uniform bool pickingMode;
uniform sampler2D texture;
uniform vec4 offsetScale;
uniform vec2 extentTopLeft;
uniform vec2 extentSize;

attribute vec4 unique_id;
attribute vec3 color;
attribute vec3 position;

varying vec4 vColor;

void main() {
    if (pickingMode) {
        vColor = unique_id;
    } else {
        vColor = vec4(color, 1.0);
    }

    vec2 pp = (modelMatrix * vec4(position, 1.0)).xy;
    // offsetScale is from topleft
    pp.x -= extentTopLeft.x;
    pp.y = extentTopLeft.y - pp.y;
    pp *= offsetScale.zw / extentSize;
    pp += offsetScale.xy;
    pp.y = 1.0 - pp.y;
    vColor = texture2D(texture, pp);
    // vColor.a = 1.0;

    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    mat4 projModelViewMatrix = projectionMatrix * modelViewMatrix;
    gl_Position = projModelViewMatrix* vec4( position, 1.0);

    if (size > 0.01) {
        gl_PointSize = size;
    } else {
        float pointSize = 1.0;
        float slope = tan(1.0 / 2.0);
        float projFactor =  -0.5 * resolution.y / (slope * mvPosition.z);

        float z = min(0.5 * -gl_Position.z / gl_Position.w, 1.0);
        gl_PointSize = max(3.0, min(10.0, 0.05 * projFactor));
    }

    #include <logdepthbuf_vertex>
}
