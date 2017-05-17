import * as THREE from 'three';
import Capabilities from '../Core/System/Capabilities';

// let previousAtlasCanvas;

export default function pack(images, uvs) {
    let atlasCanvas = document.createElement('canvas');
    //  atlasCanvas.id = 'foobar';
    //  atlasCanvas.style = 'position: absolute; bottom: 0px; width: 40%; border: 3px solid black;';
    const sq = Math.ceil(Math.sqrt(images.length));
    const minSize = sq * 256;
    let size = Capabilities.getMaxTextureSize();
    while (size >= minSize) size /= 2;
    size *= 2;
    atlasCanvas.width = size;
    atlasCanvas.height = size;


    let xOffset = 0;
    let yOffset = 0;
    const uv = [];
    const ctx = atlasCanvas.getContext('2d');

    if (__DEBUG__) {
        ctx.fillStyle = 'pink';
        ctx.fillRect(0, 0, size, size);
    }
    for (let i=0; i<images.length; i++) {
        const img = images[i];

        const uvSource = {
            x: uvs[i].x * uvs[i].z,
            y: uvs[i].y * uvs[i].z,
            z: uvs[i].z
        };

        const sWidth = img ? img.width : 256;
        const sHeight = img ? img.height : 256;

        const uvScaleDest = new THREE.Vector4(
            xOffset / atlasCanvas.width, yOffset / atlasCanvas.height,
            uvSource.z * sWidth / atlasCanvas.width,
            uvSource.z * sHeight / atlasCanvas.height);

        if (img) {
            if (__DEBUG__) {
                ctx.clearRect(xOffset, yOffset,
                    uvSource.z * sWidth, uvSource.z * sHeight);
            }
            ctx.drawImage(img,
                img.width * uvSource.x, // sx
                img.height * uvSource.y, // sy
                uvSource.z * sWidth, // sWidth
                uvSource.z * sHeight, // sHeight
                xOffset, // dx
                yOffset, // dy
                uvSource.z * sWidth, // dWidth
                uvSource.z * sHeight // dHeight
            );
        } else {
            ctx.fillStyle = 'black';
            ctx.fillRect(
                xOffset, yOffset,
                uvSource.z * sWidth, uvSource.z * sHeight);

        }

        uv.push(uvScaleDest)
        yOffset += sHeight; // color bleeeeeeed
        if (yOffset + sHeight > atlasCanvas.height) {
            xOffset += sWidth; // max
            yOffset = 0;
        }
    }
    const atlas = new THREE.CanvasTexture(atlasCanvas);

    atlas.generateMipmaps = false;
    atlas.magFilter = THREE.LinearFilter;
    atlas.minFilter = THREE.LinearFilter;
    atlas.anisotropy = 16;

    return { atlas, uv };
}
