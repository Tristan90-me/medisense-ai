// Prefill copy for the admin announcement compose form — picking one just
// fills the title/body fields, which stay editable. Not backend config:
// this is pure UI convenience, not something the server enforces.
//
// `audience` here is only a display hint (shown next to the template's
// label in the dropdown) — it does NOT change the admin's "Send to"
// selection. A template's copy is generic enough to apply to any audience
// (e.g. the critical-followup message can go to one specific user, not just
// the full critical-condition cohort), so picking a template never
// overrides whichever audience the admin already chose.
const announcementTemplates = [
  {
    id: 'maintenance',
    label: 'Scheduled maintenance',
    audience: 'all',
    title: 'Scheduled Maintenance',
    body: 'MediSense AI will be briefly unavailable for scheduled maintenance. We apologize for any inconvenience and appreciate your patience.',
  },
  {
    id: 'feature-update',
    label: 'New feature announcement',
    audience: 'all',
    title: "What's New",
    body: "We've added new features to help you better track and manage your health. Check them out from your dashboard.",
  },
  {
    id: 'critical-followup',
    label: 'Critical follow-up',
    audience: 'critical',
    title: 'Please Check In With Us',
    body: "We noticed one of your recent symptom check-ins was flagged as high severity. If you're still experiencing these symptoms, please consider seeking medical attention or contacting your healthcare provider. Your wellbeing matters to us.",
  },
  {
    id: 'general-checkin',
    label: 'General check-in',
    audience: 'user',
    title: 'How Are You Feeling?',
    body: "We wanted to check in and see how you're doing. If you have any health concerns, feel free to start a new symptom check-in anytime.",
  },
];

export default announcementTemplates;
