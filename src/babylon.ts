/**
 * The only place the game imports Babylon.js from. Deep imports keep the bundle
 * to the parts the game uses; the "@babylonjs/core" barrel pulls in everything.
 */
export { Engine } from "@babylonjs/core/Engines/engine";
export { Scene } from "@babylonjs/core/scene";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
export { Vector3 } from "@babylonjs/core/Maths/math.vector";
export { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
export { Mesh } from "@babylonjs/core/Meshes/mesh";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode";
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
export { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
export { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
export { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
export { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
export { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
export type { Camera } from "@babylonjs/core/Cameras/camera";
export { Ray } from "@babylonjs/core/Culling/ray";
export { CreateScreenshotUsingRenderTargetAsync } from "@babylonjs/core/Misc/screenshotTools";

import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";

/** The mesh builders the game uses, under the same names as Babylon's MeshBuilder. */
export const MeshBuilder = {
  CreateBox,
  CreateCapsule,
  CreateCylinder,
  CreateDisc,
  CreateGround,
  CreatePlane,
  CreateSphere,
  CreateTorus,
};

// Scene components that register themselves on import.
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/default.vertex";
