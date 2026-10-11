import { Color3, Mesh, MeshBuilder, Scene, ShaderMaterial, ShaderStore, Vector3 } from "../babylon";

ShaderStore.ShadersStore["koniaSkyVertexShader"] = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

ShaderStore.ShadersStore["koniaSkyFragmentShader"] = `
precision highp float;
varying vec3 vDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform vec3 sunDir;
uniform float stars;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // Pale band at the horizon, deepening overhead; below the horizon stays hazy.
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
  col = mix(col, horizon * 0.85, smoothstep(0.0, -0.25, h));
  // Sun: wide warm scatter, a tighter halo and the disc itself.
  float s = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.6 + smoothstep(0.9994, 0.9997, s) * 3.0);
  // Stars, fading towards the horizon.
  if (stars > 0.0) {
    vec3 cell = floor(d * 260.0);
    float star = step(0.9965, hash(cell)) * hash(cell + 1.7);
    col += vec3(star) * stars * smoothstep(0.05, 0.4, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Sky dome drawn by a small shader: a horizon-to-zenith gradient, a sun with a
 * warm halo, and stars at night. The atmosphere sets its colours every frame.
 */
export class Sky {
  private readonly material: ShaderMaterial;

  constructor(scene: Scene) {
    this.material = new ShaderMaterial("sky", scene, "koniaSky", {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "zenith", "horizon", "sunColor", "sunDir", "stars"],
    });
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;

    const dome: Mesh = MeshBuilder.CreateSphere("skyDome", { diameter: 900, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
    dome.material = this.material;
    dome.infiniteDistance = true;
    dome.isPickable = false;
    dome.applyFog = false;
    dome.renderingGroupId = 0;
    dome.freezeWorldMatrix();
  }

  /** `toSun` points from the viewer towards the sun (or moon). */
  set(zenith: Color3, horizon: Color3, sunColor: Color3, toSun: Vector3, stars: number): void {
    this.material.setColor3("zenith", zenith);
    this.material.setColor3("horizon", horizon);
    this.material.setColor3("sunColor", sunColor);
    this.material.setVector3("sunDir", toSun);
    this.material.setFloat("stars", stars);
  }
}
