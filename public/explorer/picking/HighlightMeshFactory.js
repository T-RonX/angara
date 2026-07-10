import * as THREE from 'three';

// Builds the six overlay meshes for HighlightManager.
// Pass an optional partial `style` object to override any colour/opacity
// defaults; unspecified keys fall back to the current visual values.
export class HighlightMeshFactory
{
    static #DEFAULTS = {
        hoverColor:                  0xfff2a0,
        hoverOpacity:                0.35,
        hoverEdgeColor:              0xffe66b,
        selectionColor:              0x6fb0ff,
        selectionOpacity:            0.42,
        selectionEdgeColor:          0x9fd0ff,
        resourceColor:               0x6fb0ff,
        resourceOpacity:             0.5,
        resourceEdgeColor:           0x9fd0ff,
        polygonOffsetFactor:        -2,
        polygonOffsetUnits:         -2,
        resourcePolygonOffsetFactor:-3,
        resourcePolygonOffsetUnits: -3,
    };

    #style;

    constructor(style = {})
    {
        this.#style = { ...HighlightMeshFactory.#DEFAULTS, ...style };
    }

    buildAll(bodyGroup)
    {
        const s = this.#style;

        const highlight = this.#overlayMesh(
            s.hoverColor, s.hoverOpacity, s.polygonOffsetFactor, s.polygonOffsetUnits,
        );
        const highlightEdges = this.#edgesMesh(s.hoverEdgeColor);

        const selection = this.#overlayMesh(
            s.selectionColor, s.selectionOpacity, s.polygonOffsetFactor, s.polygonOffsetUnits,
        );
        const selectionEdges = this.#edgesMesh(s.selectionEdgeColor);

        const resourceSelection = this.#overlayMesh(
            s.resourceColor, s.resourceOpacity, s.resourcePolygonOffsetFactor, s.resourcePolygonOffsetUnits,
        );
        const resourceSelectionEdges = this.#edgesMesh(s.resourceEdgeColor);

        const all = [
            highlight, highlightEdges,
            selection, selectionEdges,
            resourceSelection, resourceSelectionEdges,
        ];

        for (const m of all)
        {
            m.visible = false;
            bodyGroup.add(m);
        }

        return { highlight, highlightEdges, selection, selectionEdges, resourceSelection, resourceSelectionEdges };
    }

    #overlayMesh(color, opacity, offsetFactor, offsetUnits)
    {
        return new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color, transparent: true, opacity, side: THREE.DoubleSide,
                depthWrite: false, polygonOffset: true,
                polygonOffsetFactor: offsetFactor, polygonOffsetUnits: offsetUnits,
            }),
        );
    }

    #edgesMesh(color)
    {
        return new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color }),
        );
    }
}
