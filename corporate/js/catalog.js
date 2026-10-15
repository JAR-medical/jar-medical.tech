// Course catalog: grouped into three sections on the client dashboard:
//   - "understand": architecture, speech model, sectors, privacy & limits
//   - "test":       interactive demos (voice capture & diarization, ASR pipeline, live operating picture & AR client)
//   - "train":      role-based operational training with knowledge checks & certificates
import jarUeberblick from "./courses/jar-ueberblick.js";
import edgeKiSprache from "./courses/edge-ki-sprache.js";
import datenschutzSicherheit from "./courses/datenschutz-sicherheit.js";
import asrModell from "./courses/asr-modell.js";
import arRfidSystem from "./courses/ar-rfid-system.js";
import mapping3dLagebild from "./courses/3d-mapping-lagebild.js";
import transcriptionDemo from "./courses/jar-transcription-demo.js";
import asrSichtungsDemo from "./courses/asr-sichtungs-demo.js";
import lagebildArDemo from "./courses/lagebild-ar-demo.js";
import katastrophenschutz from "./courses/katastrophenschutz.js";
import trainingArTrupp from "./courses/training-ar-trupp.js";
import trainingKlinikPflege from "./courses/training-klinik-pflege.js";

export const SECTIONS = ["understand", "test", "train"];

export const COURSES = [
  // 1. Understand
  jarUeberblick,
  edgeKiSprache,
  datenschutzSicherheit,
  asrModell,
  arRfidSystem,
  mapping3dLagebild,
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
