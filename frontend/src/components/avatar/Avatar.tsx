import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useAnimations, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCallback, useEffect, useRef, useState } from "react";
import { shapeKeyNames, type ShapeKeyName } from "./shapeKey.js";
import { useShapeKeyEffect, type FaceMesh } from "./useShapeKeyEffect.js";
import { hideLoadingOverlay } from "../../layouts/loading/loadingOverlay";

const SHADOW_CAMERA_BOUNDS = 2.5;

function Model() {
  const { scene, animations, nodes } = useGLTF("/gltf.glb");
  const { actions } = useAnimations(animations, scene);
  const { camera, controls, scene: rootScene } = useThree();
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

    // アバターの中心を回転軸に設定
    rootScene.updateMatrixWorld(true);
    const center = new THREE.Box3()
      .setFromObject(scene)
      .getCenter(new THREE.Vector3());
    const cameraOffset = new THREE.Vector3().setFromSphericalCoords(
      2.5,
      Math.PI / 2 + Math.PI / 18,
      -Math.PI / 12,
    );
    camera.position.copy(center).add(cameraOffset);
    camera.lookAt(center);
    const orbitControls = controls as OrbitControlsImpl | null;
    if (orbitControls) {
      orbitControls.target.copy(center);
      orbitControls.update();
    }

    // shape keyの初期化
    const index = mesh.morphTargetDictionary[shapeKeyRef.current!];
    if (index === undefined)
      throw new Error(`Shape key not found: ${shapeKeyRef.current!}`);
    mesh.morphTargetInfluences[index] = 1;

    // デフォルトのアニメーションを再生
    const idleActionName = "idle";
    actions[idleActionName]?.play();
  }, [actions, camera, controls, mesh, rootScene, scene]);

  useShapeKeyEffect({ mesh, shapeKeyRef });

  useEffect(() => {
    // scene が存在する > モデルロード完了 > ローディングオーバーレイを非表示
    if (!scene) return;
    hideLoadingOverlay();
  }, [scene]);

  return (
    // アバター位置
    <group position={[1, -0.55, 1]} scale={1.2}>
      <primitive object={scene} />
    </group>
  );
}

export default function App() {
  const [dragTarget, setDragTarget] = useState<HTMLDivElement | undefined>(
    undefined,
  );
  // ref付与とアンマウントで毎回関数を再生成しないようメモ化
  const dragTargetRef = useCallback((el: HTMLDivElement | null) => {
    setDragTarget(el ?? undefined);
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* アバター周辺のみドラッグ回転を受け付ける当たり判定 */}
      <div
        ref={dragTargetRef}
        className="pointer-events-auto absolute top-0 left-1/2 h-full w-[var(--stage-column)] -translate-x-1/2"
      />
      <Canvas
        // 視野角
        camera={{ fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        // 影
        shadows
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
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

        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          domElement={dragTarget}
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
    </div>
  );
}
