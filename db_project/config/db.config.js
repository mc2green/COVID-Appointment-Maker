const Pool = require('pg').Pool
const pool = new Pool({
  user: 'matthewchen',
  host: 'localhost',
  database: 'HW1',
  password: '',
  port: 5432,
})

module.exports = pool;
