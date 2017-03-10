export default function updateTreeLayer(context, layer, node) {
    if (!node) {
        if (layer.level0Nodes === undefined) {
            layer.initLevel0Nodes(context, layer);
        }
        return layer.level0Nodes;
    }

    return layer.processNode(context, layer, node);
}


export default function updateTreeLayer2(initLevel0Nodes, processNode) {
    return function (context, layer, node) {
        if (!node) {
            if (layer.level0Nodes === undefined) {
                initLevel0Nodes(context, layer);
            }
            return layer.level0Nodes;
        }

        return processNode(context, layer, node);
    }
}
