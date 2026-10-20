// Course catalog: grouped into three sections on the client dashboard:
//   - "understand": animated explainer courses (speech model, AR mesh, 3D mapping)
//   - "test":       hands-on demos (voice recording & diarization, drone footage to 3D mesh)
//   - "train":      role-based operational training (none offered at the moment)
import transkriptionModell from "./courses/transkription-modell.js";
import arMeshSichtung from "./courses/ar-mesh-sichtung.js";
import kartierung3dQuellen from "./courses/kartierung-3d-quellen.js";
import demoTranskription from "./courses/demo-transkription.js";
import demo3dKartierung from "./courses/demo-3d-kartierung.js";

export const SECTIONS = ["understand", "test", "train"];

// The previous catalog is archived on the corporate/courses-archive branch.
export const COURSES = [
  // 1. Understand
  transkriptionModell,
  arMeshSichtung,
  kartierung3dQuellen,
  // 2. Test
  demoTranskription,
  demo3dKartierung,
];

export function getCourse(id) {
  if (typeof id !== "string") return null;
  return COURSES.find((c) => c.id === id) || null;
}

export function lessonCount(course) {
  return course && Array.isArray(course.lessons) ? course.lessons.length : 0;
}
