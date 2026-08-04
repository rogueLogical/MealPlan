const nodemailer = require('nodemailer');
const { sendEmail } = require('../services/emailService');

jest.mock('nodemailer');

describe('Email Service Unit Tests', () => {
  let mockSendMail;
  let mockCreateTransport;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset process.env SMTP variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_SERVICE;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    mockSendMail = jest.fn();
    mockCreateTransport = {
      sendMail: mockSendMail
    };

    nodemailer.createTransport.mockReturnValue(mockCreateTransport);
    nodemailer.createTestAccount.mockResolvedValue({
      user: 'ethereal_user',
      pass: 'ethereal_pass'
    });
    nodemailer.getTestMessageUrl.mockReturnValue('https://ethereal.email/message/123');
  });

  it('should send email using Ethereal sandbox fallback when SMTP_HOST is not set', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg_123' });

    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Test Body'
    });

    expect(nodemailer.createTestAccount).toHaveBeenCalled();
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'ethereal_user',
        pass: 'ethereal_pass'
      }
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"MealPlan Support" <support@mealplan.local>',
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Test Body'
    });

    expect(nodemailer.getTestMessageUrl).toHaveBeenCalled();
    expect(result).toEqual({ messageId: 'msg_123' });
  });

  it('should send email using production SMTP configurations when SMTP_HOST is set', async () => {
    process.env.SMTP_HOST = 'smtp.sendgrid.net';
    process.env.SMTP_SERVICE = 'SendGrid';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'smtp_username';
    process.env.SMTP_PASS = 'smtp_password';

    mockSendMail.mockResolvedValue({ messageId: 'msg_prod_123' });

    const result = await sendEmail({
      to: 'prod_user@example.com',
      subject: 'Prod Subject',
      text: 'Prod Body'
    });

    expect(nodemailer.createTestAccount).not.toHaveBeenCalled();
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'SendGrid',
      host: 'smtp.sendgrid.net',
      port: 465,
      secure: true,
      auth: {
        user: 'smtp_username',
        pass: 'smtp_password'
      }
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"MealPlan Support" <support@mealplan.local>',
      to: 'prod_user@example.com',
      subject: 'Prod Subject',
      text: 'Prod Body'
    });

    expect(result).toEqual({ messageId: 'msg_prod_123' });
  });

  it('should use default port 587 when SMTP_PORT is not provided in SMTP configuration', async () => {
    process.env.SMTP_HOST = 'smtp.mailtrap.io';

    mockSendMail.mockResolvedValue({ messageId: 'msg_default_port' });

    await sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      text: 'Text'
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false
      })
    );
  });

  it('should catch dispatch failures, log console error, and re-throw the exception', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP Connection Refused'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      sendEmail({
        to: 'fail@example.com',
        subject: 'Failure Test',
        text: 'Body'
      })
    ).rejects.toThrow('SMTP Connection Refused');

    expect(consoleSpy).toHaveBeenCalledWith('Email dispatch pipeline failure:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});
