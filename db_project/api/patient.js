const router = require('express').Router()
const bcrypt = require('bcrypt')
const { body, validationResult } = require('express-validator');

const {addUser, updateUser, getApptPreference, 
    addApptPreference, getCalendarDay, getCalendarTime,
    getAvailableAppointments, updateApptPreference,
    getPatientInfo, getPatientAppt, reserveAppt,
    getPateintEligibleGroupDate, cancelPatientAppt, acceptPatientAppt,
    declinePatientAppt
    } = require('../models/queries')

const session = require('express-session')
const Passport = require('passport').Passport
const passport = new Passport()
const {findUserByEmail, findUserById} = require('../models/queries')

const initializePassport = require('../passport-config')
initializePassport(
  passport,
  findUserByEmail,
  findUserById
)
router.use(session({
    secret: process.env.SESSION_SECRET + "_patient",
    resave: true,
    saveUninitialized: false
  }))
router.use(passport.initialize())
router.use(passport.session())


router.get('/', checkAuthenticated, async (req, res) => {
    console.info("session.user:");
    console.dir(req);
    const userId = req._passport.session.user;

    var user = await findUserById(userId)
    console.log("in get - user: ")
    console.dir(user)
    res.render('patient/index.ejs', { name: user.name })
})

router.get('/reservation', checkAuthenticated, async (req, res) => {
    console.log("reservation - GET:")
    console.info("session.user:");
    console.dir(req);
    const userId = req._passport.session.user;
    res.cookie('patient_cn', userId, { expires: new Date(Date.now() + 900000), httpOnly: true })
  
    const user = await findUserById(userId)
    console.log("in get - user: ")
    console.dir(user)
    const apptPreference = await getApptPreference(userId)
    const appointment = await getPatientAppt(userId)
    const eligibleGroupDate = await getPateintEligibleGroupDate(userId)
    const isEligible = new Date() >= eligibleGroupDate.eligible_date ? true : false
    res.render('patient/reservation.ejs', { name: user.name, 
        pref: apptPreference, appt: appointment, isEligible: isEligible,
        eligibleGroupDate: eligibleGroupDate })
})

router.get('/appt_preference', checkAuthenticated, async (req, res) => {
    console.log("appt_preference - GET:")
    console.debug("in app_preference - get")
    console.debug("edit flag: " + req.query.edit)

    const userId = req._passport.session.user;
    const apptPreference = await getApptPreference(userId)
    const user = await findUserById(userId)
    const calDay = await getCalendarDay()
    const calTime = await getCalendarTime()
    console.info("calDay:")
    console.dir(calDay)
    const editMode = req.query.edit !== undefined ? "edit" : "add"
    res.render('patient/appt_preference.ejs', {name: user.name,
        calDay: calDay,
        calTime: calTime,
        pref: apptPreference,
        mode: editMode})
    }
)

router.post('/appt_preference', 
    checkAuthenticated, 
    body('pref_day').notEmpty().escape(),
    body('pref_time').notEmpty().escape(),
    body('max_distance').notEmpty().escape().isInt(),
    async (req, res) => {
    console.debug("in app_preference - post")
    try {
        console.log("in appt_preference: ")
        const userId = req._passport.session.user;
        const attrs = {id: userId, 
            preferredDay: req.body.pref_day,
            preferredTime: req.body.pref_time,
            maxDistance: req.body.max_distance
          }
        if (req.body.mode == "add") {
            await addApptPreference(attrs);
        } else {
            await updateApptPreference(attrs);
        }
        
        res.redirect('/patient/reservation')
    } catch (error) {
        console.error(error)
        res.redirect('/patient/register')
    }
})

router.get('/schedule', checkAuthenticated, async (req, res) => {
    console.debug("in schedule - get")

    const userId = req._passport.session.user
    const user = await findUserById(userId)
    const availAppts = await getAvailableAppointments(userId)
    console.info("avail appts:")
    console.dir(availAppts)
    res.render('patient/schedule.ejs', {name: user.name,
        availAppts: availAppts})
    }
)

router.get('/reschedule', checkAuthenticated, async (req, res) => {
    console.debug("reschedule - GET: ")

    const userId = req._passport.session.user
    const user = await findUserById(userId)
    const appointment = await getPatientAppt(userId)

    res.render('patient/reschedule.ejs', {name: user.name,
        appt: appointment})
    }
)

