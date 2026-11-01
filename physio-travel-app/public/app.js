(function () {
'use strict';

/* ---------- helpers ---------- */
var $ = function (s) { return document.querySelector(s); };
function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function num(n) { return Number(n).toLocaleString('ar-EG'); }
function fmt(n) { return num(n) + ' ج.م'; }
function r5(n) { return Math.round(n / 5) * 5; }
function normalize(s) { return s.replace(/[٠-٩]/g, function (c) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)); }).replace(/\s|-/g, ''); }
function arr(x) { return Array.isArray(x) ? x : []; }
function timeStr(ms) { return new Date(ms).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' }); }
function dayStr(ms) { return new Date(ms).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }); }
function line(dl, k, v, cls) { var w = el('div', 'ln' + (cls ? ' ' + cls : '')); w.appendChild(el('dt', null, k)); w.appendChild(el('dd', null, v)); dl.appendChild(w); }
var flashT = null;
function flash(t) { var f = $('#flash'); f.textContent = t; f.hidden = false; clearTimeout(flashT); flashT = setTimeout(function () { f.hidden = true; }, 5000); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function api(method, path, body) {
  var opt = { method: method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body === undefined ? {} : body); }
  var r;
  try { r = await fetch('/api' + path, opt); }
  catch (e) { var ne = new Error('مفيش اتصال بالإنترنت. اتأكد وحاول تاني.'); ne.code = 'network'; throw ne; }
  var j = null;
  try { j = await r.json(); } catch (e) { /* no body */ }
  if (!r.ok) {
    var err = new Error((j && j.error) || 'حصلت مشكلة. حاول تاني.');
    err.status = r.status; err.code = j && j.code;
    if (r.status === 401 && err.code === 'auth' && me) sessionLost();
    throw err;
  }
  return j;
}

/* ---------- static data ---------- */
var TYPES = [
  { id: 'recovery', name: 'ريكفري', desc: 'استشفاء عضلات بعد التمرين والمجهود', price: 450, mins: 45 },
  { id: 'bones', name: 'عظام ومفاصل', desc: 'الظهر والرقبة والركبة والكتف', price: 600, mins: 60 },
  { id: 'nerves', name: 'أعصاب', desc: 'عرق النسا والانزلاق وتنميل الأطراف', price: 700, mins: 60 },
  { id: 'sports', name: 'إصابات ملاعب', desc: 'تمزق والتواء وتأهيل للرجوع للملعب', price: 650, mins: 50 }
];
var CITIES = ['القاهرة', 'الجيزة', 'الإسكندرية', 'السويس', 'العين السخنة', 'الإسماعيلية', 'بورسعيد', 'الغردقة'];
var MODES = [{ id: 'home', name: 'في بيتك', sub: 'الدكتور بييجيلك' }, { id: 'clinic', name: 'في العيادة', sub: 'من غير رسوم انتقال' }];
var DISC = { 1: 0, 5: 0.08, 10: 0.15 };
var SLOTS = [{ k: 'h10', l: '١٠:٠٠ ص' }, { k: 'h12', l: '١٢:٠٠ م' }, { k: 'h14', l: '٢:٠٠ م' }, { k: 'h16', l: '٤:٠٠ م' }, { k: 'h18', l: '٦:٠٠ م' }, { k: 'h20', l: '٨:٠٠ م' }];
var FRI_OK = ['h16', 'h18', 'h20'];
var TITLES = ['أخصائي علاج طبيعي', 'استشاري علاج طبيعي', 'أخصائي علاج طبيعي رياضي', 'أخصائي إصابات ملاعب', 'أخصائي علاج طبيعي أعصاب', 'أخصائي علاج طبيعي عظام'];
var STATUS = { pending: 'في انتظار تأكيد الدكتور', confirmed: 'مؤكد', declined: 'الدكتور اعتذر', cancelled: 'ملغي' };
var QUICK = ['بكام الجلسة؟', 'عندك مواعيد بكرة؟', 'بتغطي منطقتي؟'];

/* ---------- state ---------- */
var me = null, myDoc = null;
var doctors = [], reviews = [], myBk = [], docBk = [], convs = [], busy = {};
var view = 'boot', dashTab = 'bookings', openConvId = null, curDoc = null, rvStars = 0;
var authRole = 'patient', authMode = 'signup', authOpen = false, authNote = '', afterAuth = null;
var thread = null, routeSeq = 0, ready = false, ticking = false;
var st = { type: 'bones', city: 'القاهرة', mode: 'home', count: 1, doc: null, date: null, time: null };

function tOf(id) { return TYPES.filter(function (t) { return t.id === id; })[0]; }
function slotByKey(k) { return SLOTS.filter(function (s) { return s.k === k; })[0]; }

function buildDates() {
  var out = [], base = new Date(); base.setHours(12, 0, 0, 0);
  for (var i = 1; i <= 8; i++) {
    var d = new Date(base); d.setDate(base.getDate() + i);
    var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    out.push({ key: k, fri: d.getDay() === 5, wd: d.toLocaleDateString('ar-EG', { weekday: 'long' }), day: d.getDate().toLocaleString('ar-EG'), mon: d.toLocaleDateString('ar-EG', { month: 'long' }) });
  }
  return out;
}
var DATES = buildDates();
st.date = DATES[0].key;
function dateObj(k) { return DATES.filter(function (d) { return d.key === k; })[0]; }
function whenLabel(day, slot) {
  var d = new Date(day + 'T12:00:00'), s = slotByKey(slot);
  return d.toLocaleDateString('ar-EG', { weekday: 'long' }) + ' ' + d.getDate().toLocaleString('ar-EG') + ' ' + d.toLocaleDateString('ar-EG', { month: 'long' }) + (s ? ' · ' + s.l : '');
}

/* ---------- doctors ---------- */
function norm(x) {
  var cov = {}; arr(x.cov).forEach(function (c) { cov[c.c] = c.f; });
  return Object.assign({}, x, { cov: cov, prices: x.prices || {}, types: arr(x.types), modes: arr(x.modes), slots: arr(x.slots), rating: x.rating || { avg: 0, count: 0 } });
}
function findDoctor(id) {
  var d = doctors.filter(function (x) { return x.id === id; })[0];
  if (!d && curDoc && curDoc.id === id) d = curDoc;
  return d || null;
}
function priceOf(d, typeId) { return Number(d.prices[typeId]) || tOf(typeId).price; }
function docsFor() {
  return doctors.filter(function (d) {
    return d.types.indexOf(st.type) > -1 && d.cov[st.city] != null && d.modes.indexOf(st.mode) > -1;
  });
}
function slotList(d) {
  var all = d ? SLOTS.filter(function (s) { return d.slots.indexOf(s.k) > -1; }) : SLOTS;
  var dt = dateObj(st.date);
  return dt && dt.fri ? all.filter(function (s) { return FRI_OK.indexOf(s.k) > -1; }) : all;
}
function slotTaken(s) { return !!(st.doc && s && busy[st.date + '_' + s.k]); }
function calc() {
  var d = st.doc ? findDoctor(st.doc) : null; if (!d) return null;
  var base = priceOf(d, st.type), fee = st.mode === 'home' ? (d.cov[st.city] || 0) : 0;
  var gross = (base + fee) * st.count, disc = r5(gross * DISC[st.count]);
  return { base: base, fee: fee, count: st.count, gross: gross, disc: disc, total: gross - disc };
}
function fixDoc() { if (st.doc && !docsFor().some(function (d) { return d.id === st.doc; })) setDoc(null); }
function setDoc(id) { st.doc = id; st.time = null; busy = {}; if (id) loadBusy(); }

