const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const certPath = path.join(__dirname, 'ProductionCertificate.cer');

if (!fs.existsSync(certPath)) {
  console.error('Please download ProductionCertificate.cer from Safaricom portal and place it in the scripts folder.');
  process.exit(1);
}

const cert = fs.readFileSync(certPath);
const initiatorPassword = process.argv[2] || 'YOUR_INITIATOR_PASSWORD';

try {
  const encrypted = crypto.publicEncrypt(
    { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(initiatorPassword)
  );

  console.log('\n--- SET THIS IN YOUR .env FILE ---');
  console.log('DARAJA_SECURITY_CREDENTIAL=' + encrypted.toString('base64'));
  console.log('----------------------------------\n');
} catch (err) {
  console.error('Failed to encrypt. Ensure the certificate is valid.', err.message);
}
