import * as THREE from 'three';

export async function loadTerrain(baseUrl) {
  const response = await fetch(baseUrl + 'data/terrain.json');
  if (!response.ok) throw Error('No se ha podido cargar el terreno.');
  const terrain = await response.json();
  const texture = await new THREE.TextureLoader().loadAsync(baseUrl + 'data/' + terrain.image);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { ...terrain, texture };
}

export function createTerrain(parent, renderer, { polygons, extent, texture }, project) {
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: '#cdd6cf',
    roughness: 1,
    metalness: 0,
  });
  const group = new THREE.Group();
  group.name = 'Terreno PNOA recortado a la costa OSM';
  for (const polygon of polygons) {
    const shape = new THREE.Shape(
      polygon.map(([lon, lat]) => {
        const p = project(lon, lat);
        return new THREE.Vector2(p.x, -p.z);
      })
    );
    const geometry = new THREE.ShapeGeometry(shape);
    const positions = geometry.attributes.position,
      uv = geometry.attributes.uv;
    const southwest = project(extent.xmin, extent.ymin),
      northeast = project(extent.xmax, extent.ymax);
    // Colocamos la imagen con el norte arriba para que coincida con el terreno.
    for (let i = 0; i < positions.count; i++)
      uv.setXY(
        i,
        (positions.getX(i) - southwest.x) / (northeast.x - southwest.x),
        (positions.getY(i) + southwest.z) / (southwest.z - northeast.z)
      );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  parent.add(group);
  return group;
}