/* ---------- data loading ---------- */
async function loadDoctors() {
  var r = await api('GET', '/doctors'), nd = r.doctors.map(norm);
  if (!same(nd, doctors)) { doctors = nd; if (view === 'home') { fixDoc(); renderDocs(); renderSlots(); renderSummary(); } }
}
async function loadBusy() {
  var id = st.doc; if (!id) return;
  try {
    var r = await api('GET', '/doctors/' + id + '/busy'); if (st.doc !== id) return;
    var nb = {}; r.busy.forEach(function (x) { nb[x.day + '_' + x.slot] = true; });
    if (!same(nb, busy)) {
      busy = nb;
      if (st.time && slotTaken(slotByKey(st.time))) st.time = null;
      if (view === 'home') { renderSlots(); renderSummary(); }
    }
  } catch (e) { /* ignore */ }
}
async function loadMyBk() {
  if (!me || me.role !== 'patient') return;
  var r = await api('GET', '/bookings/mine');
  if (!same(r.bookings, myBk)) {
    myBk = r.bookings;
    if (view === 'home') renderMine();
    if (view === 'profile' && curDoc) { var f = $('#revform'); if (f && !f.contains(document.activeElement)) renderReviewForm(curDoc); }
  }
}
async function loadDocBk() {
  if (!me || me.role !== 'doctor') return;
  var r = await api('GET', '/bookings/doctor');
  if (!same(r.bookings, docBk)) { docBk = r.bookings; if (view === 'dash' && dashTab === 'bookings') renderDocBookings(); }
  updateCount();
}
async function loadConvs() {
  if (!me) return;
  var r = await api('GET', '/conversations');
  if (!same(r.conversations, convs)) {
    convs = r.conversations;
    if (view === 'home') renderMyConvs();
    if (view === 'dash' && dashTab === 'messages') {
      renderConvList();
      if (!openConvId && convs.length) openConv(convs[0].id);
    }
  }
}
async function loadAll() {
  var jobs = [loadDoctors()];
  if (me) { jobs.push(loadConvs()); jobs.push(me.role === 'doctor' ? loadDocBk() : loadMyBk()); }
  await Promise.all(jobs.map(function (p) { return p.catch(function () { /* ignore */ }); }));
}
async function tick() {
  if (ticking || document.hidden || !ready) return;
  ticking = true;
  try {
    if (view === 'home') { await loadDoctors(); await loadBusy(); await loadMyBk(); await loadConvs(); }
    else if (view === 'dash') { if (dashTab === 'bookings') await loadDocBk(); else if (dashTab === 'messages') await loadConvs(); }
    else if (view === 'profile' && curDoc) { await loadReviewsFor(curDoc.id); await loadMyBk(); }
  } catch (e) { /* ignore */ }
  ticking = false;
}
async function loadReviewsFor(id) {
  var r = await api('GET', '/doctors/' + id + '/reviews');
  if (!curDoc || curDoc.id !== id) return;
  if (!same(r.reviews, reviews)) { reviews = r.reviews; renderReviews(curDoc); }
}

