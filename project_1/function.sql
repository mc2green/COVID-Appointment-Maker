DROP FUNCTION insert_patient;

CREATE OR REPLACE FUNCTION insert_patient(_ssn varchar(10), _pname varchar(200), _dob timestamp, _phone varchar(20), _address_1 varchar(60), _address_2 varchar(60), _city VARCHAR(60), _state VARCHAR(2), _zip_code VARCHAR(5), _email VARCHAR(50))
RETURNS TABLE(new_id INT) AS
$BODY$
   DECLARE
      new_patient_id integer;
   BEGIN
     INSERT INTO patient(ssn, pname, dob, phone, address_1, address_2, city, state, zip_code, email)
     VALUES(_ssn, _pname, _dob, _phone, _address_1, _address_2, _city, _state, _zip_code, _email);
     select lastval() into new_patient_id;

     PERFORM insert_patient_group(new_patient_id, now());
     
     RETURN QUERY SELECT new_patient_id;

   END;
$BODY$
LANGUAGE 'plpgsql';

-- select * from patient where ssn = '0000000000';
-- select * from insert_patient('0000000000', 'dummy name', '2010-02-03', '6097161234', 'address 1', 'address 2', 'Newark', 'NJ', '12345', 'dummy@gmail.com');
-- select * from patient where ssn = '0000000000';

-- (2)
DROP FUNCTION insert_appointment;

CREATE OR REPLACE FUNCTION insert_appointment(_provider_name varchar(200), _appt_dt DATE, _cal_time_id int, _quota int)
RETURNS integer AS
$BODY$
   DECLARE
      new_appt_id integer;
   BEGIN
     INSERT INTO appointment_offer(pid, appt_date, cal_time_id, quota, available_quota)
     VALUES((select pid from provider where pname = _provider_name), _appt_dt, _cal_time_id, _quota, _quota);
     select lastval() into new_appt_id;
     RETURN new_appt_id;
   END;
$BODY$
LANGUAGE 'plpgsql' VOLATILE;

-- select * from appointment_offer where appt_date = '2021-06-15';
-- select * from insert_appointment('CVS Pharmacy', '2021-06-15', 1, 30);
-- select * from appointment_offer where appt_date = '2021-06-15';


-- (3)
DROP FUNCTION get_avail_appt_by_patient;

CREATE OR REPLACE FUNCTION get_avail_appt_by_patient(_current_ts TIMESTAMP WITH TIME ZONE, _patient_id int)
RETURNS TABLE(pid INT, pname varchar(200), appt_date DATE, from_time INT, to_time INT, distance INT, appt_id INT) AS
$func$
BEGIN
  RETURN QUERY
     SELECT p.pid, p.pname, ao.appt_date, ct.from_time, ct.to_time, dbz.distance, ao.aid as appt_id
     FROM patient pat
     INNER JOIN patient_group ON patient_group.pid = pat.pid
     INNER JOIN patient_appt_preference pap ON pap.pid = pat.pid
     INNER JOIN priority_group pg ON patient_group.priority_group_id = pg.gid
     INNER JOIN appointment_offer ao ON ao.available_quota > 0
     INNER JOIN provider p ON p.pid = ao.pid
     INNER JOIN calendar_time ct ON ct.tid = ao.cal_time_id
     inner join calendar_day cd ON cd.did = pap.preferred_day
     INNER JOIN calendar_days cds on cd.did = cds.did
     LEFT OUTER JOIN distance_by_zipcode dbz ON (pat.zip_code = dbz.zipcode_1 and p.zip_code = dbz.zipcode_2) or (pat.zip_code = dbz.zipcode_2 and p.zip_code = dbz.zipcode_1)
     WHERE pat.pid = _patient_id
       AND pap.preferred_time = ao.cal_time_id
       AND pg.eligible_date <= _current_ts
       AND ao.appt_date >= _current_ts
       AND ao.appt_date <= _current_ts + INTERVAL '7 day'
       AND extract(dow from ao.appt_date) = cds.day_of_week
       AND pap.max_distance >= COALESCE(dbz.distance, 10000)
     group by p.pid, p.pname, ao.appt_date, pap.preferred_time, ct.from_time, ct.to_time, dbz.distance, ao.aid
     order by dbz.distance asc;
END
$func$ LANGUAGE plpgsql;

-- select * from get_avail_appt_by_patient('2021-04-03 12:45:01'::timestamp AT TIME ZONE 'EST', 14);

-- (4)
DROP FUNCTION get_pri_grp_appt_summary;

