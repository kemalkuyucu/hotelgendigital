const bcrypt = require('bcryptjs');
const password = 'AdminYonetici?=2026';
const newHash = bcrypt.hashSync(password, 12);
console.log('New hash for "AdminYonetici?=2026":');
console.log(newHash);
console.log('Verify:', bcrypt.compareSync(password, newHash));
