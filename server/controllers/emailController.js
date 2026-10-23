/**
 * emailController.js
 * Controller exposing endpoints for transactional email flows and diagnostics
 */

const {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingStatusUpdateEmail
} = require('../services/emailService');
const emailConfig = require('../config/emailConfig');

/**
 * Send a test email to verify Brevo configuration
 * POST /api/email/test
 */
const testEmail = async (req, res) => {
  try {
    const { to } = req.body;
    const recipient = to || emailConfig.SENDER_EMAIL;

    console.log(`[emailController] Triggering test email to ${recipient}...`);

    const result = await sendEmail({
      to: recipient,
      subject: '🎬 iMovies Brevo Transactional Email Live Test',
      htmlContent: `
        <div style="font-family:sans-serif;background:#0d111b;color:#fff;padding:28px;border-radius:12px;max-width:520px;">
          <h2 style="color:#e50914;margin:0 0 12px;">🎬 iMovies Email Gateway</h2>
          <p style="color:#94a3b8;font-size:15px;line-height:1.5;">Your Brevo transactional email integration is operational and ready to dispatch account verifications, password resets, and ticket bookings.</p>
          <div style="background:#171f30;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:13px;color:#38bdf8;margin:16px 0;">
            Sender: ${emailConfig.SENDER_NAME} &lt;${emailConfig.SENDER_EMAIL}&gt;
          </div>
          <p style="font-size:12px;color:#64748b;margin:0;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      tags: ['test', 'diagnostic']
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Test email successfully dispatched to ${recipient}`,
        messageId: result.messageId
      });
    }

    return res.status(result.status || 500).json({
      success: false,
      error: result.error || 'Failed to send test email',
      details: result.details
    });
  } catch (error) {
    console.error('[emailController Error in testEmail]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during email dispatch'
    });
  }
};

/**
 * Trigger manual ticket confirmation email
 * POST /api/email/ticket-confirmation
 */
const sendCustomTicketConfirmation = async (req, res) => {
  try {
    const { email, bookingDetails } = req.body;
    if (!email || !bookingDetails) {
      return res.status(400).json({ success: false, error: 'Email and bookingDetails are required' });
    }

    const result = await sendBookingConfirmationEmail(email, bookingDetails);
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Ticket confirmation sent to ${email}`,
        messageId: result.messageId
      });
    }

    return res.status(result.status || 500).json({
      success: false,
      error: result.error || 'Failed to dispatch ticket email',
      details: result.details
    });
  } catch (error) {
    console.error('[emailController Error in sendCustomTicketConfirmation]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Trigger booking status update email
 * POST /api/email/status-update
 */
const sendCustomStatusUpdate = async (req, res) => {
  try {
    const { email, statusDetails } = req.body;
    if (!email || !statusDetails) {
      return res.status(400).json({ success: false, error: 'Email and statusDetails are required' });
    }

    const result = await sendBookingStatusUpdateEmail(email, statusDetails);
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Status update sent to ${email}`,
        messageId: result.messageId
      });
    }

    return res.status(result.status || 500).json({
      success: false,
      error: result.error || 'Failed to dispatch status email',
      details: result.details
    });
  } catch (error) {
    console.error('[emailController Error in sendCustomStatusUpdate]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  testEmail,
  sendCustomTicketConfirmation,
  sendCustomStatusUpdate
};
