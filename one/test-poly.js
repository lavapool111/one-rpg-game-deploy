const N = 8;
const R = 13;
const A = R * Math.cos(Math.PI / N);

console.log("Radius (R):", R);
console.log("Apothem (A):", A);

const points = [
    { x: 0, z: 0 },     // Center (should be inside)
    { x: 10, z: 0 },    // Inside edge
    { x: 14, z: 0 },    // Outside edge
    { x: 8.5, z: 8.5 }, // Inside corner (distance ~ 12.02)
    { x: 10, z: 10 },   // Outside corner (distance ~ 14.14)
];

for (const p of points) {
    let inside = true;
    let failJ = -1;
    let failVal = 0;

    for (let j = 0; j < N; j++) {
        const theta_n = (j + 0.5) * (2 * Math.PI / N);
        const nx = Math.sin(theta_n);
        const nz = Math.cos(theta_n);

        const dot = p.x * nx + p.z * nz;

        if (dot > A) {
            inside = false;
            failJ = j;
            failVal = dot;
            break;
        }
    }

    console.log(`Point (${p.x}, ${p.z}) -> inside: ${inside}`);
    if (!inside) {
        console.log(`  Failed at face ${failJ} with dot product ${failVal} > ${A}`);
    }
}
