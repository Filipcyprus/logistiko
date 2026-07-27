// Παρακολούθηση μηνυμάτων από συνεργάτες που δεν έχουν διαβαστεί ακόμα (τοπικά, ανά browser).
const KEY_PREFIX = "logistiko_job_seen_";

export function getSeenCount(jobId) {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(KEY_PREFIX + jobId) || 0);
}

export function setSeenCount(jobId, count) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + jobId, String(count));
}

export function partnerMsgCount(job) {
  return (job.messages || []).filter((m) => m.author === "partner").length;
}

export function ownerMsgCount(job) {
  return (job.messages || []).filter((m) => m.author === "owner").length;
}

export function unreadCountForJobs(jobs) {
  return jobs.reduce((sum, j) => sum + Math.max(0, partnerMsgCount(j) - getSeenCount(j.id)), 0);
}

// Ίδια λογική, από την πλευρά του συνεργάτη: μετράει όσα κατέγραψε ο ιδιοκτήτης (μηνύματα + αλλαγές).
export function unreadCountForJobsFromOwner(jobs) {
  return jobs.reduce((sum, j) => sum + Math.max(0, ownerMsgCount(j) - getSeenCount(j.id)), 0);
}
