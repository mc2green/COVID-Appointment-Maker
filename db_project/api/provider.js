const router = require('express').Router()
const bcrypt = require('bcrypt')
const { body, validationResult } = require('express-validator');

const {addProvider, updateProvider, getProviderType, getProviderInfo,
    getProviderApptSummary, getPatientByApptId, getApptInfo, setPatientApptStatus
    } = require('../models/provider-queries')

const session = require('express-session')
const Passport = require('passport').Passport
const passport = new Passport()
const {findProviderByName, findProviderById} = require('../models/provider-queries')


const initializePassport = require('../passport-config-provider')
initializePassport(
  passport,
  findProviderByName,
  findProviderById
)
router.use(session({
    secret: process.env.SESSION_SECRET + "_provider",
    resave: true,
    saveUninitialized: false
  }))
router.use(passport.initialize())
router.use(passport.session())

router.get('/', checkAuthenticated, async (req, res) => {
    console.info("session.user:");
    console.dir(req);
    const providerId = req._passport.session.user;
    // res.cookie('cookieName', userId, { expires: new Date(Date.now() + 900000), httpOnly: true })
    
    var provider = await findProviderById(providerId)
    console.log("in get - provider: ")
    console.dir(provider)
    res.render('provider/index.ejs', { login_name: provider.login_name })
})

router.get('/login', /* checkNotAuthenticated, */ async (req, res) => {
    const providerId = req.cookies['provider_cn']
    console.debug("providerId from cookie: " + providerId)
    var provider = {}
    if (providerId) {
        provider = await findProviderById(providerId)
    }
    res.render('provider/login.ejs', {login_name: provider.login_name})
})

router.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/provider/dashboard',
    failureRedirect: '/provider/login',
    failureFlash: true
}),
    (req, res) => {
        const providerId = req._passport.session.user;
        // res.cookie('provider_cn', providerId, { expires: new Date(Date.now() + 900000), httpOnly: true })
    })

router.get('/register', /* checkNotAuthenticated, */ async (req, res) => {
    console.debug("register: edit flag: " + req.query.edit)

    // const userId = req._passport.session.user
    const editMode = req.query.edit !== undefined ? "edit" : "add"
    
    var provider = {} // await getPatientInfo(userId)
    var loginInfo = {}
    if (editMode == "edit") {
        if (req._passport.session) {
            const providerId = req._passport.session.user;
            provider = await getProviderInfo(providerId)
            loginInfo = await findProviderById(providerId)
            console.dir(loginInfo)
            // provider.login_name = loginInfo.login_name
            // provider.password = loginInfo.password
        } else {
            res.redirect("/provider/login")
        }
    }
    const providerTypes = await getProviderType()
    res.render('provider/register.ejs', {
        mode: editMode,
        login_name: loginInfo.user_name,
        password: loginInfo.password,
        name: provider.name,
        providerTypeId: provider.provider_type_id,
        phone: provider.phone,
        address_1: provider.address_1,
        address_2: provider.address_2,
        city: provider.city,
        state: provider.state,
        zipcode: provider.zip_code,
        providerTypes: providerTypes
    })
  })
  
router.post('/register', /* checkNotAuthenticated, */ 
    body('login_name').notEmpty().trim().escape(),
    body('name').notEmpty().trim().escape(),
    body('phone_number').notEmpty().trim().escape(),
    body('address_1').notEmpty().trim().escape(),
    body('address_2').trim().escape(),
    body('city').trim().escape(),
    body('state').trim().escape(),
    body('zipcode').trim().escape(),
    body('provider_type_id').notEmpty().trim().escape().isInt(),
    async (req, res) => {
    console.log("provider register - POST: ")

    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        const attrs = {loginName: req.body.login_name, 
            password: hashedPassword,
            name: req.body.name,
            phone: req.body.phone_number,
            address_1: req.body.address_1,
            address_2: req.body.address_2,
            city: req.body.city,
            state: req.body.state,
            zipcode: req.body.zipcode,
            providerTypeId: req.body.provider_type_id
          }
        if (req.body.mode == "add") {
            await addProvider(attrs);
        } else {
            const providerId = req._passport.session.user
            await updateProvider(providerId, attrs);
        }
   
      res.redirect('/provider/logout')
    } catch (error) {
      console.error(error)
      res.redirect('/provider/register')
    }
})

