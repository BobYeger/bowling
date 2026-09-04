// Babylon.js for the ski game. Dev and tests bundle it from npm; artifact builds swap this file
// for babylon-cdn.js (see vite.config.js) so the single-file artifact stays small and loads the
// pinned UMD build from jsdelivr instead of carrying 8 MB of engine.
import * as B from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders/glTF';
export default B;
