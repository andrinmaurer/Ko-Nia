import { type Mesh, VertexBuffer } from "../babylon";

/**
 * Replaces a mesh's UVs with a box projection in metres, so a tiling texture keeps
 * the same scale on every wall no matter how big the box is.
 * Call it after the mesh is positioned and scaled.
 *
 * @param tileU metres covered by one texture repeat horizontally
 * @param tileV metres covered by one texture repeat vertically (defaults to tileU)
 */
export function worldUV(mesh: Mesh, tileU: number, tileV = tileU): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const nrm = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!pos || !nrm) return;
  const s = mesh.scaling;
  const o = mesh.position;
  const uvs = new Float32Array((pos.length / 3) * 2);
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const x = pos[i] * s.x + o.x;
    const y = pos[i + 1] * s.y + o.y;
    const z = pos[i + 2] * s.z + o.z;
    const ax = Math.abs(nrm[i]);
    const ay = Math.abs(nrm[i + 1]);
    const az = Math.abs(nrm[i + 2]);
    if (ay >= ax && ay >= az) {
      uvs[j] = x / tileU;
      uvs[j + 1] = z / tileU;
    } else if (ax >= az) {
      uvs[j] = (nrm[i] > 0 ? -z : z) / tileU;
      uvs[j + 1] = y / tileV;
    } else {
      uvs[j] = (nrm[i + 2] > 0 ? x : -x) / tileU;
      uvs[j + 1] = y / tileV;
    }
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}
