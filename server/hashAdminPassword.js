//server/hashAdminPassword.js
const bcrypt = require('bcrypt');

const password = 'admin123'; // ← Yehi woh password hoga jo login page pe enter karogi
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Hashed password:', hash);
});
