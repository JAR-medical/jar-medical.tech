// Course catalog: grouped into three sections on the client dashboard:
//   - "understand": AR system architecture, 3D mapping & flood simulation, speech model, sectors, privacy & limits
//   - "test":       interactive demos (voice capture & diarization via Cloudflare Tunnel, ASR pipeline, live operating picture & AR client)
//   - "train":      role-based operational training with knowledge checks & certificates
import arGesamtsystem from "./courses/ar-gesamtsystem.js";
import kartierung3dFlut from "./courses/kartierung-3d-flut.js";
import jarUeberblick from "./courses/jar-ueberblick.js";
import edgeKiSprache from "./courses/edge-ki-sprache.js";
import datenschutzSicherheit from "./courses/datenschutz-sicherheit.js";
import transcriptionDemo from "./courses/jar-transcription-demo.js";
import asrSichtungsDemo from "./courses/asr-sichtungs-demo.js";
import lagebildArDemo from "./courses/lagebild-ar-demo.js";
import katastrophenschutz from "./courses/katastrophenschutz.js";
import trainingArTrupp from "./courses/training-ar-trupp.js";
import trainingKlinikPflege from "./courses/training-klinik-pflege.js";

export const SECTIONS = ["understand", "test", "train"];

export const COURSES = [
  // 1. Understand
  arGesamtsystem,
  kartierung3dFlut,
  jarUeberblick,
  edgeKiSprache,
  datenschutzSicherheit,
  // 2. Test
  transcriptionDemo,
  asrSichtungsDemo,
  lagebildArDemo,
  // 3. Train
  katastrophenschutz,
  trainingArTrupp,
  trainingKlinikPflege,
];

export function getCourse(id) {
  if (typeof id !== "string") return null;
  return COURSES.find((c) => c.id === id) || null;
}

export function lessonCount(course) {
  return course && Array.isArray(course.lessons) ? course.lessons.length : 0;
}
