/* Stands in for @mediapipe/tasks-vision.
   The real package is a browser build and will not load under Node, but
   pose.js only touches it inside start(), so everything else in that module
   is testable the moment the import resolves to something. */

export class PoseLandmarker {
  static async createFromOptions(files, opts){
    const lm = new PoseLandmarker();
    lm.options = opts;
    return lm;
  }
  /* Tests inject their own by assigning pose.lm, so this is only here to keep
     the shape honest if something calls it unexpectedly. */
  detectForVideo(){ return { landmarks: [] }; }
  close(){}
}

export const FilesetResolver = {
  async forVisionTasks(dir){ return { wasmLoaderPath: dir }; }
};

export const DrawingUtils = class {};
