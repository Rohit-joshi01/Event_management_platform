import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneMode } from '@/lib/webgl';
import { ArmillaryFallback } from './ArmillaryFallback';

/**
 * "The Armillary" — three interlocking chrome rings orbiting a single chartreuse core, a
 * sculptural echo of the AFTR mark (a doorway, and the person stepping through it).
 * Lighting is fully procedural (Lightformers), so the scene needs no network assets.
 */

interface SceneProps {
  pointer: MutableRefObject<{ x: number; y: number }>;
  scroll: MutableRefObject<number>;
  compact: boolean;
  animate: boolean;
}

const chrome = new THREE.MeshStandardMaterial({ color: '#e8e6e1', metalness: 1, roughness: 0.16, envMapIntensity: 1.25 });
const darkChrome = new THREE.MeshStandardMaterial({ color: '#8a8984', metalness: 1, roughness: 0.28, envMapIntensity: 1 });
const core = new THREE.MeshStandardMaterial({
  color: '#C7F36B',
  emissive: '#9fd13f',
  emissiveIntensity: 0.55,
  metalness: 0.1,
  roughness: 0.32,
});

function Ring({ radius, tube, material, axis, speed, tilt, animate }: {
  radius: number;
  tube: number;
  material: THREE.Material;
  axis: 'x' | 'y' | 'z';
  speed: number;
  tilt: [number, number, number];
  animate: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!animate || !ref.current) return;
    ref.current.rotation[axis] += delta * speed;
  });
  return (
    <group rotation={tilt}>
      <mesh ref={ref} material={material} castShadow={false}>
        <torusGeometry args={[radius, tube, 48, 220]} />
      </mesh>
    </group>
  );
}

function Dust({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const count = 420;
    const positions = new Float32Array(count * 3);
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const r = 4.2 + rand() * 4.5;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi) - 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);
  useFrame((_, delta) => {
    if (animate && ref.current) ref.current.rotation.y += delta * 0.012;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.018} color="#F5F3EE" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Armillary({ pointer, scroll, compact, animate }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const base = compact ? { x: 0.4, y: 0.05, s: 0.6 } : { x: 2.55, y: 0.45, s: 0.9 };

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const p = scroll.current;
    const k = animate ? 1 - Math.pow(0.0025, delta) : 1;
    const targetX = base.x + pointer.current.x * 0.18 - p * (compact ? 0 : 1.2);
    const targetY = base.y + pointer.current.y * 0.12 - p * 1.5;
    g.position.x += (targetX - g.position.x) * k;
    g.position.y += (targetY - g.position.y) * k;
    const rx = pointer.current.y * 0.22 + p * 0.9;
    const ry = pointer.current.x * 0.35 + p * 1.4 + (animate ? state.clock.elapsedTime * 0.06 : 0.6);
    g.rotation.x += (rx - g.rotation.x) * k;
    g.rotation.y += (ry - g.rotation.y) * k;
    const s = base.s * (1 - p * 0.18);
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k);
    camera.position.z = 9 + p * 1.5;
    if (coreRef.current && animate) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.035;
      coreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={group} position={[base.x, base.y, 0]} scale={base.s}>
      <Ring radius={2.45} tube={0.055} material={chrome} axis="z" speed={0.12} tilt={[Math.PI / 2.3, 0.2, 0]} animate={animate} />
      <Ring radius={1.95} tube={0.09} material={chrome} axis="z" speed={-0.18} tilt={[0.35, Math.PI / 2.6, 0.4]} animate={animate} />
      <Ring radius={1.42} tube={0.045} material={darkChrome} axis="z" speed={0.27} tilt={[-0.6, -0.3, Math.PI / 3]} animate={animate} />
      <Ring radius={0.92} tube={0.022} material={chrome} axis="z" speed={-0.4} tilt={[1.2, 0.9, 0]} animate={animate} />
      <mesh ref={coreRef} material={core}>
        <sphereGeometry args={[0.3, 64, 64]} />
      </mesh>
    </group>
  );
}

function StudioLighting() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#050505']} />
      <group rotation={[-Math.PI / 4, -0.3, 0]}>
        <Lightformer form="rect" intensity={4} position={[0, 5, -6]} scale={[12, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={2.2} position={[-6, 1, -1]} scale={[3, 8, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.6} position={[6, -1, 0]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color="#C7F36B" intensity={2.4} position={[2, 2, 6]} scale={2.5} />
        <Lightformer form="circle" intensity={1.2} position={[0, -6, 2]} scale={4} rotation-x={-Math.PI / 2} />
      </group>
    </Environment>
  );
}

export function HeroScene({ mode, scroll, compact, active }: { mode: SceneMode; scroll: MutableRefObject<number>; compact: boolean; active: boolean }) {
  const pointer = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const animate = mode === 'animated';

  useEffect(() => {
    if (!animate) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [animate]);

  if (mode === 'fallback') return <ArmillaryFallback compact={compact} />;

  return (
    <div className="absolute inset-0 transition-opacity duration-[1600ms] ease-out max-lg:bottom-auto max-lg:h-[46svh]" style={{ opacity: ready ? 1 : 0 }} aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 9], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={animate ? (active ? 'always' : 'never') : 'demand'}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          setReady(true);
        }}
      >
        <StudioLighting />
        <ambientLight intensity={0.15} />
        <Armillary pointer={pointer} scroll={scroll} compact={compact} animate={animate} />
        <Dust animate={animate} />
      </Canvas>
    </div>
  );
}
