\COPY provider_type FROM 'provider_type.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY provider FROM 'provider.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY patient FROM 'patient.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY calendar_time FROM 'calendar_time.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY calendar_day FROM 'calendar_day.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY calendar_days FROM 'calendar_days.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY patient_appt_preference FROM 'patient_appt_preference.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY patient_login_info FROM 'patient_login_info.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY priority_group FROM 'priority_group.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY appointment_offer FROM 'appointment_offer.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY distance_by_zipcode FROM 'distance_by_zipcode.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY patient_group FROM 'patient_group.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY patient_appt_history FROM 'patient_appt_history.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY patient_appt_history FROM 'patient_appt_history.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;
\COPY provider_login_info FROM 'provider_login_info.csv' WITH DELIMITER ',' NULL 'null' CSV HEADER;

-- need to reset the sequence after data is loaded
select setval('provider_type_ptid_seq', (select max(ptid) from provider_type));
select setval('provider_pid_seq', (select max(pid) from provider));
select setval('patient_pid_seq', (select max(pid) from patient));
select setval('calendar_time_tid_seq', (select max(tid) from calendar_time));
select setval('calendar_day_did_seq', (select max(did) from calendar_day));
select setval('priority_group_gid_seq', (select max(gid) from priority_group));
select setval('appointment_offer_aid_seq', (select max(aid) from appointment_offer));
select setval('patient_appt_history_hid_seq', (select max(hid) from patient_appt_history));
