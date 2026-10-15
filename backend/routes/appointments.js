const express = require('express');
const router = express.Router();
const {
  getAppointments, createAppointment, updateAppointment, deleteAppointment,
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createAppointmentRules, updateAppointmentRules, appointmentIdParamRules, listAppointmentsQueryRules,
} = require('../validators/appointmentValidators');

/**
 * @swagger
 * /appointments:
 *   get:
 *     tags: [Appointments]
 *     summary: List appointments
 *     description: >
 *       A personal tracker, not a real booking system — no integration with
 *       any provider's scheduling. With `dependent`, scopes to that one
 *       person (ownership-checked). Without it, returns the union across
 *       self and every dependent under this account. Sorted soonest-first.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dependent
 *         required: false
 *         schema: { type: string }
 *         description: Dependent id to scope to. Omit for self + all dependents.
 *     responses:
 *       200: { description: Array of appointments }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.get('/', protect, validate(listAppointmentsQueryRules), getAppointments);

/**
 * @swagger
 * /appointments:
 *   post:
 *     tags: [Appointments]
 *     summary: Add an appointment
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctorName, dateTime]
 *             properties:
 *               doctorName: { type: string, maxLength: 200 }
 *               specialty: { type: string }
 *               dateTime: { type: string, format: date-time }
 *               location: { type: string }
 *               notes: { type: string }
 *               dependent: { type: string, description: Dependent id, or omit for self }
 *     responses:
 *       201: { description: Appointment created }
 *       400: { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
 *       404: { description: Dependent not found or not owned by this user }
 */
router.post('/', protect, validate(createAppointmentRules), createAppointment);

/**
 * @swagger
 * /appointments/{id}:
 *   put:
 *     tags: [Appointments]
 *     summary: Update an appointment (reschedule, cancel, edit details)
 *     description: "Set status to cancelled to cancel an appointment — appointments are never auto-deleted, only explicitly removed."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated appointment }
 *       404: { description: Appointment not found or not owned by this user }
 */
router.put('/:id', protect, validate([...appointmentIdParamRules, ...updateAppointmentRules]), updateAppointment);

/**
 * @swagger
 * /appointments/{id}:
 *   delete:
 *     tags: [Appointments]
 *     summary: Remove an appointment
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Appointment removed }
 *       404: { description: Appointment not found or not owned by this user }
 */
router.delete('/:id', protect, validate(appointmentIdParamRules), deleteAppointment);

module.exports = router;
