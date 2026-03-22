const admin = require('firebase-admin');
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!rawServiceAccount) {
  throw new Error(
    'Missing FIREBASE_SERVICE_ACCOUNT. Set it in backend/.env.local as a JSON string from your Firebase service account key.'
  );
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawServiceAccount);
} catch (error) {
  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT is not valid JSON. Ensure backend/.env.local contains a properly escaped JSON string.'
  );
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
