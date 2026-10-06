/* Sign up page: creates a client account in the demo store, then redirects to login.html.
   Demo only (see app.js). Replace createAccount() with a real backend call before going live. */
(function () {
  'use strict';
  var doc = document;
  function $(s, c) { return (c || doc).querySelector(s); }
  var form = $('#signupForm');
  if (!form) return;
  var busy = false, A = window.App;

  function showErr(msg, focusId) {
    var e = $('#serr'); e.textContent = msg; e.classList.add('show');
    var card = $('.auth-card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    if (focusId) $(focusId).focus();
  }
  function clearErr() { $('#serr').classList.remove('show'); }

  function toggle(btnId, inputId) {
    $(btnId).addEventListener('click', function () {
      var p = $(inputId), show = p.type === 'password';
      p.type = show ? 'text' : 'password'; this.textContent = show ? 'Hide' : 'Show';
      this.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }
  toggle('#tg1', '#spw'); toggle('#tg2', '#spc');

  /* Phone: digits only, 10 digits starting 6 to 9 */
  $('#sp').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 10); });

  /* Password strength meter */
  var LABELS = ['Use 8+ characters with letters and numbers.', 'Weak', 'Fair', 'Good', 'Strong'];
  function score(p) {
    if (!p) return 0;
    var s = 0;
    if (p.length >= 8) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
    return Math.max(1, s);
  }
  $('#spw').addEventListener('input', function () {
    var n = this.value ? score(this.value) : 0;
    $('#meter').setAttribute('data-s', n); $('#mtxt').textContent = LABELS[n];
  });

  if (!A) {
    form.addEventListener('submit', function (e) { e.preventDefault(); showErr('The sign up script did not load. Make sure assets/app.js is in the assets folder.'); });
    return;
  }

  function createAccount(d) {
    var db = A.DB.get(), users = db.users, email = d.email.toLowerCase();
    var exists = Object.keys(users).some(function (k) {
      return k.toLowerCase() === email || String(users[k].email || '').toLowerCase() === email;
    });
    if (exists) return { ok: false, error: 'An account with this email already exists. Please sign in instead.' };
    users[email] = {
      role: 'client', name: d.name, email: email, company: d.company, phone: d.phone,
      password: d.password, status: 'active', joined: new Date().toISOString().slice(0, 10)
    };
    A.DB.save(db);
    A.notify(email, 'Welcome to Stackly, ' + d.name.split(' ')[0] + '. Your client portal is ready.');
    A.notifyAdmins('New client signed up: ' + email + '.');
    try { localStorage.setItem('stackly_last_email', email); } catch (e) {}
    return { ok: true };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (busy) return; clearErr();
    var name = $('#sn').value.trim().replace(/\s+/g, ' '), company = $('#sc').value.trim(),
        email = $('#se').value.trim(), phone = $('#sp').value, pw = $('#spw').value, pc = $('#spc').value;

    if (name.length < 2) return showErr('Enter your full name.', '#sn');
    if (!email) return showErr('Enter your email address.', '#se');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Enter a valid email address, like you@company.com.', '#se');
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return showErr('Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.', '#sp');
    if (pw.length < 8) return showErr('Your password must be at least 8 characters.', '#spw');
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return showErr('Use both letters and numbers in your password.', '#spw');
    if (pw !== pc) return showErr('The two passwords do not match.', '#spc');
    if (!$('#sterms').checked) return showErr('Please accept the Terms and Privacy Policy to continue.', '#sterms');

    busy = true; var btn = $('#sbtn'), label = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Creating account';
    setTimeout(function () {
      var r = createAccount({ name: name, company: company, email: email, phone: phone, password: pw });
      if (!r.ok) { busy = false; btn.disabled = false; btn.textContent = label; showErr(r.error, '#se'); return; }
      $('#formView').hidden = true; $('#doneView').hidden = false; $('#doneView').classList.add('show');
      setTimeout(function () { location.href = 'login.html?msg=created'; }, 1800);
    }, 600);
  });
})();