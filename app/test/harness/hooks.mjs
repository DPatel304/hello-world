/* Module resolution hooks. Two of the src dependencies only exist in a
   browser; both are redirected here so the rest of the tree loads under Node
   without touching src/. */

const VISION = new URL('./stub-vision.mjs', import.meta.url).href;
const SOUND  = new URL('./stub-sound.mjs',  import.meta.url).href;

export async function resolve(specifier, context, next){
  if (specifier === '@mediapipe/tasks-vision'){
    return { url: VISION, shortCircuit: true, format: 'module' };
  }
  const resolved = await next(specifier, context);
  if (resolved.url.endsWith('/src/audio/sound.js')){
    return { url: SOUND, shortCircuit: true, format: 'module' };
  }
  return resolved;
}