/* ---------- booking view ---------- */
function renderTypes() {
  var box = $('#types'); box.textContent = '';
  TYPES.forEach(function (t) {
    var b = el('button', 'opt'); b.type = 'button'; b.dataset.id = t.id; b.setAttribute('aria-pressed', String(st.type === t.id));
    b.appendChild(el('b', null, t.name)); b.appendChild(el('small', null, t.desc));
    b.appendChild(el('span', 'pr', 'من ' + fmt(t.price) + ' · ' + num(t.mins) + ' دقيقة'));
    box.appendChild(b);
  });
}
function renderMode() {
  var box = $('#mode'); box.textContent = '';
  MODES.forEach(function (m) {
    var b = el('button', 'opt'); b.type = 'button'; b.dataset.id = m.id; b.setAttribute('aria-pressed', String(st.mode === m.id));
    b.appendChild(el('b', null, m.name)); b.appendChild(el('small', null, m.sub)); box.appendChild(b);
  });
  $('#addrwrap').hidden = st.mode !== 'home';
}
function renderDocs() {
  var list = docsFor(), box = $('#docs'); box.textContent = '';
  $('#docsub').textContent = list.length ? ('دكاترة ' + tOf(st.type).name + ' المتاحين في ' + st.city + ' (' + num(list.length) + ')') : '';
  if (!list.length) {
    box.appendChild(el('p', 'empty', 'مفيش دكاترة ' + tOf(st.type).name + ' متاحين في ' + st.city + (st.mode === 'clinic' ? ' في العيادة' : '') + ' دلوقتي. جرّب مدينة تانية أو نوع جلسة مختلف.'));
    return;
  }
  list.forEach(function (d) {
    var b = el('button', 'doc'); b.type = 'button'; b.dataset.id = d.id; b.setAttribute('aria-pressed', String(st.doc === d.id));
    b.appendChild(el('span', 'av', d.name.replace('د. ', '').charAt(0)));
    var mid = el('span'), nm = el('b', null, d.name);
    if (d.demo) nm.appendChild(el('span', 'tagx', 'نموذج'));
    mid.appendChild(nm);
    mid.appendChild(el('span', 'meta', d.title));
    var r = d.rating;
    mid.appendChild(el('span', 'meta', num(d.years) + ' سنة خبرة · ' + (r.count ? ('★ ' + r.avg.toLocaleString('ar-EG') + ' (' + num(r.count) + ' تقييم)') : 'دكتور جديد')));
    if (st.mode === 'clinic' && d.clinicAddr) mid.appendChild(el('span', 'meta', 'العيادة: ' + d.clinicAddr));
    b.appendChild(mid);
    var pr = el('span', 'price', fmt(priceOf(d, st.type)));
    pr.appendChild(el('small', null, st.mode === 'home' ? ('+ انتقال ' + fmt(d.cov[st.city] || 0)) : 'في العيادة'));
    b.appendChild(pr);
    var w = el('div', 'dw'); w.appendChild(b);
    var pl = el('a', 'plink', 'الملف الشخصي والتقييمات ›'); pl.href = '#doctor-' + d.id; w.appendChild(pl);
    box.appendChild(w);
  });
}
function renderDates() {
  var box = $('#dates'); box.textContent = '';
  DATES.forEach(function (d) {
    var b = el('button', 'opt'); b.type = 'button'; b.dataset.key = d.key; b.setAttribute('aria-pressed', String(st.date === d.key));
    b.appendChild(el('small', null, d.wd)); b.appendChild(el('b', null, d.day)); b.appendChild(el('small', null, d.mon));
    box.appendChild(b);
  });
}
function renderSlots() {
  var box = $('#slots'); box.textContent = '';
  var d = st.doc ? findDoctor(st.doc) : null, list = slotList(d);
  if (!list.length) { box.appendChild(el('p', 'empty', 'الدكتور مش متاح في اليوم ده. جرّب يوم تاني.')); return; }
  list.forEach(function (s) {
    var b = el('button', 'opt', s.l); b.type = 'button'; b.dataset.t = s.k;
    var tk = slotTaken(s); b.disabled = tk; if (tk) b.title = 'محجوز';
    b.setAttribute('aria-pressed', String(st.time === s.k));
    box.appendChild(b);
  });
}
function renderSummary() {
  var L = $('#lines'), M = $('#money'); L.textContent = ''; M.textContent = '';
  var d = st.doc ? findDoctor(st.doc) : null, c = calc(), dt = dateObj(st.date), s = st.time ? slotByKey(st.time) : null;
  line(L, 'الجلسة', tOf(st.type).name + ' · ' + num(tOf(st.type).mins) + ' د');
  line(L, 'الدكتور', d ? d.name : 'اختار دكتور');
  line(L, 'المكان', st.city + ' · ' + (st.mode === 'home' ? 'في بيتك' : 'في العيادة'));
  line(L, 'الميعاد', dt ? (dt.wd + ' ' + dt.day + ' ' + dt.mon + (s ? ' · ' + s.l : ' · اختار الساعة')) : '—');
  line(L, 'عدد الجلسات', num(st.count));
  if (c) {
    line(M, 'سعر الجلسة', fmt(c.base));
    if (st.mode === 'home') line(M, 'رسوم الانتقال', fmt(c.fee));
    if (c.disc > 0) line(M, 'خصم الباقة', '- ' + fmt(c.disc), 'dis');
    $('#total').textContent = fmt(c.total); $('#bartotal').textContent = fmt(c.total);
  } else { $('#total').textContent = '—'; $('#bartotal').textContent = '—'; }
}
function renderMine() {
  var a = (me && me.role === 'patient') ? myBk : [], box = $('#mine'); box.textContent = ''; $('#minewrap').hidden = !a.length;
  a.forEach(function (b) {
    var w = el('div', 'bk'), i = el('div');
    var h = el('b', null, (b.typeName || 'جلسة') + ' مع ' + (b.doctorName || ''));
    h.appendChild(el('span', 'st ' + b.status, STATUS[b.status] || b.status));
    i.appendChild(h);
    i.appendChild(el('small', null, whenLabel(b.day, b.slot) + ' · ' + b.city + ' · ' + fmt(b.total)));
    i.appendChild(el('small', null, 'رقم الحجز ' + b.ref));
    w.appendChild(i);
    var ac = el('div', 'acts');
    var l = el('a', 'plink', 'صفحة الدكتور والشات ›'); l.href = '#doctor-' + b.doctorId; ac.appendChild(l);
    if (b.status === 'pending' || b.status === 'confirmed') { var x = el('button', null, 'إلغاء'); x.type = 'button'; x.dataset.cancel = b.id; ac.appendChild(x); }
    w.appendChild(ac); box.appendChild(w);
  });
}
function renderMyConvs() {
  var box = $('#convs'); box.textContent = '';
  var a = (me && me.role === 'patient') ? convs : [];
  $('#convwrap').hidden = !a.length;
  a.forEach(function (c) {
    var w = el('div', 'bk'), i = el('div');
    i.appendChild(el('b', null, c.doctorName));
    i.appendChild(el('small', null, c.lastText || ''));
    w.appendChild(i);
    var l = el('a', 'plink', 'افتح المحادثة ›'); l.href = '#doctor-' + c.doctorId; w.appendChild(l); box.appendChild(w);
  });
}
function renderHome() { renderTypes(); renderMode(); renderDocs(); renderDates(); renderSlots(); renderSummary(); renderMine(); renderMyConvs(); }

function showDone(b) {
  var box = $('#donebox'); box.textContent = ''; box.hidden = false; $('#sumcard').hidden = true;
  var card = el('div', 'card done');
  card.appendChild(el('h3', null, b.status === 'pending' ? 'وصل طلبك للدكتور' : 'تم تسجيل الحجز'));
  var p = el('p', null, 'رقم الحجز '); p.appendChild(el('span', 'ref', b.ref)); card.appendChild(p);
  var dl = el('dl');
  line(dl, 'الاسم', b.name); line(dl, 'الجلسة', b.typeName); line(dl, 'الدكتور', b.doctorName);
  line(dl, 'الميعاد', whenLabel(b.day, b.slot)); line(dl, 'المكان', b.city + (b.mode === 'home' ? ' · ' + b.addr : ' · العيادة'));
  line(dl, 'الإجمالي', fmt(b.total));
  card.appendChild(dl);
  card.appendChild(el('p', 'note', b.status === 'pending'
    ? 'هتلاقي رد الدكتور في «حجوزاتي» تحت. لما يأكد الميعاد هيتواصل معاك على ' + b.phone + '.'
    : 'تم تأكيد الحجز مع دكتور نموذج للتجربة.'));
  var again = el('button', 'cta ghost', 'حجز جلسة جديدة'); again.type = 'button'; again.id = 'again'; card.appendChild(again);
  box.appendChild(card); updateBar();
}
function updateBar() { $('#bar').hidden = view !== 'home' || !$('#donebox').hidden; }

function needLogin(note) {
  afterAuth = 'book'; authOpen = true; authRole = 'patient'; authMode = 'signup'; authNote = note || '';
  go('welcome');
}
async function book() {
  var err = $('#err'), btn = $('#book'), name = $('#pname').value.trim(), phone = normalize($('#pphone').value), addr = $('#paddr').value.trim();
  if (!st.doc) { err.textContent = 'اختار الدكتور الأول.'; return; }
  if (!st.time) { err.textContent = 'اختار الساعة المناسبة.'; return; }
  if (name.length < 3) { err.textContent = 'اكتب اسمك بالكامل.'; return; }
  if (!/^01[0125]\d{8}$/.test(phone)) { err.textContent = 'رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ 01.'; return; }
  if (st.mode === 'home' && addr.length < 5) { err.textContent = 'اكتب عنوانك عشان الدكتور يوصلك.'; return; }
  err.textContent = '';
  if (!me) { needLogin('سجّل حساب جديد أو سجّل دخول عشان نكمل الحجز. اختياراتك هتفضل زي ما هي.'); return; }
  if (me.role !== 'patient') { err.textContent = 'حساب الطبيب مش بيحجز جلسات. سجّل حساب «حجز جلسة» لو عايز تحجز.'; return; }
  btn.disabled = true;
  try {
    var r = await api('POST', '/bookings', { doctorId: st.doc, type: st.type, mode: st.mode, city: st.city, day: st.date, slot: st.time, count: st.count, name: name, phone: phone, addr: addr });
    st.time = null;
    await loadMyBk();
    showDone(r.booking); loadBusy(); renderSlots(); renderSummary();
  } catch (e) {
    err.textContent = e.message;
    if (e.code === 'taken') { st.time = null; await loadBusy(); renderSlots(); renderSummary(); }
  }
  btn.disabled = false;
}
async function cancelBooking(id) {
  try { await api('PATCH', '/bookings/' + id, { status: 'cancelled' }); await loadMyBk(); loadBusy(); }
  catch (e) { flash(e.message); }
}

