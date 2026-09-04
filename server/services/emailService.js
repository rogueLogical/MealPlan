/**
 * Email Service — wraps nodemailer for type-safe, consistent sending.
 */

const nodemailer = require('nodemailer');

let transporter;
transporter = null; // Default: unconfigured

function init() {
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

function send(to, subject, text, html = null) {
  if (!transporter) {
    console.warn('EmailService.send: not configured (SMTP_HOST not set)');
    // Check for admin alert fallback
    if (process.env.ADMIN_ALERT_EMAIL) {
      return _sendAdminAlert(to, subject, text);
    }
    return Promise.resolve({ sent: false, reason: 'not configured' });
  }

  const message = { from: process.env.SMTP_FROM || 'MealPlan <noreply@mealplan.local>' };

  if (!Array.isArray(to)) message.to = to;
  else message.to = to.map((t) => t.email);

  return transporter.sendMail({ subject, text, html }).catch((err) => {
    console.error('[EmailService] send failed:', err.message);

    // Fallback: admin alert on email dispatch failure
    if (process.env.ADMIN_ALERT_EMAIL) {
      const adminRecipient = process.env.ADMIN_ALERT_EMAIL;

      // Extract user info from recipient address for context
      let userEmail = 'unknown';
      try {
        const [userEmailPart] = to
          .toString()
          .split(',')
          .map((e) => e.trim());
        if (userEmailPart && !userEmailPart.includes('@admin')) {
          userEmail = userEmailPart;
        }
      } catch (_) {
        // Ignore parse errors
      }

      return _sendAdminAlert(
        `${userEmail} — Email failed`,
        `[MealPlan Admin] Failed to send email to: ${to}`,
        `Failed to deliver email: "${subject}"\n\nTo: ${Array.isArray(to) ? to.map((e) => e.email).join(', ') : to}\nSubject: ${subject}\n\nError: ${err.message}\n\nPlease check the user's email address or SMTP configuration.`
      );
    }

    throw err;
  });
}

/**
 * Sends an admin alert when a user email fails.
 */
function _sendAdminAlert(to, subject, text) {
  return new Promise((resolve, reject) => {
    const message = { from: process.env.SMTP_FROM || 'MealPlan <noreply@mealplan.local>' };

    if (!Array.isArray(to)) message.to = to;
    else message.to = to.map((t) => t.email);

    transporter
      .sendMail({ subject, text })
      .then(() => {
        console.log(`[EmailService] Admin alert sent: ${subject}`);
        resolve({ sent: true });
      })
      .catch((err) => {
        console.error('[EmailService] Admin alert also failed:', err.message);
        reject(new Error('Admin alert delivery failed'));
      });
  });
}

module.exports = { init, send };
