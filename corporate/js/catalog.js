// Course catalog: grouped into three sections on the client dashboard:
//   - "understand": architecture, speech model, sectors, privacy & limits
//   - "test":       interactive demos (voice capture & diarization, ASR pipeline, live operating picture & AR client)
//   - "train":      role-based operational training with knowledge checks & certificates

export const SECTIONS = ["understand", "test", "train"];

// No courses are currently offered. The previous catalog is archived on the
// corporate/courses-archive branch.
export const COURSES = [];

export function getCourse(id) {
  if (typeof id !== "string") return null;
  return COURSES.find((c) => c.id === id) || null;
}

export function lessonCount(course) {
  return course && Array.isArray(course.lessons) ? course.lessons.length : 0;
}
