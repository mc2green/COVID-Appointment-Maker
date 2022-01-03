-- CREATE DATABASE project_1

CREATE TABLE provider_type (
  ptid SERIAL PRIMARY KEY,
  ptname varchar(40) NOT NULL -- hospital, doctor office,  pharmacy,  school, ...
);

CREATE TABLE provider (
  pid SERIAL PRIMARY KEY,
  pname VARCHAR(200) NOT NULL,
  provider_type_id int NOT NULL, 
  phone VARCHAR(20) NOT NULL,
  address_1 VARCHAR(60) NOT NULL,
  address_2 VARCHAR(60) NULL,
  city VARCHAR(60) NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(5) NOT NULL,

  foreign key (provider_type_id) REFERENCES provider_type(ptid)
);

CREATE table patient (
  pid SERIAL PRIMARY KEY,
  ssn VARCHAR(10) NOT NULL,
  pname VARCHAR(200) NOT NULL,
  dob DATE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_1 VARCHAR(60) NOT NULL,
  address_2 VARCHAR(60) NULL,
  city VARCHAR(60) NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(5) NOT NULL,
  email VARCHAR(50) NOT NULL
);

CREATE table calendar_time (
  tid SERIAL PRIMARY KEY,
  from_time int NOT NULL, -- 8, 12, 16
  to_time int NOT NULL    -- 12, 16, 20
);

CREATE table calendar_day (
  did SERIAL PRIMARY KEY, -- 0 - Sunday, 1-Monday, ..., 6-Saturday, 7-Every day, 8-weekend, 9-weekday
  description varchar(20) NOT NULL
);

CREATE table calendar_days (
  did int NOT NULL,
  day_of_week int,

  unique (did, day_of_week)
);

CREATE table patient_appt_preference (
  pid int NOT NULL, -- patient id
  preferred_day int NULL, 
  preferred_time int NULL,
  max_distance int NULL,

  foreign key (pid) REFERENCES patient(pid),
  foreign key (preferred_day) REFERENCES calendar_day(did),
  foreign key (preferred_time) REFERENCES calendar_time(tid),

  UNIQUE(pid)
);

CREATE table patient_login_info (
  pid int NOT NULL,
  user_name varchar(50) NOT NULL, -- the value could be email or name
  password varchar(100) NOT NULL,

  foreign key (pid) REFERENCES patient(pid),
  UNIQUE (user_name)
);

CREATE table priority_group (
  gid SERIAL PRIMARY KEY, -- 1, 2, 3
  gname VARCHAR(200) NOT NULL,
  from_age INT NOT NULL, -- 80, 70, ...
  to_age INT NOT NULL, -- 80, 70, ...
  eligible_date DATE NULL
);

CREATE table appointment_offer (
  aid SERIAL PRIMARY KEY,
  pid INT NOT NULL, -- provider_id
  appt_date DATE NOT NULL,
  cal_time_id INT NOT NULL,
  quota  int NOT NULL,
  available_quota int NULL,

  FOREIGN KEY (pid) REFERENCES provider(pid),
  FOREIGN KEY (cal_time_id) REFERENCES calendar_time(tid),
  UNIQUE (pid, appt_date, cal_time_id)
);

CREATE table patient_appt_history (
  hid SERIAL PRIMARY KEY,  
  pid int NOT NULL, -- pateint id
  aid INT NOT NULL, -- appointment offer id
  status VARCHAR(10) NULL, -- accepted, pending, declined, 'cancelled'
  show_up VARCHAR(1) NULL, -- Y or others
  vaccinated VARCHAR(1) NULL, -- Y, or others
  added_ts TIMESTAMP NOT NULL,

  FOREIGN KEY (pid) REFERENCES patient(pid),
  FOREIGN KEY (aid) REFERENCES appointment_offer(aid)
);

CREATE TABLE distance_by_zipcode (
  zipcode_1 varchar(5) not null,
  zipcode_2 varchar(5) not null,
  distance int not null,

  UNIQUE (zipcode_1, zipcode_2)
);

CREATE TABLE patient_group (
  pid int NOT NULL,
  priority_group_id INT NULL,  -- NULL initially

  FOREIGN KEY (pid) REFERENCES patient(pid),
  FOREIGN KEY (priority_group_id) REFERENCES priority_group(gid),
  UNIQUE (pid)
);

---- added for web
CREATE table provider_login_info (
  pid int NOT NULL,
  user_name varchar(50) NOT NULL,
  password varchar(100) NOT NULL,

  foreign key (pid) REFERENCES provider(pid),
  UNIQUE (user_name)
);
