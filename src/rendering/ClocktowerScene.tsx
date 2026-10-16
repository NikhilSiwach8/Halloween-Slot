import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DebtState } from '../config/types';

export interface SceneProps {
  mode: 'BASE' | 'BONUS';
  debtState: DebtState;
  splitting: boolean;
  reducedMotion: boolean;
}

const C = { gold: '#C9A45E', brass: '#E8CB8C', emerald: '#36D9A0', violet: '#8C48E8', blue: '#5C9EFF', navy: '#151A2B', obsidian: '#0B0D14' };

function Gear({ radius, teeth, position, speed, color, still }: { radius: number; teeth: number; position: [number, number, number]; speed: number; color: string; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && !still) ref.current.rotation.z += speed * dt;
  });
  const teethPos = useMemo(() => Array.from({ length: teeth }, (_, i) => (i / teeth) * Math.PI * 2), [teeth]);
  return (
    <group ref={ref} position={position}>
      <mesh>
        <torusGeometry args={[radius, radius * 0.12, 8, 48]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.35} />
      </mesh>
      {teethPos.map((a) => (
        <mesh key={a} position={[Math.cos(a) * radius * 1.12, Math.sin(a) * radius * 1.12, 0]} rotation={[0, 0, a]}>
          <boxGeometry args={[radius * 0.22, radius * 0.16, radius * 0.16]} />
          <meshStandardMaterial color={color} metalness={0.85} roughness={0.4} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          <boxGeometry args={[radius * 2, radius * 0.08, radius * 0.06]} />
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function ClockFace({ frozen, still }: { frozen: boolean; still: boolean }) {
  const minute = useRef<THREE.Mesh>(null);
  const hour = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!minute.current || !hour.current) return;
    if (frozen) {
      // 11:59 — the Last Second
      minute.current.rotation.z = -(59 / 60) * Math.PI * 2;
      hour.current.rotation.z = -((11 + 59 / 60) / 12) * Math.PI * 2;
      return;
    }
    if (!still) t.current += dt;
    minute.current.rotation.z = -t.current * 0.35;
    hour.current.rotation.z = -t.current * 0.35 / 12 - 0.6;
  });
  return (
    <group position={[0, 1.2, -9]}>
      <mesh>
        <circleGeometry args={[5.2, 64]} />
        <meshStandardMaterial color="#10131f" metalness={0.3} roughness={0.8} />
      </mesh>
      <mesh>
        <torusGeometry args={[5.2, 0.18, 12, 96]} />
        <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh>
        <torusGeometry args={[4.5, 0.05, 8, 96]} />
        <meshStandardMaterial color={C.brass} metalness={0.9} roughness={0.3} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 4.85, Math.cos(a) * 4.85, 0.02]} rotation={[0, 0, -a]}>
            <boxGeometry args={[i % 3 === 0 ? 0.18 : 0.08, i % 3 === 0 ? 0.6 : 0.35, 0.05]} />
            <meshStandardMaterial color={C.brass} metalness={0.9} roughness={0.3} emissive={C.gold} emissiveIntensity={0.15} />
          </mesh>
        );
      })}
      {/* fracture across the face */}
      <mesh position={[1.4, -0.6, 0.03]} rotation={[0, 0, 0.9]}>
        <planeGeometry args={[0.04, 6]} />
        <meshBasicMaterial color={C.emerald} transparent opacity={0.6} />
      </mesh>
      <mesh ref={hour} position={[0, 0, 0.06]}>
        <boxGeometry args={[0.22, 2.6, 0.05]} />
        <meshStandardMaterial color={C.brass} metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh ref={minute} position={[0, 0, 0.08]}>
        <boxGeometry args={[0.12, 4, 0.05]} />
        <meshStandardMaterial color={C.gold} metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Debris({ still, count = 60 }: { still: boolean; count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      x: ((i * 7.31) % 22) - 11, y: ((i * 3.77) % 14) - 6, z: -2 - ((i * 1.9) % 10), s: 0.06 + ((i * 0.37) % 0.22), sp: 0.1 + ((i * 0.13) % 0.4),
    })),
    [count],
  );
  const m = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!still) t.current += dt;
    data.forEach((d, i) => {
      m.position.set(d.x + Math.sin(t.current * d.sp + i) * 0.3, d.y + Math.sin(t.current * d.sp * 0.7 + i * 2) * 0.5, d.z);
      m.rotation.set(t.current * d.sp, t.current * d.sp * 0.6, i);
      m.scale.setScalar(d.s);
      m.updateMatrix();
      ref.current!.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#2a2f45" metalness={0.4} roughness={0.7} />
    </instancedMesh>
  );
}

