const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set');
      process.exit(2);
    }

    await mongoose.connect(uri, { maxPoolSize: 5 });
    console.log('Connected to MongoDB');

    const Job = require('../src/models/Job');
    const User = require('../src/models/User');
    const JobApplication = require('../src/models/JobApplication');

    // Clean up any previous test artifacts with this marker
    const marker = 'test-forward-' + Date.now();

    // Create test owner email and applicant
    const ownerEmail = `owner+${marker}@example.invalid`;
    const applicantEmail = `applicant+${marker}@example.invalid`;

    const job = await Job.create({
      externalId: `test-${marker}`,
      source: 'internal',
      title: 'Test Forward Role',
      company: 'TestCo',
      category: 'Other',
      jobType: 'full-time',
      location: 'Remote',
      description: 'This is a test job for forwarding',
      applicationUrl: `mailto:${ownerEmail}`,
      applicationContactEmail: ownerEmail,
      applicationContactSource: 'test-script',
      isActive: true,
      publishedAt: new Date(),
    });

    const user = await User.create({
      userId: `testuser-${marker}`,
      email: applicantEmail,
      name: 'Test Applicant',
      firstName: 'Test',
      lastName: 'Applicant',
      phone: `+100000${Math.floor(Math.random() * 90000) + 10000}`,
      passwordHash: 'test-password',
      country: 'KE',
      tokenBalance: 1000,
    });

    // Stub sendgridClient to avoid sending real emails
    const notification = require('../src/services/notificationService');
    const originalSend = notification.sendgridClient.sendEmail;
    let forwardedPayload = null;
    notification.sendgridClient.sendEmail = async (payload) => {
      forwardedPayload = payload;
      console.log('Stubbed sendEmail called with:', JSON.stringify(payload, null, 2));
      return Promise.resolve({ success: true });
    };

    // Prepare fake req/res for controller
    const controller = require('../src/controllers/jobApplicationController');

    const req = {
      params: { id: job._id.toString() },
      body: { coverLetter: 'Hello, I am interested in this role.' },
      user: { id: user._id.toString(), tokenBalance: user.tokenBalance },
    };

    const res = {
      status(code) { this._code = code; return this; },
      json(payload) { console.log('Controller response status', this._code || 200); console.log('Response JSON:', payload); },
    };

    // Call applyToJob
    await controller.applyToJob(req, res);

    // Wait a short while for async forward to execute
    await new Promise((r) => setTimeout(r, 3000));

    if (!forwardedPayload) {
      console.warn('Forwarding did not run or payload not captured.');
    }

    // Cleanup test data (only artifacts created by this test)
    await JobApplication.deleteMany({ jobId: job._id });
    await Job.deleteOne({ _id: job._id });
    await User.deleteOne({ _id: user._id });

    // Restore send function
    notification.sendgridClient.sendEmail = originalSend;

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err.message || err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
