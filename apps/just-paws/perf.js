/* Just Paws: render performance helpers (three.js r128, no deps). window.JPPerf
 *   const PERF = JPPerf.init(THREE, renderer, {toonMats, maxPR, minPR, onResize});
 *   PERF.mergeStatic(scene, excludeList)   collapse static scene-level meshes into a few big meshes
 *   PERF.mergeGroup(group, keepList)       collapse a rigid Group's meshes (props, bots, clouds)
 *   PERF.frame(now)                        every frame: dynamic resolution (calls onResize(pr))
 * Merging bakes each mesh's world transform, material colour (as vertex colour) and texture
 * repeat/offset (into UVs), and buckets meshes by what still differs (texture image, emissive,
 * side, shadow flags ...). Merged-away meshes are removed from the scene but keep their matrices,
 * so raycasts against the game's `statics` list still work.
 */
(function(){
'use strict';
function init(THREE, renderer, opts){
  opts = opts || {};
  const toonMats = opts.toonMats || [];
  const stats = { before: 0, after: 0 };

  function keyOf(m, o){
    const mapId = m.map ? (m.map.image && (m.map.image.__jpId || (m.map.image.__jpId = Math.random().toString(36).slice(2)))) : '';
    return [m.type, mapId, m.map ? m.map.wrapS + ':' + m.map.wrapT : '', m.emissive ? m.emissive.getHex() + ':' + m.emissiveIntensity : '',
      m.side, !!m.flatShading, m.depthWrite, m.polygonOffset ? m.polygonOffsetFactor + ':' + m.polygonOffsetUnits : '',
      m.fog, !!m.gradientMap, o.castShadow, o.receiveShadow].join('|');
  }
  function mergeable(o){
    if(!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.noMerge || o.userData.dynamic) return false;
    if(o.morphTargetInfluences) return false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for(const m of mats){
      if(!m || m.isShaderMaterial || m.transparent || m.opacity < 1 || m.wireframe) return false;
      if(m.map && m.map.isVideoTexture) return false;
    }
    const g = o.geometry;
    return g && g.isBufferGeometry && g.attributes.position && g.attributes.position.count < 20000;
  }

  const v3 = new THREE.Vector3(), v2 = new THREE.Vector2(), col = new THREE.Color();
  // add mesh o (transform `mat4`) into buckets
  function collect(o, mat4, buckets){
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(mat4);
    if(!g.attributes.normal) g.computeVertexNormals();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = (Array.isArray(o.material) && g.groups.length) ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for(const gr of groups){
      const m = mats[gr.materialIndex]; if(!m || m.visible === false) continue;
      const k = keyOf(m, o);
      const b = buckets.get(k) || (buckets.set(k, { mat: m, cast: o.castShadow, recv: o.receiveShadow, parts: [], n: 0, ent: o.userData.ent }), buckets.get(k));
      b.parts.push({ g, m, start: gr.start, count: gr.count }); b.n += gr.count;
    }
  }
  function build(b){
    const n = b.n, hasUV = !!b.mat.map;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colA = new Float32Array(n * 3), uv = hasUV ? new Float32Array(n * 2) : null;
    let k = 0;
    for(const p of b.parts){
      const P = p.g.attributes.position, N = p.g.attributes.normal, U = p.g.attributes.uv, C = p.g.attributes.color;
      const useVC = p.m.vertexColors && C;
      const base = p.m.color ? p.m.color : new THREE.Color(1, 1, 1);
      if(hasUV && p.m.map){ p.m.map.updateMatrix(); }
      for(let i = p.start; i < p.start + p.count; i++, k++){
        pos[k * 3] = P.getX(i); pos[k * 3 + 1] = P.getY(i); pos[k * 3 + 2] = P.getZ(i);
        nor[k * 3] = N.getX(i); nor[k * 3 + 1] = N.getY(i); nor[k * 3 + 2] = N.getZ(i);
        let r = base.r, gg = base.g, bb = base.b;
        if(useVC){ r *= C.getX(i); gg *= C.getY(i); bb *= C.getZ(i); }
        colA[k * 3] = r; colA[k * 3 + 1] = gg; colA[k * 3 + 2] = bb;
        if(hasUV){
          if(U){ v2.set(U.getX(i), U.getY(i)); if(p.m.map) v2.applyMatrix3(p.m.map.matrix); } else v2.set(0, 0);
          uv[k * 2] = v2.x; uv[k * 2 + 1] = v2.y;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    if(uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = b.mat.clone();
    if(m.color) m.color.set(0xffffff);
    m.vertexColors = true;
    if(b.mat.map){ const t = b.mat.map.clone(); t.repeat.set(1, 1); t.offset.set(0, 0); t.rotation = 0; t.center.set(0, 0); t.needsUpdate = true; m.map = t; }
    m.needsUpdate = true;
    if(m.isMeshToonMaterial) toonMats.push(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.name = 'merged';
    if(b.ent) mesh.userData.ent = b.ent;
    for(const p of b.parts) if(p.g.__done !== true){ p.g.dispose(); p.g.__done = true; }
    return mesh;
  }

  // ---- static scene-level meshes (direct children of the scene and their mesh descendants) ----
  function mergeStatic(scene, exclude){
    const ex = new Set(exclude || []);
    scene.updateMatrixWorld(true);
    const buckets = new Map(), taken = [];
    const visit = (o) => {
      if(ex.has(o) || !o.visible) return false;
      if(!mergeable(o)) return false;
      // a mesh qualifies only if every mesh child also qualifies (keeps rigid sub-trees whole)
      for(const c of o.children) if(!c.isMesh || ex.has(c) || !mergeable(c)) return false;
      return true;
    };
    for(const o of scene.children.slice()){
      if(!visit(o)) continue;
      o.traverse(c => { if(c.isMesh && c.visible) collect(c, c.matrixWorld, buckets); });
      taken.push(o);
    }
    let count = 0; taken.forEach(o => o.traverse(c => { if(c.isMesh) count++; }));
    for(const o of taken) scene.remove(o);
    for(const b of buckets.values()) scene.add(build(b));
    stats.before += count; stats.after += buckets.size;
    return { removed: count, added: buckets.size };
  }

  // ---- rigid groups: bake children into the group's local space ----
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  function mergeGroup(group, keep){
    const kp = new Set(keep || []);
    group.updateMatrixWorld(true);
    inv.copy(group.matrixWorld).invert();
    const buckets = new Map(), taken = [];
    // a mesh is taken with its whole subtree only if every node in it is a mergeable, visible, non-kept mesh
    const whole = (o) => o.isMesh && !kp.has(o) && o.visible && mergeable(o) && o.children.every(whole);
    const walk = (o) => {
      for(const c of o.children.slice()){
        if(kp.has(c)) continue;
        if(whole(c)){ c.traverse(m => { rel.multiplyMatrices(inv, m.matrixWorld); collect(m, rel, buckets); }); taken.push(c); }
        else if(!c.isMesh && c.isGroup) walk(c);
      }
    };
    walk(group);
    if(taken.length < 2) return 0;
    for(const c of taken) c.parent.remove(c);
    for(const b of buckets.values()) group.add(build(b));
    stats.before += taken.length; stats.after += buckets.size;
    return taken.length - buckets.size;
  }

  // ---- dynamic resolution ----
  const maxPR = opts.maxPR || Math.min(window.devicePixelRatio || 1, 1.5);
  const minPR = opts.minPR || 0.6;
  let pr = Math.min(renderer.getPixelRatio(), maxPR), last = 0, acc = 0, n = 0, window_ = 0, calm = 0;
  if(pr !== renderer.getPixelRatio() && opts.onResize) opts.onResize(pr);
  function frame(now){
    if(!last){ last = now; return; }
    const d = now - last; last = now;
    if(d > 250) { acc = 0; n = 0; window_ = 0; return; }          // tab switch / hitch: ignore
    acc += d; n++; window_ += d;
    if(window_ < 700) return;
    const avg = acc / n; acc = 0; n = 0; window_ = 0;
    let next = pr;
    if(avg > 19) { next = Math.max(minPR, pr - (avg > 30 ? 0.25 : 0.12)); calm = 0; }
    else if(avg < 14.5) { if(++calm >= 4){ next = Math.min(maxPR, pr + 0.1); calm = 0; } }
    else calm = 0;
    next = Math.round(next * 100) / 100;
    if(next !== pr){ pr = next; if(opts.onResize) opts.onResize(pr); }
  }

  // shadows: render the shadow map every Nth frame (and never in the extra outline pass)
  let sf = 0; const shadowEvery = opts.shadowEvery || 2;
  function shadowNow(){ return (sf++ % shadowEvery) === 0; }

  return { mergeStatic, mergeGroup, frame, shadowNow, stats, get pixelRatio(){ return pr; } };
}
window.JPPerf = { init };
})();
