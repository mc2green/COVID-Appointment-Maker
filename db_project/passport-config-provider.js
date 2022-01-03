const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

function initialize(passport, getProviderByName, getProviderById) {
  const authenticateUser = async (login_name, password, done) => {
    const user = await getProviderByName(login_name)
    console.log('user: '  + user);
    if (user == null) {
      return done(null, false, { message: 'No user with that login name' })
    }

    try {
      console.info("password: " + password);
      console.info("user.password: " + user.password);
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user)
      } else {
        return done(null, false, { message: 'Password incorrect' })
      }
    } catch (e) {
      return done(e)
    }
  }

  passport.use(new LocalStrategy({ usernameField: 'login_name' }, authenticateUser))
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    return done(null, getProviderById(id))
  })
}

module.exports = initialize