/* ---------- chat ---------- */
function stopThread() { thread = null; }
function bubble(m, side) {
  var b = el('div', 'm ' + (m.from === side ? 'me' : 'dr'), m.text);
  b.appendChild(el('small', null, timeStr(m.at)));
  return b;
}
function mountThread(box, id, side) {
  var e = el('p', 'empty', 'ابدأ المحادثة بأول رسالة.');
  box.textContent = ''; box.appendChild(e);
  thread = { id: id, side: side, box: box, last: 0, empty: e, busy: false };
  pollThread();
}
async function pollThread() {
  var t = thread; if (!t || t.busy) return;
  t.busy = true;
  try {
    var r = await api('GET', '/conversations/' + t.id + '/messages?after=' + t.last);
    if (thread === t && r.messages.length) {
      if (t.empty) { t.empty.remove(); t.empty = null; }
      var near = t.last === 0 || t.box.scrollHeight - t.box.scrollTop - t.box.clientHeight < 80;
      r.messages.forEach(function (m) { t.box.appendChild(bubble(m, t.side)); t.last = Math.max(t.last, m.id); });
      if (near) t.box.scrollTop = t.box.scrollHeight;
    }
  } catch (e) { /* ignore */ }
  t.busy = false;
}
async function sendMsg(convId, text) {
  text = String(text).trim(); if (!text) return;
  try { await api('POST', '/conversations/' + convId + '/messages', { text: text }); pollThread(); }
  catch (e) { flash(e.message); }
}
function chatForm(box, onSend) {
  var f = el('form', 'cform'), inp = el('input'); inp.placeholder = 'اكتب رسالتك'; inp.autocomplete = 'off'; inp.maxLength = 1000; inp.setAttribute('aria-label', 'رسالتك');
  var sb = el('button', null, 'إرسال'); sb.type = 'submit'; f.appendChild(inp); f.appendChild(sb);
  f.addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value; inp.value = ''; onSend(v); });
  box.appendChild(f);
}

