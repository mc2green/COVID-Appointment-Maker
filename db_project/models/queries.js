dbpool = require("../config/db.config")

async function findUserByEmail(email) {
    try {
        const results = await dbpool.query('SELECT pli.pid as id, pli.password, p.pname as name FROM patient_login_info pli, patient p WHERE pli.user_name = $1 and pli.pid = p.pid', [email]);
        if (results.rows.length > 0)
          console.log('result: ' + results.rows[0].pid);
        return results.rows.length == 1 ? results.rows[0] : null;
    } catch (err) {
        console.log(err.stack);
        throw err;
    } finally {
        // client.close();
    }
}

async function findUserById(pid) {
  const id = parseInt(pid)
  console.info("id: " + id);

  const results = await dbpool.query('SELECT pli.pid as id, pli.user_name as email, pli.password, p.pname as name FROM patient_login_info pli, patient p WHERE pli.pid = $1 and pli.pid = p.pid', [id])

  return results.rows[0]
}

async function addUser(attrs) {
  try {
    // const results = dbpool.query('insert into patient_login_info(pid, user_name, password) values (1, $1, $2)', [email, password]);
    // console.log('insert patient_login_info: ' + email + ", " + password);
    console.dir(attrs)
    const results = await dbpool.query("select * from insert_patient($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [attrs.ssn, attrs.name, attrs.dob, attrs.phone, attrs.address_1, attrs.address_2,
         attrs.city, attrs.state, attrs.zipcode, attrs.email]
    );
    const newUserId = results.rows[0].new_id
    const results2 = await dbpool.query('insert into patient_login_info(pid, user_name, password) values ($1, $2, $3)', 
        [newUserId, attrs.email, attrs.password]);

    return newUserId
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function updateUser(pid, attrs) {
  try {
    console.log("in updateUser: pid=" + pid)
    console.dir(attrs)
    const results = await dbpool.query("select * from update_patient($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        [pid, attrs.ssn, attrs.name, attrs.dob, attrs.phone, attrs.address_1, attrs.address_2,
         attrs.city, attrs.state, attrs.zipcode, attrs.email]
    );
    // const newUserId = results.rows[0].new_id
    const results2 = await dbpool.query('update patient_login_info set password=$2 where pid = $1', 
        [pid, attrs.password]);

    return pid
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function addApptPreference(attrs) {
  try {
    // const results = dbpool.query('insert into patient_login_info(pid, user_name, password) values (1, $1, $2)', [email, password]);
    // console.log('insert patient_login_info: ' + email + ", " + password);
    console.dir(attrs)
    const results = await dbpool.query("insert into patient_appt_preference(pid, preferred_day, preferred_time, max_distance) values ($1, $2, $3, $4)",
        [attrs.id, parseInt(attrs.preferredDay), parseInt(attrs.preferredTime), parseInt(attrs.maxDistance)]
    )

    return results
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function updateApptPreference(attrs) {
  try {
    // const results = dbpool.query('insert into patient_login_info(pid, user_name, password) values (1, $1, $2)', [email, password]);
    // console.log('insert patient_login_info: ' + email + ", " + password);
    console.dir(attrs)
    const results = await dbpool.query("update patient_appt_preference set preferred_day=$2, preferred_time=$3, max_distance=$4 where pid = $1",
        [attrs.id, parseInt(attrs.preferredDay), parseInt(attrs.preferredTime), parseInt(attrs.maxDistance)]
    )

    return results
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getApptPreference(pid) {
  try {
    // console.dir(pid)
    const results = await dbpool.query("select id, pref_day_id, pref_day_desc, pref_time_id, pref_from_time, pref_to_time, max_distance from get_patient_appt_preference($1)",
        [pid]
    );
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getAvailableAppointments(pid) {
  try {
    // console.dir(pid)
    const results = await dbpool.query("select pid as id, pname as name, appt_date, from_time, to_time, distance, appt_id from get_avail_appt_by_patient(now(), $1)",
        [pid]
    );
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getCalendarDay() {
  try {
    // console.dir(pid)
    const results = await dbpool.query("select did as id, description from calendar_day");
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getCalendarTime() {
  try {
    // console.dir(pid)
    const results = await dbpool.query("select tid as id, from_time, to_time from calendar_time");
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getPatientInfo(pid) {
  try {
    const results = await dbpool.query("select pid as id, ssn, pname as name, dob, phone, address_1, address_2, city, state, zip_code, email from patient where pid = $1", [pid]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getPatientAppt(pid) {
  try {
    const results = await dbpool.query("select hid, pid, aid, appt_date, appt_from_time, " +
         "appt_to_time, status, show_up, vaccinated, added_ts, provider_name, " +
         "provider_phone, provider_address_1, provider_address_2, provider_city, " +
         "provider_state, provider_zip_code from get_patient_appt($1)", [pid]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function cancelPatientAppt(pid, apptId) {
  try {
    const results = await dbpool.query("select * from cancel_patient_appt($1, $2)", [pid, apptId]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function acceptPatientAppt(pid, apptId) {
  try {
    const results = await dbpool.query("select * from accept_patient_appt($1, $2)", [pid, apptId]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function declinePatientAppt(pid, apptId) {
  try {
    const results = await dbpool.query("select * from decline_patient_appt($1, $2)", [pid, apptId]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getPateintEligibleGroupDate(pid) {
  try {
    const results = await dbpool.query("select id, group_name, eligible_date from get_patient_eligible_group_date($1)", [pid]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function reserveAppt(pid, apptId) {
  try {
    const results = await dbpool.query("select * from reserve_patient_appt($1, $2)", [pid, apptId]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

module.exports = {
  findUserById,
  findUserByEmail,
  addUser,
  updateUser,
  addApptPreference,
  getApptPreference,
  updateApptPreference,
  getCalendarDay,
  getCalendarTime,
  getAvailableAppointments,
  getPatientInfo,
  getPatientAppt,
  getPateintEligibleGroupDate,
  reserveAppt,
  cancelPatientAppt,
  acceptPatientAppt,
  declinePatientAppt
}