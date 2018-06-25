precision highp float;
precision highp int;

#include <logdepthbuf_pars_vertex>
#define EPSILON 1e-6

attribute vec3 position;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float size;

uniform bool pickingMode;
uniform bool textureMode;
uniform float opacity;
uniform vec4 overlayColor;
attribute vec3 color;
attribute vec4 unique_id;

uniform sampler2D texture;
uniform vec4 offsetScale;
uniform vec2 extentTopLeft;
uniform vec2 extentSize;

varying vec4 vColor;

void main() {
    if (pickingMode) {
        vColor = unique_id;
    } else if (textureMode) {
        vec2 pp = (modelMatrix * vec4(position, 1.0)).xy;
        // offsetScale is from topleft
        pp.x -= extentTopLeft.x;
        pp.y = extentTopLeft.y - pp.y;
        pp *= offsetScale.zw / extentSize;
        pp += offsetScale.xy;
        pp.y = 1.0 - pp.y;
        vec3 textureColor = texture2D(texture, pp).rgb;
        vColor = vec4(mix(textureColor, overlayColor.rgb, overlayColor.a), opacity);
    } else {
        vColor = vec4(mix(color, overlayColor.rgb, overlayColor.a), opacity);
    }

    gl_Position = projectionMatrix * (modelViewMatrix * vec4( position, 1.0 ));

    if (size > 0.) {
        gl_PointSize = size;
    } else {
        gl_PointSize = clamp(-size / gl_Position.w, 3.0, 10.0);
    }

    #include <logdepthbuf_vertex>
}
