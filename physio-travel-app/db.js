'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'physio.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor','patient')),
  pass_salt TEXT,
  pass_hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS doctors(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  years INTEGER NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  types TEXT NOT NULL DEFAULT '[]',
  prices TEXT NOT NULL DEFAULT '{}',
  cov TEXT NOT NULL DEFAULT '[]',
  modes TEXT NOT NULL DEFAULT '["home"]',
  slots TEXT NOT NULL DEFAULT '[]',
  clinic_addr TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  demo INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  patient_id INTEGER NOT NULL REFERENCES users(id),
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  addr TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  kind TEXT NOT NULL,
  city TEXT NOT NULL,
  day TEXT NOT NULL,
  slot TEXT NOT NULL,
  n_sessions INTEGER NOT NULL DEFAULT 1,
  total INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_slot
  ON bookings(doctor_id, day, slot) WHERE status IN ('pending','confirmed');
CREATE INDEX IF NOT EXISTS ix_booking_patient ON bookings(patient_id);
CREATE INDEX IF NOT EXISTS ix_booking_doctor ON bookings(doctor_id);
CREATE TABLE IF NOT EXISTS reviews(
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stars INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(doctor_id, patient_id)
);
CREATE TABLE IF NOT EXISTS conversations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_at INTEGER,
  last_text TEXT,
  last_from TEXT,
  UNIQUE(doctor_id, patient_id)
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_role TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_msg_conv ON messages(conv_id, id);
`);

const TYPE_IDS = ['recovery', 'bones', 'nerves', 'sports'];
const TYPE_NAMES = { recovery: 'ريكفري', bones: 'عظام ومفاصل', nerves: 'أعصاب', sports: 'إصابات ملاعب' };
const CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'السويس', 'العين السخنة', 'الإسماعيلية', 'بورسعيد', 'الغردقة'];
const SLOT_KEYS = ['h10', 'h12', 'h14', 'h16', 'h18', 'h20'];
const FRI_OK = ['h16', 'h18', 'h20'];
const TITLES = ['أخصائي علاج طبيعي', 'استشاري علاج طبيعي', 'أخصائي علاج طبيعي رياضي', 'أخصائي إصابات ملاعب', 'أخصائي علاج طبيعي أعصاب', 'أخصائي علاج طبيعي عظام'];
const DISC = { 1: 0, 5: 0.08, 10: 0.15 };

module.exports = { db, DATA_DIR, TYPE_IDS, TYPE_NAMES, CITIES, SLOT_KEYS, FRI_OK, TITLES, DISC };