CREATE OR REPLACE FUNCTION get_pri_grp_appt_summary()
RETURNS TABLE(priority_group_id INT, priority_group_name varchar(200), num_of_vaccinated BIGINT, num_of_scheduled BIGINT, num_of_waiting BIGINT) AS
$func$
BEGIN
  RETURN QUERY
    with curr_status as (
	select p.hid, p.pid, p.aid, p.status, p.show_up, p.vaccinated, p.added_ts
	from patient_appt_history p
	where added_ts = (select max(added_ts) from patient_appt_history p2 where p2.pid = p.pid)
    )
    select pr_g.gid, pr_g.gname, sum(CASE WHEN pap.vaccinated = 'Y' then 1 else 0 end) as "vaccinated",
           sum(CASE WHEN pap.vaccinated is NULL and pap.show_up is NULL and pap.status = 'accepted' then 1 else 0 end) as "scheduled",
	   sum(CASE WHEN pg.pid IS NOT NULL and pap.vaccinated is NULL and not (pap.show_up is NOT NULL and pap.show_up = 'Y' and pap.status = 'accepted') then 1 else 0 end) as "waiting"
    from priority_group pr_g
    LEFT OUTER JOIN patient_group pg ON pr_g.gid = pg.priority_group_id
    LEFT OUTER JOIN patient p ON pg.pid = p.pid
    LEFT OUTER JOIN curr_status pap ON p.pid = pap.pid
    group by pr_g.gid, pr_g.gname
    order by pr_g.gid;
END
$func$ LANGUAGE plpgsql;

-- select * from get_pri_grp_appt_summary();


-- (5)
DROP FUNCTION get_patient_eligible_date;

CREATE OR REPLACE FUNCTION get_patient_eligible_date()
RETURNS TABLE(id INT, name varchar(200), eligible_date DATE) AS
$func$
BEGIN
  RETURN QUERY
    select p.pid, p.pname, pri_g.eligible_date
    from patient p
    LEFT OUTER JOIN patient_group pat_g ON p.pid = pat_g.pid
    LEFT OUTER JOIN priority_group pri_g ON pat_g.priority_group_id = pri_g.gid;
END
$func$ LANGUAGE plpgsql;

-- select * from get_patient_eligible_date();

-- (6)
DROP FUNCTION get_patient_appt_summary;

CREATE OR REPLACE FUNCTION get_patient_appt_summary()
RETURNS TABLE(id INT, name varchar(200), cancelled_out BIGINT, no_showup_count BIGINT) AS
$func$
BEGIN
  RETURN QUERY
    WITH tmp AS (
      SELECT pid, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS "cancelled_count",
      	     sum(CASE WHEN status = 'accepted' and (show_up is NULL or show_up != 'Y') THEN 1 ELSE 0 END) AS "no_showup_count"
      FROM patient_appt_history
      GROUP BY pid
    )
    SELECT pat.pid, pat.pname, tmp.cancelled_count, tmp.no_showup_count
    FROM patient pat
    INNER JOIN tmp ON pat.pid = tmp.pid
    WHERE (tmp.cancelled_count >= 3) OR (tmp.no_showup_count >= 2);
END
$func$ LANGUAGE plpgsql;

-- select * from get_patient_appt_summary();


-- (7)
DROP FUNCTION get_provider_with_max_vac;

CREATE OR REPLACE FUNCTION get_provider_with_max_vac()
RETURNS TABLE(id INT, name varchar(200), max_vac_count BIGINT) AS
$func$
BEGIN
  RETURN QUERY
    select p.pid, p.pname, count(*) as max_vac_count
    from provider p
    inner join appointment_offer ao ON ao.pid = p.pid
    inner join patient_appt_history pah ON pah.aid = ao.aid
    where pah.vaccinated = 'Y'
    group by p.pid, p.pname
    order by 3 desc
    limit 1;
END
$func$ LANGUAGE plpgsql;

-- select * from get_provider_with_max_vac();

----
---- ***** new added fucntion due to part 2 (web)
----

DROP FUNCTION get_patient_appt_preference;

CREATE OR REPLACE FUNCTION get_patient_appt_preference(_pid INT)
RETURNS TABLE(id INT, pref_day_id INT, pref_day_desc VARCHAR(20), pref_time_id INT, pref_from_time INT, pref_to_time INT, max_distance INT )AS
$func$
BEGIN
  RETURN QUERY
    select pap.pid as id, preferred_day as pref_day_id, cd.description as pref_day_desc,
           preferred_time as pref_time_id, ct.from_time as pref_from_time,
	   ct.to_time as pref_to_time, pap.max_distance
    from patient_appt_preference pap
    inner join calendar_day cd ON cd.did = pap.preferred_day
    inner join calendar_time ct ON ct.tid = pap.preferred_time
    where pap.pid = _pid;
