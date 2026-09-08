const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'MediSense AI API',
      version: '1.0.0',
      description:
        'REST API for MediSense AI — an AI health symptom checker. Covers consumer auth/onboarding/sessions and a separately-authenticated admin surface (see the "Admin" tag).',
    },
    servers: [
      { url: '/api', description: 'Relative to whichever host is serving this API' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Consumer or admin JWT, depending on the endpoint — obtained from /auth/verify-otp or /admin/auth/verify-otp.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid credentials' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              description: 'Present on 400 validation failures — one entry per invalid field.',
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Consumer registration, login, and OTP verification' },
      { name: 'Profile', description: 'Consumer health profile' },
      { name: 'Dependents', description: 'Family members managed under a consumer account' },
      { name: 'Emergency Contacts', description: 'Per-user emergency contacts (no dependent scoping)' },
      { name: 'Account', description: 'Account profile, password, trusted devices, and self-service account deletion' },
      { name: 'Medications', description: 'Structured, trackable medications for the user and their dependents (separate from HealthProfile.currentMedications free-text self-report)' },
      { name: 'Health Score', description: 'Composite wellness score, sub-score breakdown, and gamified achievements — recomputed on demand from session/profile/medication data' },
      { name: 'Care Finder', description: 'Nearby hospitals, clinics, doctors, pharmacies, and dentists — sourced live from OpenStreetMap via the public Overpass API, no key/billing required' },
      { name: 'Photo Log', description: 'Symptom photo uploads (stored in GridFS) with best-effort, non-diagnostic Gemini visual analysis' },
      { name: 'Community', description: 'Anonymized, privacy-floored community symptom & severity trends aggregated across all users' },
      { name: 'Announcements', description: 'Admin-broadcast, in-app-only announcements (no push/VAPID) surfaced in the consumer notification bell' },
      { name: 'AI', description: 'Guided symptom-check sessions and the floating assistant chat' },
      { name: 'Admin Auth', description: 'Admin login/OTP/invite-acceptance — entirely separate from consumer auth' },
      { name: 'Admin', description: 'Admin-only user/session management and admin provisioning (adminOnly)' },
    ],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