router.post('/schedule', checkAuthenticated, async (req, res) => {
    console.debug("schedule - POST:")

    const userId = req._passport.session.user
    const user = await findUserById(userId)
    const apptId = req.body.appt_id
    console.log("appt_id: " + apptId)
    const availAppts = await reserveAppt(userId, apptId);

    const apptPreference = await getApptPreference(userId)
    const appointment = await getPatientAppt(userId)
    const eligibleGroupDate = await getPateintEligibleGroupDate(userId)
    const isEligible = new Date() >= eligibleGroupDate.eligible_date ? true : false
    res.render('patient/reservation.ejs', {name: user.name,
        pref: apptPreference, appt: appointment, isEligible: isEligible,
        eligibleGroupDate: eligibleGroupDate
    })
    }
)
  
router.get('/login', /* checkNotAuthenticated, */ async (req, res) => {
    const userId = req.cookies['patient_cn']
    console.debug("userId from cookie: " + userId)
    var user = {}
    if (userId) {
        user = await findUserById(userId)
    }
    res.render('patient/login.ejs', {name: user.name})
})
  
router.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/patient/reservation',
    failureRedirect: '/patient/login',
    failureFlash: true
}))
  
router.get('/register', /* checkNotAuthenticated, */ async (req, res) => {
    console.debug("register: edit flag: " + req.query.edit)

    // const userId = req._passport.session.user
    const editMode = req.query.edit !== undefined ? "edit" : "add"
    
    var patient = {} // await getPatientInfo(userId)
    if (editMode == "edit") {
        if (req._passport.session) {
            const userId = req._passport.session.user;
            patient = await getPatientInfo(userId)
        } else {
            res.redirect("/patient/login")
        }
    }
    res.render('patient/register.ejs', {
        mode: editMode,
        name: patient.name,
        ssn: patient.ssn,
        dob: patient.dob ? patient.dob.toISOString().slice(0, 10) : '',
        phone: patient.phone,
        address_1: patient.address_1,
        address_2: patient.address_2,
        city: patient.city,
        state: patient.state,
        zipcode: patient.zip_code,
        email: patient.email
    })
  })
  
router.post('/register', /* checkNotAuthenticated, */ 
    body('email').isEmail().normalizeEmail(),
    body('name').not().isEmpty().trim().escape(),
    body('ssn').not().isEmpty().trim().escape(),
    body('dob').not().isEmpty().trim().escape(),
    body('phone').trim().escape(),
    body('address_1').trim().escape(),
    body('address_2').trim().escape(),
    body('cipy').trim().escape(),
    body('state').trim().escape(),
    body('zipcode').trim().escape(),
    async (req, res) => {
    console.log("register - POST: ")

    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const attrs = {email: req.body.email, 
            password: hashedPassword,
            name: req.body.name,
            ssn: req.body.ssn,
            dob: req.body.dob,
            phone: req.body.phone_number,
            address_1: req.body.address_1,
            address_2: req.body.address_2,
            city: req.body.city,
            state: req.body.state,
            zipcode: req.body.zipcode
          }
        if (req.body.mode == "add") {
            await addUser(attrs);
        } else {
            const userId = req._passport.session.user
            await updateUser(userId, attrs);
        }
   
      res.redirect('/patient/logout')
    } catch (error) {
      console.error(error)
      res.redirect('/patient/register')
    }
})

router.post('/cancel', checkAuthenticated, async (req, res) => {
    console.debug("cancel - POST: ")

    const userId = req._passport.session.user
    const recId = req.body.rec_id
    console.debug("recId: " + recId)
    // const user = await findUserById(userId)
    await cancelPatientAppt(userId, recId)

    res.redirect('/patient/reservation')
})

router.post('/accept', checkAuthenticated, async (req, res) => {
    console.debug("accept - POST: ")

    const userId = req._passport.session.user
    const recId = req.body.rec_id
    console.debug("recId: " + recId)
    // const user = await findUserById(userId)
    await acceptPatientAppt(userId, recId)

    res.redirect('/patient/reservation')
})

router.post('/decline', checkAuthenticated, async (req, res) => {
    console.debug("decline - POST: ")

    const userId = req._passport.session.user
    const recId = req.body.rec_id
    console.debug("recId: " + recId)
    // const user = await findUserById(userId)
    await declinePatientAppt(userId, recId)

    res.redirect('/patient/reservation')
})
  
router.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/patient/login')
})

router.use((req, res, next) => {
    /*
    const err = new Error('API route not found   !!!')
    err.status = 404
    next(err)
    */
   console.error("got invalid path")
    res.redirect('/patient/login')
})
  
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/patient/login')
}
  
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/patient/reservation')
    }
    next()
}

module.exports = router