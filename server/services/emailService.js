const nodemailer = require('nodemailer');

const getTransporter = async () => {
  // If production environment variables are present, connect to real SMTP provider
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Fallback: Use Ethereal sandbox automatically for local testing
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
};

const sendEmail = async ({ to, subject, text }) => {
  try {
    const activeTransporter = await getTransporter();

    const mailOptions = {
      from: '"MealPlan Support" <support@mealplan.local>',
      to,
      subject,
      text
    };

    const info = await activeTransporter.sendMail(mailOptions);

    // In development mode, Nodemailer creates a URL link where you can view the actual rendered email inbox message
    console.log('\n==================================================');
    console.log(`✉️  EMAIL SENT SUCCESSFULLY`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    console.log('==================================================\n');

    return info;
  } catch (error) {
    console.error('Email dispatch pipeline failure:', error);
    throw error;
  }
};

module.exports = { sendEmail };
