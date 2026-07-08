import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// ----------------------------------------------------------------------
// BvhSetup — installs three-mesh-bvh's accelerated raycast globally, once.
//
// Resource-mode picking raycasts the whole near hemisphere of cliff cells
// (plus the atmosphere pick shell) every frame the pointer moves. Without a
// BVH that is a brute-force scan over ~hundreds of thousands of triangles,
// which tanks FPS the moment the cursor moves. Patching Mesh.raycast to the
// accelerated version turns any mesh that has a `geometry.boundsTree` into an
// O(log n) traversal; meshes without a boundsTree fall back to the stock path,
// so this is safe for every other mesh in the scene.
// ----------------------------------------------------------------------
let installed = false;

export function installBvh()
{
    if (installed) return;

    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;

    installed = true;
}
