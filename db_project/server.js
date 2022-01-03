if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const path = require('path')
const app = express()
const bcrypt = require('bcrypt')
// const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const cookieParser = require('cookie-parser')

// const {findUserByEmail, findUserById} = require('./models/queries')
/*
const initializePassport = require('./passport-config')
initializePassport(
  passport,
  // email => users.find(user => user.email === email),
  // id => users.find(user => user.id === id)
  findUserByEmail,
  findUserById
)
*/

app.use(express.static(path.join(__dirname, './public')))
app.set('view-engine', 'ejs')
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }))
app.use(flash())
/*
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
*/
app.use(methodOverride('_method'))

app.get('/', (req, res) => {
  const userId = req.cookies.cookieName
  res.render('patient/index.ejs', { name: userId })
})

app.use('/', require('./api'))

app.listen(3333)