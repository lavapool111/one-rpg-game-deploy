const THREE = require('three');

const N = 8;
const R = 13;
const H = 1;
const margin = 0; // Test exact bounds

// 1. Generate Three.js Cylinder
const geom = new THREE.CylinderGeometry(R, R, H, N);
const pos = geom.attributes.position;
const vertices = [];
for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // Avoid duplicate vertices from UV seams
        if (!vertices.find(v => Math.abs(v.x - x) < 0.001 && Math.abs(v.z - z) < 0.001)) {
            vertices.push({ x, z });
        }
    }
}

console.log(`Cylinder Vertices (N=${N}, R=${R}):`);
vertices.forEach((v, i) => console.log(`  v${i}: x=${v.x.toFixed(3)}, z=${v.z.toFixed(3)}`));

// 2. The Collision Math from stairCollision.ts
function isInside(px, pz, radius, sides, m) {
    const A = radius * Math.cos(Math.PI / sides);
    for (let j = 0; j < sides; j++) {
        // Here we test THREE DIFFERENT phase hypotheses to see which one perfectly bounds the Three.js vertices

        // H1: The normal is at (j + 0.5) * 2PI/N
        const theta_normal = (j + 0.5) * (2 * Math.PI / sides);
        const nx = Math.sin(theta_normal);
        const nz = Math.cos(theta_normal);

        if (px * nx + pz * nz > A + m + 0.001) { // 0.001 float epsilon
            return false;
        }
    }
    return true;
}

// 3. Test vertices against math
console.log("\nTesting vertices against math (Phase H1):");
let allInside = true;
vertices.forEach((v, i) => {
    const inside = isInside(v.x, v.z, R, N, margin);
    console.log(`  v${i} inside: ${inside}`);
    if (!inside) allInside = false;
});

// 4. Test center of faces (should be exactly at distance A)
console.log("\nTesting face centers against math (Phase H1):");
const A = R * Math.cos(Math.PI / N);
for (let j = 0; j < N; j++) {
    const theta_normal = (j + 0.5) * (2 * Math.PI / N);
    const fx = Math.sin(theta_normal) * A;
    const fz = Math.cos(theta_normal) * A;
    const inside = isInside(fx, fz, R, N, margin);
    console.log(`  Face ${j} center (${fx.toFixed(3)}, ${fz.toFixed(3)}) inside: ${inside}`);
}

if (!allInside) {
    console.log("\n❌ Phase H1 math cuts off the cylinder's actual corners (vertices).");
} else {
    console.log("\n✅ Phase H1 perfectly bounds the cylinder.");
}