/* ---------- public doctor page ---------- */
function ratingFromReviews() {
  if (!reviews.length) return { avg: 0, count: 0 };
  var s = 0; reviews.forEach(function (r) { s += r.stars; });
  return { avg: Math.round(s / reviews.length * 10) / 10, count: reviews.length };
}
function renderReviews(d) {
  var box = $('#revbox'); if (!box) return; box.textContent = '';
  var r = ratingFromReviews();
  if ($('#rs-b')) { $('#rs-b').textContent = r.count ? '★ ' + r.avg.toLocaleString('ar-EG') : 'جديد'; $('#rs-s').textContent = r.count ? num(r.count) + ' تقييم' : 'مفيش تقييمات لسه'; }
  if (!reviews.length) { box.appendChild(el('p', 'empty', 'لسه مفيش تقييمات للدكتور ده.')); return; }
  reviews.forEach(function (x) {
    var w = el('div', 'rv'), top = el('div', 'top');
    top.appendChild(el('b', null, x.name)); top.appendChild(el('span', 'stars', new Array(x.stars + 1).join('★')));
    w.appendChild(top); w.appendChild(el('p', null, x.text)); w.appendChild(el('small', null, dayStr(x.at))); box.appendChild(w);
  });
}
function renderReviewForm(d) {
  var box = $('#revform'); if (!box) return; box.textContent = '';
  if (!me || me.role !== 'patient') return;
  var ok = myBk.some(function (b) { return b.doctorId === d.id && b.status !== 'declined' && b.status !== 'cancelled'; });
  if (!ok) { box.appendChild(el('p', 'note', 'تقدر تقيّم الدكتور بعد ما تحجز معاه.')); return; }
  var mine = reviews.filter(function (r) { return r.mine; })[0];
  rvStars = mine ? mine.stars : 0;
  var f = el('form'); f.id = 'rvform2';
  f.appendChild(el('span', 'lbl', mine ? 'عدّل تقييمك' : 'قيّم الدكتور'));
  var sp = el('div', 'starpick'); sp.setAttribute('role', 'group'); sp.setAttribute('aria-label', 'عدد النجوم');
  for (var i = 1; i <= 5; i++) { var b = el('button', null, '★'); b.type = 'button'; b.dataset.star = String(i); b.setAttribute('aria-label', i + ' نجوم'); b.setAttribute('aria-pressed', String(i <= rvStars)); sp.appendChild(b); }
  f.appendChild(sp);
  var ta = el('textarea'); ta.placeholder = 'اكتب رأيك في الجلسة'; ta.maxLength = 500; ta.value = mine ? mine.text : ''; ta.setAttribute('aria-label', 'رأيك');
  f.appendChild(ta);
  var m = el('p', 'err'); f.appendChild(m);
  var sb = el('button', 'cta', mine ? 'حفظ التعديل' : 'نشر التقييم'); sb.type = 'submit'; f.appendChild(sb);
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (rvStars < 1) { m.textContent = 'اختار عدد النجوم.'; return; }
    if (ta.value.trim().length < 3) { m.textContent = 'اكتب سطر على الأقل عن تجربتك.'; return; }
    sb.disabled = true;
    try {
      await api('PUT', '/doctors/' + d.id + '/review', { stars: rvStars, text: ta.value.trim() });
      var r = await api('GET', '/doctors/' + d.id + '/reviews'); reviews = r.reviews; renderReviews(d);
      m.className = 'ok'; m.textContent = 'تم نشر تقييمك.';
    } catch (x) { m.className = 'err'; m.textContent = x.message; }
    sb.disabled = false;
  });
  box.appendChild(f);
}
function buildChat(d, card) {
  if (!me) {
    card.appendChild(el('p', 'empty', 'سجّل دخولك بحساب «حجز جلسة» عشان تراسل الدكتور.'));
    var a = el('a', 'plink', 'سجّل دخول ›'); a.href = '#welcome'; card.appendChild(a); return;
  }
  if (me.role !== 'patient') {
    card.appendChild(el('p', 'empty', d.id === me.id ? 'دي صفحتك زي ما بتظهر للمرضى. ردودك على الرسائل من لوحتك.' : 'الشات متاح لحسابات «حجز جلسة» بس.')); return;
  }
  var box = el('div', 'msgs'); box.setAttribute('role', 'log'); card.appendChild(box);
  var cid = null;
  var send = function (v) { if (!cid) { flash('استنى ثانية والمحادثة تفتح.'); return; } sendMsg(cid, v); };
  var chips = el('div', 'chips'); QUICK.forEach(function (q) { var c = el('button', null, q); c.type = 'button'; c.addEventListener('click', function () { send(q); }); chips.appendChild(c); });
  card.appendChild(chips); chatForm(card, send);
  api('POST', '/conversations/with/' + d.id).then(function (r) { cid = r.id; if (curDoc && curDoc.id === d.id && view === 'profile') mountThread(box, cid, 'p'); }).catch(function (e) { flash(e.message); });
}
function renderProfile(d) {
  curDoc = d; setView('profile');
  var box = $('#v-profile'); box.textContent = '';
  var back = el('div', 'pback'), ba = el('a', null, '‹ رجوع'); ba.href = me && me.role === 'doctor' ? '#dashboard' : '#book'; back.appendChild(ba); box.appendChild(back);
  var lay = el('div', 'layout'), main = el('main'), aside = el('aside', 'aside');
  var hero = el('section', 'card'), hr = el('div', 'hero');
  hr.appendChild(el('span', 'av', d.name.replace('د. ', '').charAt(0)));
  var ht = el('div'), h1 = el('h1', null, d.name); if (d.demo) h1.appendChild(el('span', 'tagx', 'نموذج'));
  ht.appendChild(h1); ht.appendChild(el('p', null, d.title));
  var tg = el('div', 'tags'); d.types.forEach(function (t) { tg.appendChild(el('span', 'tg', tOf(t).name)); }); ht.appendChild(tg);
  hr.appendChild(ht); hero.appendChild(hr);
  var sts = el('div', 'stats');
  var s1 = el('div'), b1 = el('b', null, ''); b1.id = 'rs-b'; var sm1 = el('small', null, ''); sm1.id = 'rs-s'; s1.appendChild(b1); s1.appendChild(sm1); sts.appendChild(s1);
  [[num(d.years), 'سنة خبرة'], [num(Object.keys(d.cov).length), 'مناطق تغطية']].forEach(function (s) { var w = el('div'); w.appendChild(el('b', null, s[0])); w.appendChild(el('small', null, s[1])); sts.appendChild(w); });
  hero.appendChild(sts);
  if (!me || me.role !== 'doctor') { var cta = el('button', 'cta', 'احجز مع ' + d.name); cta.type = 'button'; cta.addEventListener('click', function () { bookWith(d); }); hero.appendChild(cta); }
  main.appendChild(hero);
  var bc = el('section', 'card'); bc.appendChild(el('h3', null, 'نبذة')); bc.appendChild(el('p', 'bio', d.bio || 'الدكتور لسه مكتبش نبذة.')); main.appendChild(bc);
  var pc = el('section', 'card'); pc.appendChild(el('h3', null, 'الأسعار والتغطية'));
  var dl = el('dl');
  d.types.forEach(function (t) { line(dl, 'جلسة ' + tOf(t).name, fmt(priceOf(d, t))); });
  line(dl, 'بيقدم الجلسات', d.modes.map(function (m) { return m === 'home' ? 'في البيت' : 'في العيادة'; }).join(' و'));
  if (d.clinicAddr) line(dl, 'عنوان العيادة', d.clinicAddr);
  Object.keys(d.cov).forEach(function (c) { line(dl, 'انتقال إلى ' + c, fmt(d.cov[c])); });
  pc.appendChild(dl); main.appendChild(pc);
  var rc = el('section', 'card'); rc.appendChild(el('h3', null, 'التقييمات'));
  var rb = el('div'); rb.id = 'revbox'; rc.appendChild(rb);
  var rf = el('div'); rf.id = 'revform'; rf.className = 'mt14'; rc.appendChild(rf);
  main.appendChild(rc);
  var cc = el('section', 'card'); cc.appendChild(el('h3', null, 'شات مع ' + d.name));
  buildChat(d, cc); aside.appendChild(cc);
  lay.appendChild(main); lay.appendChild(aside); box.appendChild(lay);
  renderReviews(d); renderReviewForm(d);
}
function bookWith(d) {
  if (d.types.indexOf(st.type) < 0) st.type = d.types[0];
  var cs = Object.keys(d.cov); if (d.cov[st.city] == null) { st.city = cs[0]; $('#city').value = st.city; }
  if (d.modes.indexOf(st.mode) < 0) st.mode = d.modes[0];
  if (!findDoctor(d.id) || doctors.every(function (x) { return x.id !== d.id; })) doctors = doctors.concat([d]);
  setDoc(d.id);
  go('book');
  setTimeout(function () { var e = $('#docs'); if (e) e.scrollIntoView({ block: 'start' }); }, 80);
}

