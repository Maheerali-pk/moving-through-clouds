// App.tsx
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Cloud, Clouds, useTexture } from "@react-three/drei";
import backgroundImage from "./assets/background.png";
import manImage from "./assets/man.png";
import cloudTexture from "./assets/cloud.png";
import { useMemo, useRef, useEffect, useState } from "react";

type CloudData = {
   id: number;
   seed: number;
   x: number;
   y: number;
   z: number;
   width: number;
   depth: number;
   opacity: number;
   speed: number;
   slotId: number;
};
interface CloudSlot {
   id: number;
   zRange: [number, number];
   xRange: [number, number];
   yRange: [number, number];
   countRange: [number, number];
}
const zRange: [number, number] = [-30, -50];
const cloudSlots: CloudSlot[] = [
   {
      id: 0,
      zRange: zRange,
      xRange: [8, 12],
      yRange: [0, 0],
      countRange: [1, 3],
   },
   {
      id: 1,
      zRange: zRange,
      xRange: [-9, -12],
      yRange: [0, 0],
      countRange: [1, 3],
   },
];
const levelsOfCloud = 3;
const zDiffBetweenLevels = 20;

function useScrollAccumulator() {
   const [targetDistance, setTargetDistance] = useState(0);
   const distanceRef = useRef(0);

   useEffect(() => {
      let touchStartY = 0;
      const onWheel = (e: WheelEvent) =>
         setTargetDistance((t) => t - e.deltaY * 0.6);
      const onTouchStart = (e: TouchEvent) => {
         touchStartY = e.touches[0].clientY;
      };
      const onTouchMove = (e: TouchEvent) => {
         const dy = touchStartY - e.touches[0].clientY;
         touchStartY = e.touches[0].clientY;
         setTargetDistance((t) => t + dy * 1.2);
      };
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      return () => {
         window.removeEventListener("wheel", onWheel);
         window.removeEventListener("touchstart", onTouchStart);
         window.removeEventListener("touchmove", onTouchMove);
      };
   }, []);

   return {
      get target() {
         return targetDistance;
      },
      get current() {
         return distanceRef.current;
      },
      set current(v: number) {
         distanceRef.current = v;
      },
   };
}
const createBackupSlot = (slot: CloudSlot): CloudSlot => {
   return {
      id: slot.id + 100,
      zRange: [slot.zRange[0], slot.zRange[1]],
      xRange: [slot.xRange[0], slot.xRange[1]],
      yRange: [slot.yRange[0], slot.yRange[1]],
      countRange: [slot.countRange[1], slot.countRange[0]],
   };
};

function BackgroundImage() {
   const texture = useTexture(manImage);
   const { viewport } = useThree();

   // Use a large plane positioned far back to serve as background
   // Scale it large enough to cover the entire view
   const size = Math.max(viewport.width, viewport.height) * 3;

   return (
      <mesh position={[0, 0, -250]} scale={8} renderOrder={0}>
         <planeGeometry args={[size, size]} />
         <meshBasicMaterial map={texture} depthWrite={false} />
      </mesh>
   );
}

