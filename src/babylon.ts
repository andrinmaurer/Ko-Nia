/**
 * The only place the game imports Babylon.js from. Deep imports keep the bundle
 * to the parts the game uses; the "@babylonjs/core" barrel pulls in everything.
 */
export { Engine } from "@babylonjs/core/Engines/engine";
export { Scene } from "@babylonjs/core/scene";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
export { Matrix, Quaternion, Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
export { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
export { Mesh } from "@babylonjs/core/Meshes/mesh";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode";
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
export { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
export { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
export { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
export { ColorCurves } from "@babylonjs/core/Materials/colorCurves";
export { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
export { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
export { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
export { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
export { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
export type { Camera } from "@babylonjs/core/Cameras/camera";
export { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
export { Texture } from "@babylonjs/core/Materials/Textures/texture";
export { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
export { Ray } from "@babylonjs/core/Culling/ray";

import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";

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
  CreateTube,
};

// Scene components that register themselves on import.
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/default.vertex";
// Logbook photos: the screenshot helper flips the image through a pass post-process.
import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/pass.fragment";
