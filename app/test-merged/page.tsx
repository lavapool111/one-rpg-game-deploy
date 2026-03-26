'use client';
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Merged, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function InstancesTest({ children }: { children: (instances: any) => React.ReactNode }) {
    const meshes = useMemo(() => ({
        box: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 'hotpink' })),
        sphere: new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 'blue' })),
    }), []);

    return <Merged meshes={meshes}>{children}</Merged>;
}

export default function TestPage() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
            <Canvas camera={{ position: [0, 0, 10] }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <InstancesTest>
                    {(models) => (
                        <>
                            <models.box position={[-2, 0, 0]} />
                            <models.sphere position={[2, 0, 0]} />
                        </>
                    )}
                </InstancesTest>
                <OrbitControls />
            </Canvas>
        </div>
    );
}
