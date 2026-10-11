import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial } from "../babylon";

/**
 * Gradient sky dome: deep blue overhead fading to a pale, misty horizon.
 * The day/night cycle tints it through `setTint`.
 */
export class Sky {
  private readonly material: StandardMaterial;

  constructor(scene: Scene) {
    const tex = new DynamicTexture("skyGradient", { width: 4, height: 256 }, scene, false);
    const c = tex.getContext();
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#4d78a0");
    g.addColorStop(0.36, "#93b2c6");
    g.addColorStop(0.47, "#d3d8d2");
    g.addColorStop(0.5, "#e2ddcf");
    g.addColorStop(1, "#c9cdc9");
    c.fillStyle = g;
    c.fillRect(0, 0, 4, 256);
    tex.update(false);

    this.material = new StandardMaterial("sky", scene);
    this.material.emissiveTexture = tex;
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.material.fogEnabled = false;

    const dome: Mesh = MeshBuilder.CreateSphere("skyDome", { diameter: 900, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
    dome.material = this.material;
    dome.infiniteDistance = true;
    dome.isPickable = false;
    dome.applyFog = false;
    dome.renderingGroupId = 0;
    dome.freezeWorldMatrix();
  }

  /** Multiplies the gradient (white = full daylight colours). */
  setTint(color: Color3): void {
    this.material.emissiveColor = color;
  }
}
