/* Stackly portal core: data store, auth, UI helpers and the dashboard shell.
   DEMO ONLY. Everything runs in the browser and saves to localStorage, so it is not secure.
   Replace Auth.login() and the DB object with calls to your real backend before going live. */
(function (w) {
  'use strict';
  var KEY = 'stackly_db_v1', SKEY = 'stackly_session_v1';
  var LOGO = 'https://wsrv.nl/?url=https://snabsolutions.in/wp-content/uploads/2026/02/stackly-snab-solutions.png&w=280&output=webp&q=85&fit=cover';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- safe storage ---------- */
  function store(kind) { try { return w[kind]; } catch (e) { return null; } }
  function sget(kind, k) { try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function sset(kind, k, v) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (e) {} }
  function storageOk() { try { var t = w.localStorage; t.setItem('__stackly_t', '1'); t.removeItem('__stackly_t'); return true; } catch (e) { return false; } }
  function sdel(kind, k) { try { var s = store(kind); if (s) s.removeItem(k); } catch (e) {} }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
  function pd(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d); }
  function fdate(d) { var x = pd(d); return isNaN(x) ? esc(d) : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function ftime(t) { return new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 7).toUpperCase(); }
  function initials(n) { return String(n || '?').split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase(); }
  function isoDays(n) { return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); }
  function nextNum(list, prefix, start) {
    var max = start || 0;
    list.forEach(function (x) { var n = parseInt(String(x.id).replace(prefix, ''), 10); if (n > max) max = n; });
    return prefix + (max + 1);
  }
  function download(name, text, mime) {
    var b = new Blob([text], { type: mime || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        c = String(c == null ? '' : c);
        if (/^[=+\-@]/.test(c)) c = "'" + c;
        return '"' + c.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');
  }
  function copyText(t) {
    if (w.navigator && navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } ta.remove();
    });
  }
  function monthLabels(n) {
    var out = [], d = new Date();
    for (var i = n - 1; i >= 0; i--) out.push(new Date(d.getFullYear(), d.getMonth() - i, 1).toLocaleDateString('en-GB', { month: 'short' }));
    return out;
  }

  /* ---------- data store ---------- */
  var mem = null;
  function seed() {
    var now = Date.now(), P = 'Client@123';
    var ms = function (done) { return ['Discovery', 'UI design', 'Core build', 'Testing', 'Store launch'].map(function (t, i) { return { t: t, done: i < done }; }); };
    return {
      users: {
        client01: { role: 'client', name: 'Aarav Mehta', email: 'aarav@northwind.example', company: 'Northwind Pay', password: P, status: 'active', joined: isoDays(-210) },
        client02: { role: 'client', name: 'Priya Shah', email: 'priya@cartwheel.example', company: 'Cartwheel', password: P, status: 'active', joined: isoDays(-150) },
        client03: { role: 'client', name: 'Daniel Rao', email: 'daniel@kineticfleet.example', company: 'Kinetic Fleet', password: P, status: 'active', joined: isoDays(-95) },
        client04: { role: 'client', name: 'Meera Iyer', email: 'meera@lumen.example', company: 'Lumen Health', password: P, status: 'active', joined: isoDays(-40) },
        admin01: { role: 'admin', name: 'Rohan Kapoor', email: 'rohan@stackly.example', company: 'Stackly', password: 'Admin@123', status: 'active', joined: isoDays(-900) }
      },
      projects: [
        { id: 'P-101', clientId: 'client01', name: 'Northwind wallet app', platform: 'iOS + Android', status: 'In progress', progress: 60, due: isoDays(46), budget: '$25k to $50k', brief: 'Mobile wallet with biometric login and instant card controls.', milestones: ms(3) },
        { id: 'P-102', clientId: 'client01', name: 'Merchant dashboard', platform: 'Web + Mobile', status: 'Testing', progress: 80, due: isoDays(18), budget: '$10k to $25k', brief: 'Sales and payout dashboard for merchants.', milestones: ms(4) },
        { id: 'P-103', clientId: 'client02', name: 'Cartwheel loyalty app', platform: 'iOS + Android', status: 'In progress', progress: 40, due: isoDays(70), budget: '$25k to $50k', brief: 'Points, rewards and in-store QR scanning.', milestones: ms(2) },
        { id: 'P-104', clientId: 'client03', name: 'Driver dispatch app', platform: 'Android', status: 'In progress', progress: 20, due: isoDays(95), budget: '$10k to $25k', brief: 'Route assignment and proof of delivery.', milestones: ms(1) },
        { id: 'P-105', clientId: 'client04', name: 'Care plans app', platform: 'iOS', status: 'Completed', progress: 100, due: isoDays(-12), budget: '$10k to $25k', brief: 'Appointment booking and care plans.', milestones: ms(5) }
      ],
      invoices: [
        { id: 'INV-2041', clientId: 'client01', desc: 'Wallet app, milestone 2', amount: 8500, due: isoDays(-20), status: 'Paid' },
        { id: 'INV-2042', clientId: 'client01', desc: 'Wallet app, milestone 3', amount: 6500, due: isoDays(10), status: 'Pending' },
        { id: 'INV-2043', clientId: 'client02', desc: 'Loyalty app, design phase', amount: 4200, due: isoDays(5), status: 'Pending' },
        { id: 'INV-2044', clientId: 'client03', desc: 'Dispatch app, discovery', amount: 3000, due: isoDays(-8), status: 'Paid' },
        { id: 'INV-2045', clientId: 'client04', desc: 'Care plans app, final payment', amount: 7200, due: isoDays(-15), status: 'Paid' },
        { id: 'INV-2046', clientId: 'client01', desc: 'Merchant dashboard, build phase', amount: 5200, due: isoDays(20), status: 'Pending' }
      ],
      tickets: [
        { id: 'T-301', clientId: 'client01', subject: 'Push notification timing', priority: 'Medium', status: 'Open', msg: 'Reminders arrive an hour late on some Android phones.', created: now - 864e5 * 2, replies: [] },
        { id: 'T-302', clientId: 'client02', subject: 'Update brand colours', priority: 'Low', status: 'In progress', msg: 'Please apply our new brand palette to the loyalty app.', created: now - 864e5 * 4, replies: [{ from: 'admin', name: 'Rohan Kapoor', text: 'We have updated the palette in Figma and will ship it this sprint.', at: now - 864e5 * 3 }] },
        { id: 'T-303', clientId: 'client03', subject: 'Login bug on Android 12', priority: 'High', status: 'Open', msg: 'Some drivers cannot sign in after the latest update.', created: now - 36e5 * 9, replies: [] }
      ],
      messages: {
        client01: [
          { from: 'team', name: 'Neha S.', text: 'Hi Aarav, the latest wallet build is on TestFlight.', at: now - 864e5 },
          { from: 'client', text: 'Thanks, testing it now.', at: now - 864e5 + 36e5 }
        ]
      },
      notes: {
        client01: [
          { id: 'n1', text: 'Milestone "UI design" was approved.', read: false, at: now - 36e5 },
          { id: 'n2', text: 'Invoice INV-2042 is due in 10 days.', read: false, at: now - 5 * 36e5 }
        ],
        admin01: [{ id: 'n3', text: 'Daniel Rao opened ticket T-303.', read: false, at: now - 2 * 36e5 }]
      },
      prefs: {
        client01: { email: true, sms: false, weekly: true },
        admin01: { alerts: true, signups: true, maintenance: false }
      },
      revenue: { m6: [18, 22, 19, 27, 31, 36], m12: [12, 14, 13, 16, 15, 18, 18, 22, 19, 27, 31, 36] },
      velocity: { w4: [3, 5, 4, 6], w8: [2, 4, 3, 5, 3, 5, 4, 6] }
    };
  }
  var DB = {
    get: function () {
      var raw = sget('localStorage', KEY);
      if (raw) { try { return JSON.parse(raw); } catch (e) {} }
      if (mem) return JSON.parse(JSON.stringify(mem));
      var d = seed(); DB.save(d); return d;
    },
    save: function (d) { mem = d; sset('localStorage', KEY, JSON.stringify(d)); },
    reset: function () { var d = seed(); DB.save(d); return d; }
  };
  function notify(userId, text) {
    var d = DB.get(); d.notes = d.notes || {};
    (d.notes[userId] = d.notes[userId] || []).unshift({ id: uid('n'), text: text, read: false, at: Date.now() });
    d.notes[userId] = d.notes[userId].slice(0, 30); DB.save(d);
  }
  function notifyAdmins(text) {
    var d = DB.get();
    Object.keys(d.users).forEach(function (k) { if (d.users[k].role === 'admin') notify(k, text); });
  }

  /* ---------- auth ---------- */
  var NAMEKEY = 'stackly_sess:';
  function nameGet() { try { var n = w.name || ''; return n.indexOf(NAMEKEY) === 0 ? n.slice(NAMEKEY.length) : null; } catch (e) { return null; } }
  function nameSet(v) { try { w.name = NAMEKEY + v; } catch (e) {} }
  function nameClear() { try { if ((w.name || '').indexOf(NAMEKEY) === 0) w.name = ''; } catch (e) {} }
  var Auth = {
    session: function () {
      var raw = sget('sessionStorage', SKEY) || sget('localStorage', SKEY) || nameGet();
      if (!raw) return null;
      try {
        var s = JSON.parse(raw), dbx = DB.get(), users = dbx.users;
        /* Storage blocked: the new account only exists in the session snapshot, so restore it for this page. */
        if (!Object.prototype.hasOwnProperty.call(users, s.id) && s.u && !storageOk()) { users[s.id] = s.u; DB.save(dbx); }
        if (!Object.prototype.hasOwnProperty.call(users, s.id)) return null;
        var u = users[s.id];
        if (u.status !== 'active' || u.role !== s.role) return null;
        return s;
      } catch (e) { return null; }
    },
    /* Demo auth: any email and any password signs in. The Client / Admin choice decides the role.
       Replace this function with a real backend call before going live. */
    login: function (ident, pw, role, remember) {
      ident = String(ident || '').trim().toLowerCase();
      if (!ident) return { ok: false, error: 'Enter your email address.' };
      if (!pw) return { ok: false, error: 'Enter a password.' };
      var db = DB.get(), users = db.users, key = null, created = false;
      if (Object.prototype.hasOwnProperty.call(users, ident) && users[ident].role === role) key = ident;
      if (!key) key = Object.keys(users).filter(function (k) { return users[k].role === role && String(users[k].email || '').toLowerCase() === ident; })[0] || null;
      if (!key) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ident)) return { ok: false, error: 'Enter a valid email address, like you@company.com.' };
        key = Object.prototype.hasOwnProperty.call(users, ident) ? role + ':' + ident : ident;
        var local = ident.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || 'New user';
        users[key] = { role: role, name: local, email: ident, company: '', password: pw, status: 'active', joined: isoDays(0) };
        created = true;
      }
      var u = users[key];
      if (u.status !== 'active') return { ok: false, error: 'This account is suspended. Please contact Stackly support.' };
      u.password = pw; u.prevLogin = u.lastLogin || null; u.lastLogin = Date.now();
      DB.save(db);
      if (created) {
        notify(key, 'Welcome to Stackly. Your ' + (role === 'admin' ? 'admin console' : 'client portal') + ' is ready.');
        if (role === 'client') notifyAdmins('New client signed in for the first time: ' + u.email + '.');
      }
      sdel('sessionStorage', SKEY); sdel('localStorage', SKEY); nameClear();
      var val = JSON.stringify({ id: key, role: role, at: Date.now(), u: u }), kind = remember ? 'localStorage' : 'sessionStorage';
      sset(kind, SKEY, val);
      /* If the browser blocked storage, keep the session in window.name so it still survives the redirect. */
      if (sget(kind, SKEY) !== val) nameSet(val);
      sset('localStorage', 'stackly_last_email', ident);
      return { ok: true, id: key, role: role };
    },
    logout: function () { sdel('sessionStorage', SKEY); sdel('localStorage', SKEY); nameClear(); },
    homeFor: function (role) { return role === 'admin' ? 'admin-dashboard.html' : 'client-dashboard.html'; },
    guard: function (role) {
      var s = Auth.session();
      if (!s || s.role !== role) { location.replace('login.html?role=' + role + (s ? '&msg=wrongrole' : '&msg=signin')); return null; }
      return { id: s.id, user: DB.get().users[s.id] };
    }
  };

  /* ---------- toasts and modals ---------- */
  function ensureRoots() {
    if (!$('#modal-root')) { var m = document.createElement('div'); m.id = 'modal-root'; document.body.appendChild(m); }
    if (!$('#toasts')) { var t = document.createElement('div'); t.id = 'toasts'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  }
  function toast(msg, type) {
    ensureRoots();
    var t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 3400);
  }
  var stack = [];
  function modal(o) {
    ensureRoots();
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    var m = document.createElement('div'); m.className = 'modal' + (o.wide ? ' wide' : '');
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', o.title);
    m.innerHTML = '<div class="m-head"><h3>' + esc(o.title) + '</h3><button type="button" class="m-x" aria-label="Close">&times;</button></div><div class="m-body"></div><div class="m-foot"></div>';
    var body = $('.m-body', m), foot = $('.m-foot', m), prev = document.activeElement, closed = false, primary = null;
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === bg) close(); }
    function close() {
      if (closed) return; closed = true;
      stack.splice(stack.indexOf(bg), 1); document.removeEventListener('keydown', onKey);
      bg.classList.add('out');
      setTimeout(function () { bg.remove(); if (prev && prev.focus) { try { prev.focus(); } catch (e) {} } }, 180);
      if (o.onClose) o.onClose();
    }
    (o.actions || []).forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + (a.cls || 'btn-ghost'); b.textContent = a.label;
      if (a.primary) primary = b;
      b.addEventListener('click', function () { var r = a.onClick ? a.onClick(close, m) : undefined; if (r !== false) close(); });
      foot.appendChild(b);
    });
    if (!(o.actions || []).length) foot.hidden = true;
    $('.m-x', m).addEventListener('click', close);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    m.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && primary && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') { e.preventDefault(); primary.click(); }
    });
    bg.appendChild(m); $('#modal-root').appendChild(bg); stack.push(bg); document.addEventListener('keydown', onKey);
    var first = $('input:not([type=hidden]),select,textarea', m);
    setTimeout(function () { (first || $('.m-x', m)).focus(); }, 30);
    if (o.onOpen) o.onOpen(m, close);
    return { close: close, el: m };
  }
  function confirmBox(msg, label, danger) {
    return new Promise(function (res) {
      var done = false;
      modal({
        title: 'Please confirm', body: '<p class="m-msg">' + esc(msg) + '</p>',
        actions: [
          { label: 'Cancel', onClick: function () { done = true; res(false); } },
          { label: label || 'Confirm', cls: danger ? 'btn-danger' : 'btn-gold', primary: true, onClick: function () { done = true; res(true); } }
        ],
        onClose: function () { if (!done) res(false); }
      });
    });
  }

  /* ---------- tiny charts ---------- */
  function chart(el, labels, vals, unit, suffix) {
    var max = Math.max.apply(null, vals.concat([1]));
    el.innerHTML = vals.map(function (v, i) {
      return '<div class="col" title="' + esc(labels[i]) + ': ' + esc(unit || '') + v + esc(suffix || '') + '"><span class="cv">' + esc(unit || '') + v + esc(suffix || '') + '</span><i style="--h:' + Math.max(6, Math.round(v / max * 100)) + '%"></i><span class="cl">' + esc(labels[i]) + '</span></div>';
    }).join('');
  }

  /* ---------- dashboard shell ---------- */
  var IC = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2M12 17v.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 5a3.5 3.5 0 010 6M18 14a6 6 0 013.5 6"/>',
    bell: '<path d="M6 17v-6a6 6 0 1112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    chev: '<path d="M6 9l6 6 6-6"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>'; }

  var Shell = {}, cfg, cur, who;
  function me() { return DB.get().users[who.id]; }
  function mail() { var u = me(); return (u && u.email) || who.id; }
  function drawNav() {
    var badges = cfg.badges ? cfg.badges() : {};
    $('#nav').innerHTML = cfg.nav.map(function (n) {
      var c = badges[n.id];
      return '<a href="#' + n.id + '" class="nav-i' + (n.id === cur ? ' active' : '') + '" data-view="' + n.id + '"' + (n.id === cur ? ' aria-current="page"' : '') + '>' + svg(n.icon) + '<span>' + esc(n.label) + '</span>' + (c ? '<em class="count">' + c + '</em>' : '') + '</a>';
    }).join('');
  }
  function drawFoot() {
    var u = me();
    $('#sideMe').innerHTML = '<span class="av sm">' + esc(initials(u.name)) + '</span><div class="pm"><b>' + esc(u.name) + '</b><small title="' + esc(mail()) + '">' + esc(mail()) + '</small></div>';
  }
  function drawTop() {
    var open = $$('.dd', $('#topR')).map(function (d) { return d.classList.contains('open'); });
    var u = me(), notes = (DB.get().notes || {})[who.id] || [], unread = notes.filter(function (n) { return !n.read; }).length;
    var last = u.prevLogin ? ftime(u.prevLogin) : 'First login';
    $('#topR').innerHTML =
      '<div class="dd"><button type="button" class="dd-btn bell" aria-haspopup="true" aria-expanded="false" aria-label="Notifications' + (unread ? ', ' + unread + ' unread' : '') + '">' + svg('bell') + (unread ? '<em class="dot">' + unread + '</em>' : '') + '</button>' +
      '<div class="dd-panel nts"><div class="dd-title"><b>Notifications</b><button type="button" class="link-btn" data-readall>Mark all read</button></div>' +
      (notes.length ? notes.map(function (n) { return '<button type="button" class="nt' + (n.read ? '' : ' unread') + '" data-note="' + esc(n.id) + '">' + esc(n.text) + '<small>' + ftime(n.at) + '</small></button>'; }).join('') : '<p class="muted pad">You are all caught up.</p>') + '</div></div>' +
      '<div class="dd"><button type="button" class="dd-btn prof" aria-haspopup="true" aria-expanded="false"><span class="av sm">' + esc(initials(u.name)) + '</span><span class="pm"><b>' + esc(u.name) + '</b><small>' + esc(mail()) + '</small></span>' + svg('chev') + '</button>' +
      '<div class="dd-panel"><div class="pp-head"><span class="av">' + esc(initials(u.name)) + '</span><div><b>' + esc(u.name) + '</b><small>' + (cfg.role === 'admin' ? 'Administrator' : 'Client account') + '</small></div></div>' +
      '<div class="kv"><span>Email</span><b title="' + esc(mail()) + '">' + esc(mail()) + '</b><button type="button" class="btn-line btn-xs" data-copy-id>Copy</button></div>' +
      '<div class="kv"><span>Role</span><b>' + (cfg.role === 'admin' ? 'Admin' : 'Client') + '</b></div>' +
      '<div class="kv"><span>Last login</span><b>' + esc(last) + '</b></div>' +
      '<a class="dd-link" href="#settings">Settings</a><button type="button" class="dd-link danger" data-logout>Log out</button></div></div>';
    $$('.dd', $('#topR')).forEach(function (d, i) { if (open[i]) { d.classList.add('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'true'); } });
  }
  function drawChrome() { drawNav(); drawFoot(); drawTop(); }
  function applySearch() {
    var q = $('#q').value.trim().toLowerCase(), items = $$('#content .s-item'), shown = 0;
    items.forEach(function (i) { var hit = !q || i.textContent.toLowerCase().indexOf(q) !== -1; i.hidden = !hit; if (hit) shown++; });
    var nr = $('#noRes'); if (nr) nr.hidden = !(q && items.length && !shown);
  }
  function paint() {
    var c = $('#content'); c.innerHTML = '';
    var sec = document.createElement('section'); sec.className = 'view'; c.appendChild(sec);
    cfg.views[cur].render(sec);
    var nr = document.createElement('p'); nr.id = 'noRes'; nr.className = 'muted center pad'; nr.hidden = true; nr.textContent = 'Nothing on this page matches your search.'; c.appendChild(nr);
  }
  function route() {
    var h = (location.hash || '#overview').slice(1);
    cur = cfg.views[h] ? h : 'overview';
    $('#viewTitle').textContent = cfg.views[cur].title;
    document.title = cfg.views[cur].title + ' | Stackly ' + (cfg.role === 'admin' ? 'Admin' : 'Portal');
    $('#q').value = '';
    paint(); drawChrome();
    document.body.classList.remove('nav-open'); w.scrollTo(0, 0);
  }
  Shell.rerender = function () { var y = w.scrollY; paint(); applySearch(); drawChrome(); w.scrollTo(0, y); };
  Shell.refresh = drawChrome;
  Shell.go = function (id) { if (location.hash === '#' + id) route(); else location.hash = '#' + id; };

  Shell.mount = function (c) {
    cfg = c; who = Auth.guard(c.role); if (!who) return;
    var root = $('#app'); ensureRoots();
    root.innerHTML =
      '<div class="app"><aside class="side" id="side" aria-label="Sidebar">' +
      '<a class="logo" href="index.html" aria-label="Stackly website"><img src="' + LOGO + '" height="44" alt="Stackly"></a>' +
      '<div class="role-tag">' + (c.role === 'admin' ? 'Admin console' : 'Client portal') + '</div>' +
      '<nav class="side-nav" id="nav" aria-label="Dashboard"></nav>' +
      '<div class="side-foot"><div class="me" id="sideMe"></div><button type="button" class="btn btn-ghost btn-sm" data-logout>Log out</button><a class="site-link" href="index.html">Back to website</a></div></aside>' +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="main"><header class="top"><button type="button" class="burger" id="burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '<h1 id="viewTitle">Overview</h1>' +
      '<label class="search">' + svg('search') + '<input id="q" type="search" placeholder="Search this page" aria-label="Search this page" autocomplete="off"></label>' +
      '<div class="top-r" id="topR"></div></header><main class="content" id="content" tabindex="-1"></main></div></div>';
    $('#burger').addEventListener('click', function () {
      var o = document.body.classList.toggle('nav-open'); this.classList.toggle('open', o); this.setAttribute('aria-expanded', o);
    });
    $('#scrim').addEventListener('click', function () { document.body.classList.remove('nav-open'); $('#burger').classList.remove('open'); });
    $('#q').addEventListener('input', applySearch);
    $('#nav').addEventListener('click', function () { document.body.classList.remove('nav-open'); $('#burger').classList.remove('open'); });
    document.addEventListener('click', function (e) {
      var t = e.target, btn = t.closest('.dd-btn');
      $$('.dd').forEach(function (d) { if (!btn || d !== btn.parentNode) { d.classList.remove('open'); var b = $('.dd-btn', d); if (b) b.setAttribute('aria-expanded', 'false'); } });
      if (btn) { var o = btn.parentNode.classList.toggle('open'); btn.setAttribute('aria-expanded', o); return; }
      if (t.closest('[data-logout]')) { Auth.logout(); location.href = 'login.html?msg=out'; return; }
      if (t.closest('[data-copy-id]')) { copyText(mail()).then(function () { toast('Email copied'); }, function () { toast('Copy failed. Select the ID and copy it manually.', 'bad'); }); return; }
      if (t.closest('[data-readall]')) {
        var d = DB.get(); (d.notes[who.id] || []).forEach(function (n) { n.read = true; }); DB.save(d); drawTop(); return;
      }
      var nt = t.closest('[data-note]');
      if (nt) { var d2 = DB.get(); (d2.notes[who.id] || []).forEach(function (n) { if (n.id === nt.dataset.note) n.read = true; }); DB.save(d2); drawTop(); }
      if (t.closest('.dd-link[href]')) { $$('.dd').forEach(function (d3) { d3.classList.remove('open'); }); }
    });
    w.addEventListener('hashchange', route);
    route();
  };

  w.App = { $: $, $$: $$, esc: esc, money: money, fdate: fdate, ftime: ftime, uid: uid, initials: initials, isoDays: isoDays, nextNum: nextNum, monthLabels: monthLabels,
    download: download, csv: csv, copyText: copyText, DB: DB, Auth: Auth, notify: notify, notifyAdmins: notifyAdmins, toast: toast, modal: modal, confirmBox: confirmBox,
    chart: chart, Shell: Shell, mail: function (id) { var u = DB.get().users[id]; return (u && u.email) || id; }, slug: function (t) { return String(t).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }, LOGO: LOGO, statuses: ['In review', 'In progress', 'Testing', 'Completed', 'On hold'] };
  if (document.readyState !== 'loading') ensureRoots(); else document.addEventListener('DOMContentLoaded', ensureRoots);
})(window);