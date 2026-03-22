// Shape Keyを更新する処理
export const shapeKeyEvent = "shape-key";
export const shapeKeyNames = [
  "vrc.v_sil",
  "vrc.v_aa",
  "vrc.v_oh",
  "vrc.v_e",
] as const;
export type ShapeKeyName = (typeof shapeKeyNames)[number];
export type ShapeKeyEventDetail = {
  shapeKeyName: ShapeKeyName;
};
export type ShapeKeyEvent = CustomEvent<ShapeKeyEventDetail>;
// 指定したShapeKey名へ更新するためのEventを発火する関数
export function dispatchShapeKey(shapeKeyName: ShapeKeyName): void {
  window.dispatchEvent(
    new CustomEvent<ShapeKeyEventDetail>(shapeKeyEvent, {
      detail: { shapeKeyName },
    }),
  );
}
