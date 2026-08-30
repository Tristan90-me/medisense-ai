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
      { name: 'AI', description: 'Guided symptom-check sessions and the floating assistant chat' },
      { name: 'Admin Auth', description: 'Admin login/OTP/invite-acceptance — entirely separate from consumer auth' },
      { name: 'Admin', description: 'Admin-only user/session management and admin provisioning (adminOnly)' },
    ],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