END
$func$ LANGUAGE plpgsql;

-- testing
-- select * from get_patient_appt_preference(1);
---

DROP FUNCTION insert_patient_group;

CREATE OR REPLACE FUNCTION insert_patient_group(_pid INT, _curr_time TIMESTAMP with TIME ZONE)
RETURNS TABLE(rowcount INT) AS
$BODY$
   BEGIN
       insert into patient_group(pid, priority_group_id)
       select p.pid, pg.gid
         from patient p
	 inner join priority_group pg ON EXTRACT(YEAR FROM _curr_time) - EXTRACT(YEAR FROM p.dob) >= pg.from_age and
   	                                 EXTRACT(YEAR FROM _curr_time) - EXTRACT(YEAR FROM p.dob) < pg.to_age
        where p.pid = _pid;

     RETURN QUERY SELECT 1;
   EXCEPTION WHEN OTHERS THEN
     RETURN QUERY SELECT 0;
   END;
$BODY$
LANGUAGE 'plpgsql';

--- testing
--- select * from insert_patient_group(28, now());
---

DROP FUNCTION update_patient_group;

CREATE OR REPLACE FUNCTION update_patient_group(_pid INT, _curr_time TIMESTAMP with TIME ZONE)
RETURNS TABLE(rowcount INT) AS
$BODY$
   BEGIN
       delete from patient_group where pid = _pid;
       
       insert into patient_group(pid, priority_group_id)
       select p.pid, pg.gid
         from patient p
	 inner join priority_group pg ON EXTRACT(YEAR FROM _curr_time) - EXTRACT(YEAR FROM p.dob) >= pg.from_age and
   	                                 EXTRACT(YEAR FROM _curr_time) - EXTRACT(YEAR FROM p.dob) < pg.to_age
        where p.pid = _pid;

     RETURN QUERY SELECT 1;
   EXCEPTION WHEN OTHERS THEN
     RETURN QUERY SELECT 0;
   END;
$BODY$
LANGUAGE 'plpgsql';

--- testing
--- select * from update_patient_group(28, now());
---


DROP FUNCTION update_patient;

CREATE OR REPLACE FUNCTION update_patient(_pid INT, _ssn varchar(10), _pname varchar(200), _dob timestamp, _phone varchar(20), _address_1 varchar(60), _address_2 varchar(60), _city VARCHAR(60), _state VARCHAR(2), _zip_code VARCHAR(5), _email VARCHAR(50))
RETURNS TABLE(rowcount INT) AS
$BODY$
   BEGIN
     UPDATE patient set ssn=_ssn, pname = _pname, dob=_dob, phone=_phone, address_1=_address_1,
                        address_2=_address_2, city=_city, state=_state, zip_code=_zip_code,
			email=_email
     WHERE pid=_pid;

     PERFORM update_patient_group(_pid, now());

     RETURN QUERY SELECT 1;
   END;
$BODY$
LANGUAGE 'plpgsql';


-------
DROP FUNCTION get_patient_appt;

CREATE OR REPLACE FUNCTION get_patient_appt(_pid INT)
RETURNS TABLE(hid INT, pid INT, aid INT, appt_date DATE, appt_from_time int, appt_to_time int , status VARCHAR(10), show_up varchar(1), vaccinated varchar(1), added_ts timestamp, provider_name VARCHAR(200), provider_phone VARCHAR(20), provider_address_1 VARCHAR(60), provider_address_2 VARCHAR(60), provider_city VARCHAR(60), provider_state VARCHAR(2), provider_zip_code VARCHAR(5) ) AS
$func$
BEGIN
  RETURN QUERY
    select p.hid, p.pid, p.aid, ao.appt_date, ct.from_time, ct.to_time,
           p.status, p.show_up, p.vaccinated, p.added_ts, provider.pname,
           provider.phone, provider.address_1, provider.address_2, provider.city, provider.state,
	   provider.zip_code
    from patient_appt_history p
    inner join appointment_offer ao ON p.aid = ao.aid
    inner join calendar_time ct ON ct.tid = ao.cal_time_id
    inner join provider provider ON provider.pid = ao.pid
    where p.pid = _pid
      -- and p.status != 'cancelled'
    order by added_ts desc limit 1;
END
$func$ LANGUAGE plpgsql;

-- testing
-- select * from get_patient_appt(1);
-- select * from get_patient_appt(3);
--

-----
DROP FUNCTION get_patient_eligible_group_date;

