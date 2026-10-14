// Course catalog: the single list of courses the portal knows about. Course
// content is public data shipped with the site; access to it is gated by the
// enrollment check in the backend (and RLS in the Supabase setup).
import course from "./courses/katastrophenschutz.js";
import transcriptionDemo from "./courses/jar-transcription-demo.js";

export const COURSES = [course, transcriptionDemo];

export function getCourse(id) {
  if (typeof id !== "string") return null;
  return COURSES.find((c) => c.id === id) || null;
}

export function lessonCount(course) {
  return course && Array.isArray(course.lessons) ? course.lessons.length : 0;
}
