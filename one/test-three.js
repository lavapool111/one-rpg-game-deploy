import * as THREE from 'three';

const N = 8;
const R = 13;
const H = 1;

// Create the geometry the exact same way as in AltarRoom
const geom = new THREE.CylinderGeometry(R, R, H, N);
geom.computeBoundingBox();

// Let's get the vertices of the top face (y > 0)
const pos = geom.attributes.position;
const topVertices = [];
for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
        // Round to 3 decimal places for readability
        const x = Math.round(pos.getX(i) * 1000) / 1000;
        const z = Math.round(pos.getZ(i) * 1000) / 1000;

        // Ensure no duplicates
        if (!topVertices.find(v => v.x === x && v.z === z)) {
            topVertices.push({ x, z });
        }
    }
}

console.log("Three.js Cylinder (8 sided, R=13) top vertices (ignoring Y):");
topVertices.forEach((v, i) => console.log(`  v${i}: x=${v.x}, z=${v.z}`));

// Calculate distance to vertices from origin
topVertices.forEach((v, i) => {
    const dist = Math.sqrt(v.x * v.x + v.z * v.z);
    console.log(`  Distance to v${i}: ${dist}`);
});
