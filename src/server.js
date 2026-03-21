require('dotenv').config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Auth routes: /auth/signup  /auth/login
app.use('/auth', authRoutes);

// Example of a protected route using the authenticate middleware
// const authenticate = require('./middleware/authenticate');
// app.get('/profile', authenticate, (req, res) => {
//   res.json({ uid: req.user.uid, email: req.user.email });
// });

app.use('/sessions', sessionRoutes);

app.listen(PORT, () => {
  console.log(`FixMyBack server running on port ${PORT}`);
});