/* ---------- doctor dashboard ---------- */
function fld(label, control, idv) { var w = el('div', 'field'), l = el('label', null, label); l.htmlFor = idv; control.id = idv; w.appendChild(l); w.appendChild(control); return w; }
function chk(idv, text, checked) { var l = el('label', 'chk'), i = el('input'); i.type = 'checkbox'; i.id = idv; i.checked = !!checked; l.appendChild(i); l.appendChild(el('span', null, text)); return l; }
function numInp(idv, val, label, min, max) { var i = el('input'); i.type = 'number'; i.id = idv; i.value = val; i.min = min; i.max = max; i.inputMode = 'numeric'; i.setAttribute('aria-label', label); return i; }
function buildDocForm() {
  var box = $('#d-profile'); box.textContent = '';
  var x = myDoc || {}, isNew = !myDoc;
  var f = el('form', 'step'); f.noValidate = true; f.id = 'docform';
  f.appendChild(el('h2', null, isNew ? 'سجّل بياناتك كطبيب' : 'بيانات صفحتك'));
  f.appendChild(el('p', 'sub', isNew ? 'املأ البيانات دي وصفحتك هتظهر للمرضى فورًا. تقدر تعدّلها في أي وقت.' : 'أي تعديل بتحفظه بيظهر للمرضى فورًا.'));
  var g = el('div', 'fg');
  var r1 = el('div', 'row');
  var nm = el('input'); nm.value = x.name || (me ? me.name : ''); nm.placeholder = 'د. اسمك'; nm.autocomplete = 'name'; nm.maxLength = 60;
  r1.appendChild(fld('الاسم اللي هيظهر للمرضى', nm, 'df-name'));
  var ti = el('select'); TITLES.forEach(function (t) { var o = el('option', null, t); o.value = t; ti.appendChild(o); }); ti.value = x.title || TITLES[0];
  r1.appendChild(fld('التخصص', ti, 'df-title'));
  r1.appendChild(fld('سنين الخبرة', numInp('df-years', x.years != null ? x.years : '', 'سنين الخبرة', 0, 60), 'df-years'));
  g.appendChild(r1);
  var bio = el('textarea'); bio.value = x.bio || ''; bio.placeholder = 'عرّف المرضى بنفسك: خبرتك، الحالات اللي بتتعامل معاها، وطريقتك في العلاج.'; bio.maxLength = 1200;
  g.appendChild(fld('نبذة عنك', bio, 'df-bio'));

  var gt = el('div'); gt.appendChild(el('span', 'lbl', 'أنواع الجلسات وأسعارها (بالجنيه)'));
  var st1 = el('div', 'sets'); st1.style.marginTop = '8px';
  TYPES.forEach(function (t) {
    var row = el('div', 'setrow');
    row.appendChild(chk('df-t-' + t.id, t.name, arr(x.types).indexOf(t.id) > -1));
    row.appendChild(numInp('df-p-' + t.id, (x.prices && x.prices[t.id]) || t.price, 'سعر جلسة ' + t.name, 50, 5000));
    st1.appendChild(row);
  });
  gt.appendChild(st1); g.appendChild(gt);

  var gm = el('div'); gm.appendChild(el('span', 'lbl', 'بتقدم الجلسات فين؟'));
  var mg = el('div', 'chkgrid'); mg.style.marginTop = '8px';
  var modes = arr(x.modes).length ? x.modes : ['home'];
  mg.appendChild(chk('df-m-home', 'في بيت المريض', modes.indexOf('home') > -1));
  mg.appendChild(chk('df-m-clinic', 'في عيادتي', modes.indexOf('clinic') > -1));
  gm.appendChild(mg);
  var ad = el('input'); ad.value = x.clinicAddr || ''; ad.placeholder = 'عنوان العيادة (لو بتستقبل في عيادة)'; ad.maxLength = 200;
  var adw = fld('عنوان العيادة', ad, 'df-addr'); adw.style.marginTop = '10px'; gm.appendChild(adw); g.appendChild(gm);

  var gc = el('div'); gc.appendChild(el('span', 'lbl', 'المدن اللي بتغطيها'));
  gc.appendChild(el('p', 'hint', 'الرقم جنب كل مدينة هو رسوم الانتقال للبيت (اكتب ٠ لو مفيش).'));
  var cs = el('div', 'sets');
  var cv = {}; arr(x.cov).forEach(function (c) { if (c && c.c) cv[c.c] = Number(c.f) || 0; });
  CITIES.forEach(function (c, i) {
    var row = el('div', 'setrow');
    row.appendChild(chk('df-c-' + i, c, cv[c] != null));
    row.appendChild(numInp('df-f-' + i, cv[c] != null ? cv[c] : 50, 'رسوم الانتقال إلى ' + c, 0, 1000));
    cs.appendChild(row);
  });
  gc.appendChild(cs); g.appendChild(gc);

  var gs = el('div'); gs.appendChild(el('span', 'lbl', 'المواعيد المتاحة كل يوم'));
  var sg = el('div', 'chkgrid'); sg.style.marginTop = '8px';
  SLOTS.forEach(function (s) { sg.appendChild(chk('df-s-' + s.k, s.l, isNew || arr(x.slots).indexOf(s.k) > -1)); });
  gs.appendChild(sg); g.appendChild(gs);
  g.appendChild(chk('df-pub', 'أظهر صفحتي للمرضى', x.published !== false));
  f.appendChild(g);
  var msg = el('p', 'err'); msg.id = 'dfmsg'; msg.setAttribute('role', 'alert'); f.appendChild(msg);
  var sb = el('button', 'cta', isNew ? 'سجّل وانشر صفحتي' : 'حفظ التعديلات'); sb.type = 'submit'; f.appendChild(sb);
  var vl = el('a', 'plink', 'شوف صفحتك زي ما بتظهر للمرضى ›'); vl.id = 'dfview'; vl.href = '#doctor-' + me.id; vl.style.display = isNew ? 'none' : 'inline-block';
  f.appendChild(vl);
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var d = readDocForm(), m = $('#dfmsg'), er = validateDoc(d);
    if (er) { m.className = 'err'; m.textContent = er; return; }
    sb.disabled = true;
    try {
      var r = await api('PUT', '/doctor/me', d);
      myDoc = r.doctor; m.className = 'ok';
      m.textContent = 'تم الحفظ. ' + (d.published ? 'صفحتك ظاهرة للمرضى دلوقتي.' : 'صفحتك مخفية عن المرضى.');
      sb.textContent = 'حفظ التعديلات'; vl.style.display = 'inline-block'; f.querySelector('h2').textContent = 'بيانات صفحتك';
    } catch (x2) { m.className = 'err'; m.textContent = x2.message; }
    sb.disabled = false;
  });
  box.appendChild(f);
}
function readDocForm() {
  var d = { name: $('#df-name').value.trim(), title: $('#df-title').value, years: parseInt($('#df-years').value, 10) || 0, bio: $('#df-bio').value.trim(),
    types: [], prices: {}, cov: [], modes: [], slots: [], clinicAddr: $('#df-addr').value.trim(), published: $('#df-pub').checked };
  TYPES.forEach(function (t) { if ($('#df-t-' + t.id).checked) { d.types.push(t.id); d.prices[t.id] = Math.round(Number($('#df-p-' + t.id).value) || 0); } });
  CITIES.forEach(function (c, i) { if ($('#df-c-' + i).checked) d.cov.push({ c: c, f: Math.max(0, Math.round(Number($('#df-f-' + i).value) || 0)) }); });
  ['home', 'clinic'].forEach(function (m) { if ($('#df-m-' + m).checked) d.modes.push(m); });
  SLOTS.forEach(function (s) { if ($('#df-s-' + s.k).checked) d.slots.push(s.k); });
  return d;
}
function validateDoc(d) {
  if (d.name.length < 3) return 'اكتب اسمك كامل (٣ حروف على الأقل).';
  if (d.years < 0 || d.years > 60) return 'سنين الخبرة لازم تكون بين ٠ و ٦٠.';
  if (d.bio.length < 20) return 'اكتب نبذة عن نفسك (٢٠ حرف على الأقل).';
  if (!d.types.length) return 'اختار نوع جلسة واحد على الأقل.';
  for (var i = 0; i < d.types.length; i++) { var p = d.prices[d.types[i]]; if (p < 50 || p > 5000) return 'سعر جلسة ' + tOf(d.types[i]).name + ' لازم يكون بين ٥٠ و ٥٠٠٠ جنيه.'; }
  if (!d.modes.length) return 'اختار مكان تقديم الجلسات (بيت المريض أو عيادتك).';
  if (d.modes.indexOf('clinic') > -1 && d.clinicAddr.length < 5) return 'اكتب عنوان العيادة.';
  if (!d.cov.length) return 'اختار مدينة واحدة على الأقل.';
  if (!d.slots.length) return 'اختار ميعاد واحد على الأقل.';
  return '';
}
function renderDocBookings() {
  var box = $('#d-bookings'); box.textContent = '';
  if (!myDoc) { box.appendChild(el('p', 'empty', 'لسه مسجلتش بياناتك. افتح «بياناتي وصفحتي» الأول عشان المرضى يقدروا يحجزوا معاك.')); return; }
  if (!docBk.length) { box.appendChild(el('p', 'empty', 'لسه مفيش حجوزات. لما مريض يحجز معاك هتلاقي الطلب هنا.')); return; }
  var ord = { pending: 0, confirmed: 1, declined: 2, cancelled: 3 };
  docBk.slice().sort(function (a, b) { return (ord[a.status] - ord[b.status]) || String(a.day).localeCompare(String(b.day)); }).forEach(function (b) {
    var w = el('div', 'bk'), i = el('div');
    var h = el('b', null, b.name); h.appendChild(el('span', 'st ' + b.status, STATUS[b.status] || b.status)); i.appendChild(h);
    i.appendChild(el('small', null, b.typeName + ' · ' + whenLabel(b.day, b.slot)));
    i.appendChild(el('small', null, b.city + ' · ' + (b.mode === 'home' ? 'في البيت: ' + b.addr : 'في العيادة')));
    var ph = el('small', null, 'موبايل: '); ph.appendChild(el('span', 'ltr', b.phone)); i.appendChild(ph);
    i.appendChild(el('small', null, 'الإجمالي ' + fmt(b.total) + (b.count > 1 ? ' · ' + num(b.count) + ' جلسات' : '')));
    w.appendChild(i);
    var ac = el('div', 'acts');
    function btn(t, cls, act) { var x = el('button', 'mini ' + cls, t); x.type = 'button'; x.dataset.act = act; x.dataset.id = b.id; x.dataset.pid = b.patientId; ac.appendChild(x); }
    if (b.status === 'pending') { btn('تأكيد', 'good', 'confirm'); btn('اعتذار', 'bad', 'decline'); }
    if (b.status === 'confirmed') btn('إلغاء', 'bad', 'cancel');
    btn('راسل المريض', 'go', 'chat');
    w.appendChild(ac); box.appendChild(w);
  });
}
function updateCount() { var n = docBk.filter(function (b) { return b.status === 'pending'; }).length; $('#cnt-b').textContent = n ? num(n) : ''; }
async function setStatus(id, s) {
  try { await api('PATCH', '/bookings/' + id, { status: s }); await loadDocBk(); }
  catch (e) { flash(e.message); }
}
function renderConvList() {
  var box = $('#convlist'); box.textContent = '';
  if (!convs.length) { box.appendChild(el('p', 'empty', 'مفيش رسائل لسه. لما مريض يراسلك هتلاقي المحادثة هنا.')); return; }
  convs.forEach(function (c) {
    var b = el('button', 'conv'); b.type = 'button'; b.dataset.conv = c.id; b.setAttribute('aria-pressed', String(openConvId === c.id));
    b.appendChild(el('b', null, c.patientName));
    b.appendChild(el('small', null, (c.lastFrom === 'd' ? 'أنت: ' : '') + (c.lastText || '')));
    b.appendChild(el('small', null, c.lastAt ? dayStr(c.lastAt) + ' · ' + timeStr(c.lastAt) : ''));
    box.appendChild(b);
  });
}
function openConv(id) {
  openConvId = id;
  var pane = $('#convpane'); pane.textContent = ''; stopThread();
  var c = convs.filter(function (x) { return x.id === id; })[0];
  if (!c) { renderConvList(); return; }
  var card = el('div', 'card'); card.appendChild(el('h3', null, 'محادثة مع ' + c.patientName));
  var box = el('div', 'msgs'); box.setAttribute('role', 'log'); card.appendChild(box);
  chatForm(card, function (v) { sendMsg(id, v); });
  pane.appendChild(card);
  mountThread(box, id, 'd'); renderConvList();
}
function showDash(tab) {
  setView('dash');
  tab = tab || (myDoc ? 'bookings' : 'profile');
  dashTab = tab;
  document.querySelectorAll('#tabs a').forEach(function (a) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  ['profile', 'bookings', 'messages'].forEach(function (t) { $('#d-' + t).hidden = t !== tab; });
  if (tab === 'profile') buildDocForm();
  else if (tab === 'bookings') { renderDocBookings(); loadDocBk().catch(function () {}); }
  else {
    renderConvList();
    if (openConvId && convs.some(function (x) { return x.id === openConvId; })) openConv(openConvId);
    else if (convs.length) openConv(convs[0].id);
    else { openConvId = null; $('#convpane').textContent = ''; }
    loadConvs().catch(function () {});
  }
  updateCount();
}

/* ---------- auth ---------- */
function paintAuth() {
  var box = $('#authbox'); box.hidden = !authOpen; if (!authOpen) return;
  $('#authtitle').textContent = authMode === 'login' ? 'تسجيل الدخول' : (authRole === 'doctor' ? 'حساب طبيب جديد' : 'حساب جديد لحجز الجلسات');
  document.querySelectorAll('#authmode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === authMode)); });
  $('#af-name').hidden = authMode === 'login';
  $('#a-pass').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
  $('#asubmit').textContent = authMode === 'login' ? 'دخول' : (authRole === 'doctor' ? 'سجّل كطبيب' : 'سجّل حساب');
  var n = $('#authnote'); n.hidden = !authNote; n.textContent = authNote;
  $('#aerr').textContent = '';
}
function showWelcome() { setView('welcome'); paintAuth(); }
function pickRole(role) { authRole = role; authMode = 'signup'; authOpen = true; authNote = ''; paintAuth(); $('#authbox').scrollIntoView({ block: 'nearest' }); setTimeout(function () { var f = $(authMode === 'login' ? '#a-email' : '#a-name'); if (f) f.focus(); }, 50); }
async function submitAuth(e) {
  e.preventDefault();
  var err = $('#aerr'), btn = $('#asubmit'), name = $('#a-name').value.trim(), email = $('#a-email').value.trim(), pw = $('#a-pass').value;
  if (authMode === 'signup' && name.length < 2) { err.textContent = 'اكتب اسمك.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'اكتب إيميل صحيح.'; return; }
  if (authMode === 'signup' && pw.length < 8) { err.textContent = 'كلمة السر لازم تكون ٨ حروف أو أرقام على الأقل.'; return; }
  if (!pw) { err.textContent = 'اكتب كلمة السر.'; return; }
  err.textContent = ''; btn.disabled = true;
  try {
    var r = authMode === 'signup' ? await api('POST', '/auth/signup', { name: name, email: email, password: pw, role: authRole }) : await api('POST', '/auth/login', { email: email, password: pw });
    me = r.user; $('#a-pass').value = '';
    myDoc = null;
    if (me.role === 'doctor') { try { myDoc = (await api('GET', '/doctor/me')).doctor; } catch (x) { /* ignore */ } }
    await loadAll();
    var next = afterAuth; afterAuth = null; authOpen = false; authNote = '';
    var pn = $('#pname'); if (me.role === 'patient' && !pn.value) pn.value = me.name;
    go(me.role === 'doctor' ? 'dashboard' : (next === 'book' ? 'book' : 'book'));
  } catch (x) {
    err.textContent = x.message;
    if (x.code === 'exists') { authMode = 'login'; paintAuth(); $('#aerr').textContent = x.message; }
  }
  btn.disabled = false;
}
function sessionLost() { me = null; myDoc = null; myBk = []; docBk = []; convs = []; flash('انتهت جلستك. سجّل دخولك تاني.'); go('welcome'); }
async function logout() {
  try { await api('POST', '/auth/logout', {}); } catch (e) { /* ignore */ }
  me = null; myDoc = null; myBk = []; docBk = []; convs = []; openConvId = null; authOpen = false; authNote = '';
  go('welcome');
}

/* ---------- routing ---------- */
function renderUserbar() {
  var b = $('#userbar'); b.textContent = '';
  if (view === 'boot' || view === 'welcome') { b.hidden = true; return; }
  b.hidden = false;
  if (!me) {
    var a = el('a', null, 'دخول / حساب جديد'); a.href = '#welcome'; b.appendChild(a);
    var a2 = el('a', null, 'سجّل كطبيب'); a2.href = '#welcome'; a2.dataset.role = 'doctor'; b.appendChild(a2);
    return;
  }
  b.appendChild(el('span', 'who', me.name + ' · ' + (me.role === 'doctor' ? 'طبيب' : 'مريض')));
  var l = el('a', null, me.role === 'doctor' ? 'لوحتي' : 'الحجز'); l.href = me.role === 'doctor' ? '#dashboard' : '#book'; b.appendChild(l);
  var x = el('button', 'linkbtn', 'تسجيل الخروج'); x.type = 'button'; x.id = 'logout'; b.appendChild(x);
}
function setView(v) {
  view = v;
  $('#v-boot').hidden = v !== 'boot'; $('#v-welcome').hidden = v !== 'welcome'; $('#v-home').hidden = v !== 'home';
  $('#v-profile').hidden = v !== 'profile'; $('#v-dash').hidden = v !== 'dash';
  renderUserbar(); updateBar(); window.scrollTo(0, 0);
}
function showHome() {
  setView('home');
  var pn = $('#pname'); if (!pn.value && me && me.role === 'patient') pn.value = me.name || '';
  renderHome(); loadDoctors().catch(function () {}); if (st.doc) loadBusy();
  if (me) { loadMyBk().catch(function () {}); loadConvs().catch(function () {}); }
}
async function showProfileRoute(id, seq) {
  try {
    var r = await api('GET', '/doctors/' + id), d = norm(r.doctor);
    var rv = await api('GET', '/doctors/' + id + '/reviews');
    if (seq !== routeSeq) return;
    reviews = rv.reviews;
    if (me && me.role === 'patient') { try { await loadMyBk(); } catch (e) { /* ignore */ } }
    if (seq !== routeSeq) return;
    renderProfile(d);
  } catch (e) {
    if (seq !== routeSeq) return;
    setView('profile'); curDoc = null;
    var bx = $('#v-profile'); bx.textContent = '';
    bx.appendChild(el('p', 'empty', e.status === 404 ? 'الدكتور ده مش متاح دلوقتي.' : e.message));
    var a = el('a', 'plink', 'رجوع'); a.href = me && me.role === 'doctor' ? '#dashboard' : '#book'; bx.appendChild(a);
  }
}
function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
function route() {
  if (!ready) return;
  stopThread(); var seq = ++routeSeq;
  var h = location.hash.replace(/^#/, ''), m;
  if (h === 'welcome') return showWelcome();
  if ((m = /^doctor-(\d+)$/.exec(h))) { curDoc = null; return showProfileRoute(m[1], seq); }
  if (/^dashboard/.test(h)) {
    if (me && me.role === 'doctor') return showDash((/^dashboard-(profile|bookings|messages)$/.exec(h) || [])[1]);
    return me ? showHome() : showWelcome();
  }
  if (h === 'book') return showHome();
  if (!me) return showWelcome();
  if (me.role === 'doctor') return showDash();
  return showHome();
}

/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var link = e.target.closest('a[data-role]');
  if (link) { authRole = link.dataset.role; authMode = 'signup'; authOpen = true; authNote = ''; }
  var t = e.target.closest('button'); if (!t) return;
  if (t.closest('#types')) { st.type = t.dataset.id; st.time = null; fixDoc(); renderHome(); }
  else if (t.closest('#mode')) { st.mode = t.dataset.id; fixDoc(); renderHome(); }
  else if (t.closest('#docs') && t.dataset.id) { setDoc(t.dataset.id); renderHome(); }
  else if (t.closest('#dates')) {
    st.date = t.dataset.key;
    if (st.time && (slotList(st.doc ? findDoctor(st.doc) : null).every(function (s) { return s.k !== st.time; }) || slotTaken(slotByKey(st.time)))) st.time = null;
    renderDates(); renderSlots(); renderSummary();
  }
  else if (t.closest('#slots') && !t.disabled) { st.time = t.dataset.t; renderSlots(); renderSummary(); }
  else if (t.id === 'book') { book(); }
  else if (t.id === 'again') { $('#donebox').hidden = true; $('#sumcard').hidden = false; updateBar(); }
  else if (t.dataset.cancel) { cancelBooking(t.dataset.cancel); }
  else if (t.id === 'role-patient') { pickRole('patient'); }
  else if (t.id === 'role-doctor') { pickRole('doctor'); }
  else if (t.closest('#authmode')) { authMode = t.dataset.m; paintAuth(); }
  else if (t.id === 'logout') { logout(); }
  else if (t.dataset.act === 'confirm') { setStatus(t.dataset.id, 'confirmed'); }
  else if (t.dataset.act === 'decline') { setStatus(t.dataset.id, 'declined'); }
  else if (t.dataset.act === 'cancel') { setStatus(t.dataset.id, 'cancelled'); }
  else if (t.dataset.act === 'chat') {
    var c = convs.filter(function (x) { return x.patientId === t.dataset.pid; })[0];
    if (!c) { flash('المريض لسه مبعتش رسالة. هتقدر ترد عليه أول ما يراسلك.'); return; }
    openConvId = c.id; go('dashboard-messages');
  }
  else if (t.dataset.conv) { openConv(t.dataset.conv); }
  else if (t.dataset.star) {
    rvStars = parseInt(t.dataset.star, 10);
    t.parentNode.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(parseInt(b.dataset.star, 10) <= rvStars)); });
  }
});
$('#city').addEventListener('change', function (e) { st.city = e.target.value; st.time = null; fixDoc(); renderHome(); });
$('#count').addEventListener('change', function (e) { st.count = parseInt(e.target.value, 10); renderSummary(); });
$('#authbox').addEventListener('submit', submitAuth);
$('#browse').addEventListener('click', function () { authOpen = false; });
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
setInterval(tick, 5000);
setInterval(pollThread, 3000);

/* ---------- start ---------- */
async function init() {
  var sel = $('#city'); CITIES.forEach(function (c) { var o = el('option', null, c); o.value = c; sel.appendChild(o); }); sel.value = st.city;
  try {
    var r = await api('GET', '/me'); me = r.user;
    if (me && me.role === 'doctor') { try { myDoc = (await api('GET', '/doctor/me')).doctor; } catch (e) { /* ignore */ } }
  } catch (e) { me = null; }
  await loadAll();
  ready = true; route();
}
init();
})();
