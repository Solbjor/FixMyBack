const express = require('express');
const router = express.Router();
const admin = require('../config/firebase');
const axios = require('axios');
const { db } = require('../db');
const { users } = require('../db/migrations/schema');

/**
 * POST /auth/signup
 * Body: { email, password, displayName? }
 * Creates a new user via Firebase Admin SDK.
 */
router.post('/signup', async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      ...(displayName && { displayName }),
    });

    await db.insert(users).values({
      userId: userRecord.uid,
      fullName: displayName ?? null,
    });

    return res.status(201).json({
      message: 'User created successfully',
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName ?? null,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 * Signs in via the Firebase Auth REST API and returns an ID token.
 * Requires FIREBASE_WEB_API_KEY in .env (different from the service account key).
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'FIREBASE_WEB_API_KEY is not configured on the server' });
  }

  try {
    const { data } = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      { email, password, returnSecureToken: true }
    );

    return res.status(200).json({
      message: 'Login successful',
      uid: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    });
  } catch (error) {
    const message = error.response?.data?.error?.message ?? error.message;
    return res.status(401).json({ error: message });
  }
});

module.exports = router;