router.get('/dashboard', 
    checkAuthenticated,
    body("from_date").escape().isDate(),
    body("to_date").escape().isDate(),
    async (req, res) => {
    console.log("dashboard - GET:")
    console.info("session.user:");
    // console.dir(req);

    const providerId = req._passport.session.user;
    console.log("dashboard providerId: " + providerId)
    // res.cookie('provider_cn', providerId, { expires: new Date(Date.now() + 900000), httpOnly: true })
    
    console.log("from_date: " + req.query.from_date)
    const now = new Date()
    var fromDate;
    if (req.query.from_date !== undefined) {
        fromDate = req.query.from_date
    } else {
        const fromDateObj = new Date(now)
        fromDateObj.setDate(now.getDate() - 7)
        fromDate = fromDateObj.toISOString().slice(0, 10)
    }

    var toDate;
    if (req.query.to_date !== undefined) {
        toDate = req.query.to_date
    } else {
        const toDateObj = new Date(now)
        toDateObj.setDate(now.getDate() + 3)
        toDate = toDateObj.toISOString().slice(0, 10)
    }
    
    const currDate = now.toISOString().slice(0, 10)

    console.debug("fromDate: " + fromDate)
    console.debug("toDate: " + toDate)

    const provider = await getProviderInfo(providerId)
    const summary = await getProviderApptSummary(providerId, fromDate, toDate)
    
    res.render('provider/dashboard.ejs', { name: provider.name,
        summary: summary,
        currDate: currDate,
        fromDate: fromDate,
        toDate: toDate
        })
})

router.post('/dashboard', 
    checkAuthenticated, 
    body('fromDate').trim().isDate().escape(),
    body('toDate').notEmpty().isDate().escape(),
    async (req, res) => {
        console.log("dashboard - POST:")
        const providerId = req._passport.session.user;

        const now = new Date()
        const currDate = now.toISOString().slice(0, 10)
        const fromDate = req.body.fromDate // .toISOString().slice(0, 10)
        const toDate = req.body.toDate // .toISOString().slice(0, 10)
        console.debug("fromDate: " + fromDate)
        console.debug("toDate: " + toDate)

        const provider = await getProviderInfo(providerId)
        const summary = await getProviderApptSummary(providerId, fromDate, toDate)
        
        res.render('provider/dashboard.ejs', { name: provider.name,
            summary: summary,
            currDate: currDate,
            fromDate: fromDate,
            toDate: toDate
            })
})

router.get('/view_patient', 
  checkAuthenticated,
  body('ao_id').notEmpty().isInt(),
  body('from_date').trim().isDate().escape(),
  body('to_date').trim().isDate().escape(),
  async (req, res) => {
    console.log("view_patient - GET:")

    const providerId = req._passport.session.user;

    const provider = await getProviderInfo(providerId)
    const ao_id = req.query.ao_id
    console.debug("ao_id: " + ao_id)
    console.debug("from_date: " + req.query.from_date)
    console.debug("to_date: " + req.query.to_date)
    
    const patients = await getPatientByApptId(ao_id)
    const apptInfo = await getApptInfo(ao_id)
    console.debug("apptInfo: ")
    console.dir(apptInfo)
    
    res.render('provider/view_patient.ejs', { name: provider.name,
        provider: provider,
        patients: patients,
        apptInfo: apptInfo[0],
        ao_id: ao_id,
        fromDate: req.query.from_date,
        toDate: req.query.to_date
    })
})

router.post('/set_patient_status', 
    checkAuthenticated, 
    body('appt_hist_id').notEmpty().isInt(),
    body('show_up').notEmpty().escape(),
    body('vaccinated').notEmpty().escape(),
    async (req, res) => {
        console.log("set_patient_status - POST:")
        const appt_hist_id = parseInt(req.body.appt_hist_id)
        console.debug("appt_hist_id:" + appt_hist_id)
        console.debug("show_up:" + req.body.show_up)
        console.debug("vaccinated:" + req.body.vaccinated)

        const providerId = req._passport.session.user;

        const provider = await setPatientApptStatus(appt_hist_id, req.body.show_up, req.body.vaccinated)
})



router.get('/test', (req, res) => {
    
    res.render('provider/test.ejs', {})
})

router.delete('/logout', (req, res) => {
    console.debug("logout is called")
    // req.clearCookie('provider_cn', {path: 'provider'})
    req.logOut()
    res.redirect('/provider/login')
})

router.use((req, res, next) => {
   console.error("got invalid path")
    res.redirect('/provider/login')
})
  
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/provider/login')
}
  
function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/provider/dashboard')
    }
    next()
}

module.exports = router
