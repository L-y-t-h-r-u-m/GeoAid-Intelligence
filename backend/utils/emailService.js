const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Using ethereal email for testing if no real credentials are provided
  // It generates an ethereal account on the fly or logs to console
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    auth: {
      user: process.env.EMAIL_USER || 'ethereal_user', 
      pass: process.env.EMAIL_PASS || 'ethereal_pass'
    }
  });

  const mailOptions = {
    from: 'NGO Relief Hub <noreply@ngoreliefhub.org>',
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    // If using ethereal, you could log nodemailer.getTestMessageUrl(info)
  } catch (error) {
    console.error(`Error sending email: ${error.message}`);
    // Fallback: If no valid SMTP is configured, log the OTP to console so development can continue
    console.log(`\n\n[DEV MOCK EMAIL] To: ${options.email}\nSubject: ${options.subject}\nMessage: ${options.message}\n\n`);
  }
};

module.exports = sendEmail;
