const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Passcode is stored plaintext in env (single shared secret), but we compare
// via bcrypt hash of that env value so the raw passcode is never compared
// directly in memory more than necessary, and to satisfy "hash it anyway".
let cachedHash = null;
async function getPasscodeHash() {
  if (!cachedHash) {
    cachedHash = await bcrypt.hash(process.env.ADMIN_PASSCODE || '', 10);
  }
  return cachedHash;
}

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { passcode } = req.body || {};
    if (!passcode || typeof passcode !== 'string') {
      return res.status(400).json({ error: 'Passcode is required.' });
    }

    const hash = await getPasscodeHash();
    const match = await bcrypt.compare(passcode, hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid passcode.' });
    }

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '12h',
    });

    return res.json({ token });
  } catch (err) {
    console.error('POST /api/admin/login error:', err);
    return res.status(500).json({ error: 'Something went wrong logging in.' });
  }
});

module.exports = router;