function CloudTunnel({
   count = 28,
   spreadX = 10, // tunnel half-width in X
   spreadY = 5, // tunnel half-height in Y
   nearZ = -180, // bring closest clouds much nearer
   farZ = -200, // long tunnel
   sensitivity = 0.06, // scroll sensitivity
   recycleMargin = 0, // how far past camera before recycling
   sizeScale = 1.0, // global scale multiplier for "make everything bigger"
}: {
   count?: number;
   spreadX?: number;
   spreadY?: number;
   nearZ?: number;
   farZ?: number;
   sensitivity?: number;
   recycleMargin?: number;
   sizeScale?: number;
}) {
   const group = useRef<THREE.Group>(null);
   const scroll = useScrollAccumulator();
   const prev = useRef(0);

   const clouds = useMemo<CloudData[]>(() => {
      const rnd = (a: number, b: number) => Math.random() * (b - a) + a;
      const res: CloudData[] = [];
      for (let i = 0; i < cloudSlots.length; i++) {
         res.push({
            id: res.length,
            seed: (Math.random() * 1e5) | 0,
            x: rnd(cloudSlots[i].xRange[0], cloudSlots[i].xRange[1]),
            y: rnd(cloudSlots[i].yRange[0], cloudSlots[i].yRange[1]),
            z: rnd(cloudSlots[i].zRange[0], cloudSlots[i].zRange[1]),
            width: rnd(28, 52) * sizeScale, // BIGGER clouds
            depth: rnd(2.4, 4.0) * sizeScale, // THICKER
            opacity: rnd(0.42, 0.58),
            speed: rnd(0.1, 0.24),
            slotId: i,
         });
         for (let j = 0; j < levelsOfCloud; j++) {
            res.push({
               id: res.length,
               seed: (Math.random() * 1e5) | 0,
               x: rnd(cloudSlots[i].xRange[0], cloudSlots[i].xRange[1]),
               y: rnd(cloudSlots[i].yRange[0], cloudSlots[i].yRange[1]),
               z: -80 - j * zDiffBetweenLevels,
               width: rnd(28, 52) * sizeScale, // BIGGER clouds
               depth: rnd(2.4, 4.0) * sizeScale, // THICKER
               opacity: rnd(0.42, 0.58),
               speed: rnd(0.1, 0.24),
               slotId: i,
            });
         }
      }

      console.log(res, "res");
      return res;
      // return new Array(cloudSlots).fill(0).map((_, i) => ({
      //    id: i,
      //    seed: (Math.random() * 1e5) | 0,
      //    x: rnd(-spreadX, spreadX),
      //    y: rnd(-spreadY, spreadY),
      //    z: THREE.MathUtils.lerp(nearZ, farZ, i / count),
      //    width: rnd(28, 52) * sizeScale, // BIGGER clouds
      //    depth: rnd(2.4, 4.0) * sizeScale, // THICKER
      //    opacity: rnd(0.42, 0.58),
      //    speed: rnd(0.1, 0.24),
      // }));
   }, [count, spreadX, spreadY, nearZ, farZ, sizeScale]);

   const span = Math.abs(farZ - nearZ);

   const refs = useRef<Record<number, THREE.Object3D>>({});
   const setRef = (id: number) => (el: any) => {
      if (el) refs.current[id] = el;
   };

   const reRollAhead = (c: CloudData) => {
      console.log(c.id, c.slotId, " rolling ahead");
      const rnd = (a: number, b: number) => Math.random() * (b - a) + a;
      c.z = -60 - levelsOfCloud * zDiffBetweenLevels; // push far forward along -Z
      c.x = c.x;
      c.y = c.y;
      c.width = rnd(28, 52) * sizeScale;
      c.depth = rnd(2.4, 4.0) * sizeScale;
      c.opacity = rnd(0.42, 0.58);
      c.speed = rnd(0.1, 0.24);
      c.seed = (Math.random() * 1e5) | 0;
   };

   useFrame((state, delta) => {
      const eased = THREE.MathUtils.damp(
         scroll.current,
         scroll.target,
         5,
         delta
      );
      const deltaDist = eased - prev.current;
      prev.current = eased;
      scroll.current = eased;

      const forward = -deltaDist * sensitivity;

      if (group.current) {
         group.current.rotation.z = THREE.MathUtils.damp(
            group.current.rotation.z,
            Math.sin(state.clock.elapsedTime * 0.12) * 0.06,

            2,
            delta
         );
         // optional global scale if you want to upsize EVERYTHING more
         group.current.scale.setScalar(sizeScale);
      }

      for (const c of clouds) {
         const ref = refs.current[c.id];
         if (!ref) continue;

         // nearer z (closer to 0) → a bit faster
         const parallax = THREE.MathUtils.mapLinear(
            c.z,
            farZ,
            nearZ,
            0.7,
            1.25
         );

         c.z += forward * parallax;

         // console.log(c.z, recycleMargin);
         if (c.z > recycleMargin) reRollAhead(c);

         ref.position.set(c.x, c.y, c.z);
      }
   });

   console.log("all clouds", clouds);
   return (
      <group ref={group} renderOrder={2}>
         <ambientLight intensity={0.3} />
         <directionalLight position={[6, 10, 4]} intensity={0.0} />
         <Clouds material={THREE.MeshLambertMaterial} texture={cloudTexture}>
            {clouds.map((c) => (
               <group key={c.id} ref={setRef(c.id)} position={[c.x, c.y, c.z]}>
                  <Cloud
                     seed={c.seed}
                     opacity={c.opacity}
                     speed={c.speed}
                     volume={20}
                     concentrate="inside"
                     width={c.width}
                     depth={c.depth}
                     segments={20}
                  />
               </group>
            ))}

            {/* <group position={[0, 0, -50]}>
               <Cloud
                  seed={75320}
                  opacity={0.5}
                  speed={0.1}
                  width={34}
                  depth={0.0005}
                  segments={20}
               ></Cloud>
            </group> */}
         </Clouds>
      </group>
   );
}

export default function App() {
   return (
      <div style={{ height: "100vh", width: "100%", background: "#0a0a0a" }}>
         <Canvas camera={{ position: [0, 0, 6], fov: 15 }}>
            <BackgroundImage />

            {/* <color attach="background" args={["#0a0a0a"]} /> */}
            {/* <fog attach="fog" args={["#0a0a0a", 8, 260]} /> */}
            <CloudTunnel
               count={2}
               spreadX={10}
               spreadY={10}
               nearZ={-6}
               farZ={-220}
               sensitivity={0.03}
               recycleMargin={10}
               sizeScale={1.5} // bump if you want even larger: 1.3, 1.5, etc.
            />

            {/* <Image
               url={manImage}
               transparent
               opacity={1}
               scale={1.75}
               position={[0, 0, 0]}
               renderOrder={1}
            /> */}
         </Canvas>
      </div>
   );
}