function Motes({ color, still }: { color: string; still: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 220;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = ((i * 9.17) % 24) - 12;
      p[i * 3 + 1] = ((i * 5.31) % 16) - 8;
      p[i * 3 + 2] = -1 - ((i * 2.71) % 9);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (!ref.current || still) return;
    const a = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + dt * (0.15 + (i % 5) * 0.05);
      if (y > 8) y = -8;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={color} size={0.06} transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function Architecture() {
  const pillars = [-9, -6.5, 6.5, 9];
  return (
    <group>
      {pillars.map((x, i) => (
        <group key={x} position={[x, 0, -6 - (i % 2) * 2]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.9, 16, 0.9]} />
            <meshStandardMaterial color="#141827" roughness={0.9} />
          </mesh>
          <mesh position={[x < 0 ? 1.2 : -1.2, 5.5, 0]} rotation={[0, 0, x < 0 ? -0.6 : 0.6]}>
            <boxGeometry args={[0.35, 4, 0.5]} />
            <meshStandardMaterial color="#171c2d" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* impossible staircase fragment */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-7 + i * 0.55, -4.5 + i * 0.42, -4 - i * 0.15]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.6, 0.18, 1.2]} />
          <meshStandardMaterial color="#1b2033" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ splitting, still }: { splitting: boolean; still: boolean }) {
  useFrame(({ camera, clock }) => {
    const target = splitting && !still ? 0.6 : 0;
    camera.position.x += (target + (still ? 0 : Math.sin(clock.elapsedTime * 0.1) * 0.3) - camera.position.x) * 0.04;
    camera.lookAt(0, 0.5, -6);
  });
  return null;
}

export default function ClocktowerScene({ mode, debtState, splitting, reducedMotion }: SceneProps) {
  const frozen = mode === 'BONUS';
  const rim = splitting ? C.violet : frozen ? '#A94458' : debtState === 'CRITICAL' || debtState === 'DISCHARGE' ? C.violet : debtState === 'UNSTABLE' ? C.blue : C.emerald;
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.5, 6], fov: 55 }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      aria-hidden="true"
    >
      <color attach="background" args={[C.obsidian]} />
      <fog attach="fog" args={[C.navy, 6, 20]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 2, -6]} intensity={30} color={C.gold} distance={18} />
      <pointLight position={[-6, -2, -2]} intensity={14} color={rim} distance={16} />
      <pointLight position={[6, 3, -3]} intensity={10} color={splitting ? C.blue : C.brass} distance={14} />
      <ClockFace frozen={frozen} still={reducedMotion} />
      <Gear radius={1.6} teeth={14} position={[-5.4, 3.2, -7]} speed={0.25} color={C.gold} still={reducedMotion || frozen} />
      <Gear radius={1.0} teeth={10} position={[-3.6, 4.6, -7.5]} speed={-0.4} color="#a8874a" still={reducedMotion || frozen} />
      <Gear radius={2.1} teeth={18} position={[5.6, -2.4, -8]} speed={-0.15} color={C.gold} still={reducedMotion || frozen} />
      <Gear radius={0.8} teeth={8} position={[4.2, 3.8, -6]} speed={0.6} color={C.brass} still={reducedMotion || frozen} />
      <Architecture />
      <Debris still={reducedMotion} />
      <Motes color={splitting ? C.violet : rim} still={reducedMotion} />
      <Rig splitting={splitting} still={reducedMotion} />
    </Canvas>
  );
}
