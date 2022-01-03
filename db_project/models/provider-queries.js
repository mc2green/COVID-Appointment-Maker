dbpool = require("../config/db.config")

async function findProviderByName(login_name) {
    try {
        const results = await dbpool.query('SELECT pli.pid as id, pli.password, pli.user_name FROM provider_login_info pli WHERE pli.user_name = $1', [login_name]);
        if (results.rows.length > 0)
          console.log('findProviderByName result: ' + results.rows[0].pid);
        return results.rows.length == 1 ? results.rows[0] : null;
    } catch (err) {
        console.log(err.stack);
        throw err;
    } finally {
        // client.close();
    }
}

async function findProviderById(pid) {
  const id = parseInt(pid)
  console.info("id: " + id);

  const results = await dbpool.query('SELECT pli.pid as id, pli.user_name, pli.password FROM provider_login_info pli WHERE pli.pid = $1', [id])

  return results.rows[0]
}

async function getProviderType() {
  try {
    const results = await dbpool.query("select ptid as id, ptname as name from provider_type");
    return results.rows;
  } catch (err) {
    console.log(err.stack);
    throw err;
  } finally {
      // client.close();
  }
}

async function addProvider(attrs) {
  try {
    console.log("in addProvider:")
    console.dir(attrs)
    const results = await dbpool.query("select * from insert_provider($1, $2, $3, $4, $5, $6, $7, $8)",
        [attrs.name, attrs.providerTypeId, attrs.phone, attrs.address_1, attrs.address_2,
         attrs.city, attrs.state, attrs.zipcode]
    );
    const newUserId = results.rows[0].new_id
    const results2 = await dbpool.query('insert into provider_login_info(pid, user_name, password) values ($1, $2, $3)', 
        [newUserId, attrs.loginName, attrs.password]);

    return newUserId
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function updateProvider(pid, attrs) {
  try {
    console.log("in updateProvider: pid=" + pid)
    console.dir(attrs)
    const results = await dbpool.query("select * from update_provider($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [pid, attrs.name, attrs.providerTypeId, attrs.phone, attrs.address_1, attrs.address_2,
         attrs.city, attrs.state, attrs.zipcode]
    );

    await dbpool.query('update provider_login_info set password = $2 where pid = $1', 
        [pid, attrs.password]);

    return pid
  } catch (err) {
      console.log(err.stack);
      throw err;
  } finally {
      // client.close();
  }
}

async function getProviderInfo(pid) {
  try {
    const results = await dbpool.query("select pid, pname as name, provider_type_id, " + 
          "phone, address_1, address_2, city, state, zip_code from provider " +
          "where pid = $1", [pid]);
    return results.rows.length > 0 ? results.rows[0] : null
  } catch (err) {
    console.log(err.stack);
    throw err;
  } finally {
      // client.close();
  }
}

async function getProviderApptSummary(pid, fromDate, toDate) {
  try {
    const results = await dbpool.query("select ao_id, appt_date, from_time, " + 
          "to_time, quota, available_quota, accepted_count, cancelled_count, " +
          "no_showup_count, pending_count, vaccinated_count " +
          "from get_provider_appt_summary($1, $2, $3)", 
         [pid, fromDate, toDate]);
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
    console.log(err.stack);
    throw err;
  } finally {
      // client.close();
  }
}

async function getPatientByApptId(apptId) {
  try {
    const results = await dbpool.query("select pid, pname as name, status, hid, show_up, vaccinated, added_ts " +
          "from get_patient_by_appt($1)", 
         [apptId]);
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
    console.log(err.stack);
    throw err;
  } finally {
      // client.close();
  }
}

async function getApptInfo(apptId) {
  try {
    const results = await dbpool.query("select appt_date, from_time, to_time " +
          "from get_appt_info($1)", 
         [apptId]);
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
    console.log(err.stack);
    throw err;
  } finally {
      // client.close();
  }
}

async function setPatientApptStatus(apptHistId, showupStatus, vaccinatedStatus) {
  try {
    const results = await dbpool.query("select * " +
          "from set_patient_appt_status($1, $2, $3)", 
         [apptHistId, showupStatus, vaccinatedStatus]);
    return results.rows.length > 0 ? results.rows : []
  } catch (err) {
    console.log(err.stack);
    throw err;
  } finally {
      // client.close();
  }
}

module.exports = {
  findProviderById,
  findProviderByName,
  addProvider,
  updateProvider,
  getProviderType,
  getProviderInfo,
  getProviderApptSummary,
  getPatientByApptId,
  getApptInfo,
  setPatientApptStatus
}