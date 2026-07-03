import * as THREE from 'three';

// ----------------------------------------------------------------------
// SkyAnchor — a group that follows the camera's POSITION every frame.
// Anything parented to it (sun discs, the background stars) effectively
// sits at infinity: there is no parallax between the sky and the body as
// the camera orbits. Lights stay in world space (only their direction
// matters), so they are NOT parented here.
// ----------------------------------------------------------------------
export class SkyAnchor
{
    group;

    constructor(scene)
    {
        this.group = new THREE.Group();
        scene.add(this.group);
    }

    add(object)
    {
        this.group.add(object);
    }

    // Sync to the camera so the sky reads as fixed at infinity.
    follow(camera)
    {
        this.group.position.copy(camera.position);
    }
}

