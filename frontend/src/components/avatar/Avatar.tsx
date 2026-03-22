import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { shapeKeyNames, type ShapeKeyName } from "./shapeKey.js";
import { useShapeKeyEffect, type FaceMesh } from "./useShapeKeyEffect.js";

const SHADOW_CAMERA_BOUNDS = 2.5;

function Model() {
  const { scene, animations, nodes } = useGLTF("/gltf.glb");
  const { actions } = useAnimations(animations, scene);
  const { camera } = useThree();
  const shapeKeyRef = useRef<ShapeKeyName>(shapeKeyNames[0]);
  // 顔のメッシュを取得
  const mesh = nodes.head as unknown as FaceMesh;

  useEffect(() => {
    // 影を有効化
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // カメラ初期化
    camera.position.set(1, 0, 2.5); // x, y, z
    camera.lookAt(1, 0, 0);

    // shape keyの初期化
    const index = mesh.morphTargetDictionary[shapeKeyRef.current!];
    mesh.morphTargetInfluences[index] = 1;

    // デフォルトのアニメーションを再生
    const idleActionName = "idle";
    actions[idleActionName]?.play();
  }, [actions, camera, mesh]);

  useShapeKeyEffect({ mesh, shapeKeyRef });

  return (
    // アバター位置
    <group position={[1, -0.7, 1]}>
      <primitive object={scene} />
    </group>
  );
}

export default function App() {
  return (
    <Canvas
      // 視野角
      camera={{ fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      // 影
      shadows
      style={{ width: "100%", height: "100%" }}
      onCreated={(state) => {
        // 影の種類
        state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
    >
      {/* ライト */}
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[0, 5, 5]}
        intensity={2.5}
        castShadow
        // アバターの影
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-camera-left={-SHADOW_CAMERA_BOUNDS}
        shadow-camera-right={SHADOW_CAMERA_BOUNDS}
        shadow-camera-top={SHADOW_CAMERA_BOUNDS}
        shadow-camera-bottom={-SHADOW_CAMERA_BOUNDS}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      <Model />

      {/* 地面の影 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[1, -0.7, 1]}
        receiveShadow
      >
        <planeGeometry args={[11, 10]} />
        <shadowMaterial opacity={0.3} transparent />
      </mesh>
    </Canvas>
  );
}
