export class PoseLandmarker { static async createFromOptions(){ return new PoseLandmarker(); }
  detectForVideo(){ return { landmarks: [] }; } close(){} }
export const FilesetResolver = { async forVisionTasks(d){ return { wasmLoaderPath: d }; } };