CREATE OR REPLACE FUNCTION get_patient_eligible_group_date(_pid INT)
RETURNS TABLE(id INT, group_name varchar(200), eligible_date DATE) AS
$func$
BEGIN
  RETURN QUERY
    select p.pid, pri_g.gname, pri_g.eligible_date
    from patient p
    LEFT OUTER JOIN patient_group pat_g ON p.pid = pat_g.pid
    LEFT OUTER JOIN priority_group pri_g ON pat_g.priority_group_id = pri_g.gid
    WHERE p.pid = _pid;
END
$func$ LANGUAGE plpgsql;

-- testing
-- select * from get_patient_eligible_group_date(33);
--

--------

DROP FUNCTION reserve_patient_appt;

CREATE OR REPLACE FUNCTION reserve_patient_appt(_pid INT, _appt_id INT)
RETURNS TABLE(record_id INT) AS
$func$
DECLARE
      new_id integer;
BEGIN
  insert into patient_appt_history(pid, aid, status, added_ts) values(_pid, _appt_id, 'accepted', now());
  select lastval() into new_id;

  update appointment_offer set available_quota = available_quota - 1 where aid = _appt_id;

  RETURN QUERY SELECT new_id;
END
$func$ LANGUAGE plpgsql;

--------

DROP FUNCTION cancel_patient_appt;

CREATE OR REPLACE FUNCTION cancel_patient_appt(_pid INT, _rec_id INT)
RETURNS TABLE(rowcount INT) AS
$func$
BEGIN
  update patient_appt_history
  set status = 'cancelled'
  where pid = _pid
    and hid = _rec_id
    and status = 'accepted';

  update appointment_offer
  set available_quota = available_quota + 1
  where aid = (select aid from patient_appt_history where hid=_rec_id);

  RETURN QUERY SELECT 1;
END
$func$ LANGUAGE plpgsql;


--------

DROP FUNCTION accept_patient_appt;

CREATE OR REPLACE FUNCTION accept_patient_appt(_pid INT, _rec_id INT)
RETURNS TABLE(rowcount INT) AS
$func$
BEGIN
  update patient_appt_history
  set status = 'accepted'
  where pid = _pid
    and hid = _rec_id
    and status = 'pending';

  RETURN QUERY SELECT 1;
END
$func$ LANGUAGE plpgsql;

--------

DROP FUNCTION decline_patient_appt;

CREATE OR REPLACE FUNCTION decline_patient_appt(_pid INT, _rec_id INT)
RETURNS TABLE(rowcount INT) AS
$func$
BEGIN
  update patient_appt_history
  set status = 'declined'
  where pid = _pid
    and hid = _rec_id
    and status = 'pending';

  update appointment_offer
  set available_quota = available_quota + 1
  where aid = (select aid from patient_appt_history where hid=_rec_id);

  RETURN QUERY SELECT 1;
END
$func$ LANGUAGE plpgsql;

------

DROP FUNCTION insert_provider;

CREATE OR REPLACE FUNCTION insert_provider(_pname varchar(200), _type INT, _phone varchar(20), _address_1 varchar(60), _address_2 varchar(60), _city VARCHAR(60), _state VARCHAR(2), _zip_code VARCHAR(5))
RETURNS TABLE(new_id INT) AS
$BODY$
   DECLARE
      new_provider_id integer;
   BEGIN
     INSERT INTO provider(pname, provider_type_id, phone, address_1, address_2, city, state, zip_code)
     VALUES(_pname, _type, _phone, _address_1, _address_2, _city, _state, _zip_code);
     select lastval() into new_provider_id;

     RETURN QUERY SELECT new_provider_id;
   END;
$BODY$
LANGUAGE 'plpgsql';

---------

DROP FUNCTION update_provider;

CREATE OR REPLACE FUNCTION update_provider(_pid INT, _pname varchar(200), _type INT, _phone varchar(20), _address_1 varchar(60), _address_2 varchar(60), _city VARCHAR(60), _state VARCHAR(2), _zip_code VARCHAR(5))
RETURNS TABLE(rowcount INT) AS
$BODY$
   BEGIN
     UPDATE provider set pname = _pname, provider_type_id=_type, phone=_phone, address_1=_address_1,
                        address_2=_address_2, city=_city, state=_state, zip_code=_zip_code
     WHERE pid=_pid;

     RETURN QUERY SELECT 1;
   END;
$BODY$
LANGUAGE 'plpgsql';

---------

DROP FUNCTION get_provider_appt_summary;

