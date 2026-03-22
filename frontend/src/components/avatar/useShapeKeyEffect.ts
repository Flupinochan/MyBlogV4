import { useEffect, type RefObject } from "react";
import {
  shapeKeyEvent,
  type ShapeKeyEvent,
  type ShapeKeyName,
} from "./shapeKey";

export type FaceMesh = {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
};

type UseShapeKeyEffectProps = {
  mesh: FaceMesh;
  shapeKeyRef: RefObject<ShapeKeyName>;
};

// Shape Key EventをListenして、対応するShape Keyを更新するカスタムフック
export function useShapeKeyEffect({
  mesh,
  shapeKeyRef,
}: UseShapeKeyEffectProps) {
  useEffect(() => {
    const handleShapeKey = (event: Event) => {
      const { shapeKeyName } = (event as ShapeKeyEvent).detail;
      shapeKeyRef.current = shapeKeyName;
      // 全ShapeKeyを0にリセット
      mesh.morphTargetInfluences.fill(0);
      // 対象のShapeKeyを1に設定
      const index = mesh.morphTargetDictionary[shapeKeyRef.current];
      mesh.morphTargetInfluences[index] = 1;
    };

    window.addEventListener(shapeKeyEvent, handleShapeKey);
    return () => {
      window.removeEventListener(shapeKeyEvent, handleShapeKey);
    };
  }, [mesh, shapeKeyRef]);
}
