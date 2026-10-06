/* Login page: Client / Admin switch, any-email demo login, remember me, forgot password.
   Demo auth only (see app.js). The tabs are wired first and use no other script, so they always respond. */
(function () {
  'use strict';
  var doc = document;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  var form = $('#loginForm');
  if (!form) return;

  var COPY = {
    client: { title: 'Client login', sub: 'Track your projects, invoices and messages.', btn: 'Sign in as client', sample: 'client@example.com' },
    admin: { title: 'Admin login', sub: 'Manage clients, projects, invoices and support tickets.', btn: 'Sign in as admin', sample: 'admin@example.com' }
  };
  var role = 'client', busy = false, params = new URLSearchParams(location.search);

  function showErr(msg) {
    var e = $('#lerr'); e.textContent = msg; e.classList.add('show');
    var card = $('.auth-card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
  function clearErr() { $('#lerr').classList.remove('show'); }
  function setRole(r) {
    role = r; var c = COPY[r];
    $('#seg').setAttribute('data-role', r);
    $$('#seg button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.role === r)); });
    $('#title').textContent = c.title; $('#sub').textContent = c.sub; $('#lbtn').textContent = c.btn;
    clearErr();
  }

  /* 1. Tabs: no dependency on app.js */
  $$('#seg button').forEach(function (b) {
    b.addEventListener('click', function () { setRole(b.dataset.role); $('#lid').focus(); });
  });
  var want = params.get('role');
  setRole(want === 'admin' ? 'admin' : 'client');
  $('#toggle').addEventListener('click', function () {
    var p = $('#lpw'), show = p.type === 'password';
    p.type = show ? 'text' : 'password'; this.textContent = show ? 'Hide' : 'Show'; this.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  $('#useDemo').addEventListener('click', function () {
    $('#lid').value = COPY[role].sample; $('#lpw').value = 'demo1234'; clearErr(); $('#lbtn').focus();
  });

  /* 2. Everything else needs app.js */
  var A = window.App;
  if (!A) {
    form.addEventListener('submit', function (e) { e.preventDefault(); showErr('The login script did not load. Make sure assets/js/app.js is in the same folder structure as login.html.'); });
    $('#forgot').addEventListener('click', function () { showErr('The login script did not load. Make sure assets/js/app.js is in place.'); });
    return;
  }
  var esc = A.esc;

  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (busy) return; clearErr();
    var email = $('#lid').value.trim(), pw = $('#lpw').value;
    if (!email) { showErr('Enter your email address.'); $('#lid').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Enter a valid email address, like you@company.com.'); $('#lid').focus(); return; }
    if (!pw) { showErr('Enter a password.'); $('#lpw').focus(); return; }
    busy = true; var btn = $('#lbtn'), label = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Signing in';
    setTimeout(function () {
      var r = A.Auth.login(email, pw, role, $('#remember').checked);
      if (!r.ok) { busy = false; btn.disabled = false; btn.textContent = label; showErr(r.error); return; }
      var dest = A.Auth.homeFor(r.role);
      btn.innerHTML = 'Signed in. Opening your ' + (r.role === 'admin' ? 'admin' : 'client') + ' dashboard';
      setTimeout(function () { location.replace(dest); }, 350);
      setTimeout(function () {
        var i = $('#linfo'); i.innerHTML = 'Signed in as ' + esc(email) + '. If the dashboard does not open, <a class="link-btn" href="' + dest + '">click here to continue</a>.'; i.classList.add('show');
      }, 2500);
    }, 450);
  });

  $('#forgot').addEventListener('click', function () {
    A.modal({
      title: 'Reset your password',
      body: '<p class="m-msg">Enter your email address. If an account exists, we will send a reset link.</p><div class="field"><label for="fid">Email address</label><input id="fid" type="email" autocapitalize="none" spellcheck="false" placeholder="you@company.com"></div><p class="m-msg" id="fmsg" hidden></p>',
      actions: [
        { label: 'Close' },
        {
          label: 'Send reset link', cls: 'btn-gold', primary: true,
          onClick: function (close, m) {
            var v = A.$('#fid', m).value.trim(), msg = A.$('#fmsg', m);
            msg.hidden = false;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { msg.textContent = 'Enter a valid email address first.'; return false; }
            msg.textContent = 'If ' + v + ' has an account, a reset link is on its way. (Demo: no email is actually sent.)';
            A.toast('Reset request sent');
            return false;
          }
        }
      ]
    });
  });

  /* 3. Messages, remembered email and existing session */
  var msg = params.get('msg'), info = $('#linfo');
  if (msg === 'out') { info.textContent = 'You have been signed out.'; info.classList.add('show'); }
  if (msg === 'created') { info.textContent = 'Account created. Sign in with your new email and password.'; info.classList.add('show'); }
  if (msg === 'signin') { info.textContent = 'Please sign in to open your dashboard.'; info.classList.add('show'); }
  if (msg === 'wrongrole') { showErr('That dashboard needs a different account type. Choose Client or Admin below and sign in again.'); }

  try { var last = localStorage.getItem('stackly_last_email'); if (last && !$('#lid').value) $('#lid').value = last; } catch (e) {}

  var s = A.Auth.session();
  if (s && !msg) { location.replace(A.Auth.homeFor(s.role)); return; }
  if (s && msg !== 'out') {
    var box = $('#signed'); box.hidden = false; box.classList.add('show');
    box.innerHTML = 'You are signed in as <b>' + esc(A.mail(s.id)) + '</b> (' + esc(s.role) + '). <a class="link-btn" href="' + A.Auth.homeFor(s.role) + '">Go to dashboard</a> or <button type="button" class="link-btn" id="outBtn">log out</button>.';
    $('#outBtn').addEventListener('click', function () { A.Auth.logout(); box.hidden = true; box.classList.remove('show'); A.toast('Signed out'); });
  }
})();