CREATE OR REPLACE FUNCTION get_provider_appt_summary(_pid INT, _fromDate DATE, _toDate DATE)
RETURNS TABLE(ao_id INT, appt_date DATE, from_time INT, to_time INT, quota INT, available_quota INT,
              accepted_count BIGINT, cancelled_count BIGINT, no_showup_count BIGINT, pending_count BIGINT,
	      vaccinated_count BIGINT) AS
$BODY$
BEGIN
  RETURN QUERY
    select ao.aid, ao.appt_date, ct.from_time, ct.to_time, ao.quota, ao.available_quota,
           sum(case when pah.status = 'accepted' then 1 else 0 end) as accepted_count,
	   sum(case when pah.status = 'cancelled' then 1 else 0 end) as cancelled_count,
       	   sum(case when pah.status = 'accepted' and (pah.show_up is NULL or pah.show_up != 'Y') then 1 else 0 end) as no_showup_count,
       	   sum(case when pah.status = 'pending' then 1 else 0 end) as pending_count,
       	   sum(case when pah.vaccinated = 'Y' then 1 else 0 end) as vaccinated_count
     from appointment_offer ao
     inner join provider p ON ao.pid = p.pid
     inner join calendar_time ct ON ct.tid = ao.cal_time_id
     left outer join patient_appt_history pah ON ao.aid = pah.aid
     where p.pid = _pid
       -- and (ao.appt_date <= now() + interval '7 days' and ao.appt_date >= now() - interval '7 days')
       and ao.appt_date >= _fromDate and ao.appt_date <= _toDate
     group by ao.aid, ao.appt_date, ct.from_time, ct.to_time, ao.quota, ao.available_quota
     order by ao.appt_date desc, ct.from_time asc;
END;
$BODY$
LANGUAGE 'plpgsql';

-- testing
-- select * from get_provider_appt_summary(1);


---- added on 5/12/21

DROP FUNCTION get_patient_no_history;

CREATE OR REPLACE FUNCTION get_patient_no_history(_gid INT) -- priority group id
RETURNS TABLE(priority_gid INT, pid INT, pname VARCHAR(200)) AS
$BODY$
BEGIN
  RETURN QUERY
    with tmp as (  
      select p1.pid, p1.aid  
      from patient_appt_history p1  
      where p1.added_ts = (select max(added_ts) from patient_appt_history p2 where p1.pid = p2.pid)  
    )  
    select pg.priority_group_id, p.pid, p.pname
    from patient p  
    inner join patient_group pg ON p.pid = pg.pid  
    left outer join tmp ON p.pid = tmp.pid  
    where pg.priority_group_id = _gid
    and tmp.aid is null;
END;
$BODY$
LANGUAGE 'plpgsql';

-- testing
-- select * from get_patient_no_history(1);
-- select * from get_patient_no_history(2);
--

---- added on 5/15/21

DROP FUNCTION get_patient_by_appt;

CREATE OR REPLACE FUNCTION get_patient_by_appt(_aid INT) -- appt id
RETURNS TABLE(pid INT, pname VARCHAR(200), status VARCHAR(10), hid INT, show_up VARCHAR(1),
              vaccinated VARCHAR(1), added_ts TIMESTAMP) AS
$BODY$
BEGIN
  RETURN QUERY
    select p.pid, p.pname, pah.status, pah.hid, pah.show_up, pah.vaccinated, pah.added_ts
    from patient_appt_history pah
    inner join patient p ON p.pid = pah.pid
    where pah.aid = _aid;
END;
$BODY$
LANGUAGE 'plpgsql';

-- testing
-- select * from get_patient_by_appt(695);

DROP FUNCTION get_appt_info;

CREATE OR REPLACE FUNCTION get_appt_info(_aid INT) -- appt id
RETURNS TABLE(appt_date DATE, from_time INT, to_time INT) AS
$BODY$
BEGIN
  RETURN QUERY
    select ao.appt_date, ct.from_time, ct.to_time
    from appointment_offer ao
    inner join calendar_time ct ON ao.cal_time_id = ct.tid
    where ao.aid = _aid;
END;
$BODY$
LANGUAGE 'plpgsql';

-- test
-- select * from get_appt_info(653);



DROP FUNCTION set_patient_appt_status;

CREATE OR REPLACE FUNCTION set_patient_appt_status(_hid INT, _showup_status VARCHAR(1), _vacc_status VARCHAR(1))
RETURNS TABLE(rowcount INT) AS
$BODY$
   BEGIN
     UPDATE patient_appt_history set show_up = _showup_status, vaccinated = _vacc_status
     WHERE hid = _hid;

     RETURN QUERY SELECT 1;
   END;
$BODY$
LANGUAGE 'plpgsql';
