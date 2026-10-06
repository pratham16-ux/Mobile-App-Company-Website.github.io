/* Admin dashboard: Overview, Clients, Projects, Invoices, Tickets, Settings. Shares the demo store in app.js with the client portal. */
(function () {
  'use strict';
  var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, money = A.money, fdate = A.fdate, ftime = A.ftime, Shell = A.Shell;
  var gate = A.Auth.guard('admin');
  if (!gate) return;
  var ID = gate.id;

  var PS = { 'In review': 'p-warn', 'In progress': 'p-info', 'Testing': 'p-info', 'Completed': 'p-ok', 'On hold': 'p-mute' };
  var TS = { 'Open': 'p-warn', 'In progress': 'p-info', 'Resolved': 'p-ok', 'Closed': 'p-mute' };
  var PR = { High: 'p-bad', Medium: 'p-warn', Low: 'p-mute' };
  var COLORS = { 'In review': '#C99A3B', 'In progress': '#4F3BDB', 'Testing': '#7B5CF5', 'Completed': '#2E9E6B', 'On hold': '#A3A7C2' };
  var rRange = 'm6', tFilter = 'All';

  function pill(map, s) { return '<span class="pill ' + (map[s] || 'p-mute') + '">' + esc(s) + '</span>'; }
  function db() { return A.DB.get(); }
  function me() { return db().users[ID]; }
  function update(fn) { var d = db(); fn(d); A.DB.save(d); }
  function bad(msg, el) { A.toast(msg, 'bad'); if (el) el.focus(); return false; }
  function on(el, fn) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b && el.contains(b)) fn(b.dataset.act, b.dataset.arg, b, e);
    });
  }
  function clients(d) {
    d = d || db();
    return Object.keys(d.users).filter(function (k) { return d.users[k].role === 'client'; }).map(function (k) { var u = d.users[k]; u.id = k; return u; });
  }
  function cname(d, id) { var u = d.users[id]; return u ? u.name : id; }
  function openTk(t) { return t.status === 'Open' || t.status === 'In progress'; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function syncMiles(p) {
    var n = p.milestones.length, done = Math.floor(p.progress / (100 / n) + 1e-9);
    p.milestones.forEach(function (m, i) { m.done = i < done; });
  }
  function clientOptions(d) {
    return clients(d).filter(function (c) { return c.status === 'active'; }).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + esc(c.id) + ')</option>'; }).join('');
  }

  /* ---------- modals ---------- */
  function addClient() {
    A.modal({
      title: 'Add client', wide: true,
      body: '<div class="form-grid"><div class="field"><label for="ac_n">Full name</label><input id="ac_n" maxlength="60"></div><div class="field"><label for="ac_c">Company</label><input id="ac_c" maxlength="60"></div>' +
        '<div class="field full"><label for="ac_e">Email</label><input id="ac_e" type="email" maxlength="90"></div>' +
        '<div class="field"><label for="ac_i">Client ID</label><input id="ac_i" maxlength="20" autocapitalize="none" spellcheck="false" placeholder="e.g. client05"><span class="hint">Internal ID. The client signs in with the email.</span></div>' +
        '<div class="field"><label for="ac_p">Temporary password</label><input id="ac_p" type="text" value="Welcome@123"><span class="hint">8+ characters with a letter and a number</span></div></div>',
      actions: [{ label: 'Cancel' }, {
        label: 'Create client', cls: 'btn-gold', primary: true,
        onClick: function (close, m) {
          var n = $('#ac_n', m).value.trim(), e = $('#ac_e', m).value.trim(), id = $('#ac_i', m).value.trim().toLowerCase(), pw = $('#ac_p', m).value;
          if (!n) return bad('Enter the client name.', $('#ac_n', m));
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return bad('Enter a valid email address.', $('#ac_e', m));
          if (!/^[a-z0-9._-]{3,20}$/.test(id)) return bad('Login ID needs 3 to 20 letters, numbers, dots or dashes.', $('#ac_i', m));
          if (Object.prototype.hasOwnProperty.call(db().users, id)) return bad('That Login ID is already taken.', $('#ac_i', m));
          if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return bad('Password needs 8+ characters with a letter and a number.', $('#ac_p', m));
          update(function (d) { d.users[id] = { role: 'client', name: n, email: e, company: $('#ac_c', m).value.trim(), password: pw, status: 'active', joined: today() }; });
          A.notify(id, 'Welcome to Stackly. Your portal is ready.');
          A.toast('Client ' + id + ' created'); Shell.rerender();
        }
      }]
    });
  }
  function newProject() {
    var d = db();
    if (!clientOptions(d)) return A.toast('Add an active client first.', 'bad');
    A.modal({
      title: 'New project', wide: true,
      body: '<div class="form-grid"><div class="field full"><label for="np_c">Client</label><select id="np_c">' + clientOptions(d) + '</select></div>' +
        '<div class="field full"><label for="np_n">Project name</label><input id="np_n" maxlength="70"></div>' +
        '<div class="field"><label for="np_p">Platform</label><select id="np_p"><option>iOS</option><option>Android</option><option selected>iOS + Android</option><option>Web + Mobile</option></select></div>' +
        '<div class="field"><label for="np_d">Due date</label><input id="np_d" type="date" value="' + A.isoDays(90) + '"></div></div>',
      actions: [{ label: 'Cancel' }, {
        label: 'Create project', cls: 'btn-gold', primary: true,
        onClick: function (close, m) {
          var n = $('#np_n', m).value.trim(), c = $('#np_c', m).value;
          if (!n) return bad('Enter a project name.', $('#np_n', m));
          update(function (x) {
            x.projects.push({ id: A.nextNum(x.projects, 'P-', 100), clientId: c, name: n, platform: $('#np_p', m).value, status: 'In progress', progress: 0, due: $('#np_d', m).value || A.isoDays(90), budget: 'Not set', brief: 'Created by the Stackly team.',
              milestones: ['Discovery', 'UI design', 'Core build', 'Testing', 'Store launch'].map(function (t) { return { t: t, done: false }; }) });
          });
          A.notify(c, 'A new project was added: ' + n + '.');
          A.toast('Project created'); Shell.rerender();
        }
      }]
    });
  }
  function newInvoice() {
    var d = db();
    if (!clientOptions(d)) return A.toast('Add an active client first.', 'bad');
    A.modal({
      title: 'Create invoice', wide: true,
      body: '<div class="form-grid"><div class="field full"><label for="ni_c">Client</label><select id="ni_c">' + clientOptions(d) + '</select></div>' +
        '<div class="field full"><label for="ni_d">Description</label><input id="ni_d" maxlength="90" placeholder="e.g. Build phase, milestone 2"></div>' +
        '<div class="field"><label for="ni_a">Amount (USD)</label><input id="ni_a" type="number" min="1" step="1"></div>' +
        '<div class="field"><label for="ni_due">Due date</label><input id="ni_due" type="date" value="' + A.isoDays(14) + '"></div></div>',
      actions: [{ label: 'Cancel' }, {
        label: 'Create invoice', cls: 'btn-gold', primary: true,
        onClick: function (close, m) {
          var ds = $('#ni_d', m).value.trim(), am = Math.round(Number($('#ni_a', m).value)), c = $('#ni_c', m).value, id;
          if (!ds) return bad('Add a description.', $('#ni_d', m));
          if (!(am > 0)) return bad('Enter an amount above zero.', $('#ni_a', m));
          update(function (x) { id = A.nextNum(x.invoices, 'INV-', 2040); x.invoices.push({ id: id, clientId: c, desc: ds, amount: am, due: $('#ni_due', m).value || A.isoDays(14), status: 'Pending' }); });
          A.notify(c, 'New invoice ' + id + ' for ' + money(am) + ' is ready.');
          A.toast('Invoice ' + id + ' created'); Shell.rerender();
        }
      }]
    });
  }
  function messageClient(cid) {
    var d = db(), c = d.users[cid];
    function thread() {
      var l = (db().messages[cid] || []).slice(-6);
      return l.length ? l.map(function (m) { return '<div class="bub ' + (m.from === 'client' ? 'them' : 'me') + '">' + esc(m.text).replace(/\n/g, '<br>') + '<small>' + (m.from === 'client' ? esc(c.name) : 'You') + ', ' + ftime(m.at) + '</small></div>'; }).join('') : '<p class="muted">No messages yet.</p>';
    }
    A.modal({
      title: 'Message ' + c.name, wide: true,
      body: '<div class="msgs" id="mthread" style="max-height:260px;border-radius:16px">' + thread() + '</div><div class="field"><label for="mtext">Your message</label><textarea id="mtext" rows="3" maxlength="800"></textarea></div>',
      actions: [{ label: 'Close' }, {
        label: 'Send message', cls: 'btn-gold', primary: false,
        onClick: function (close, m) {
          var t = $('#mtext', m).value.trim();
          if (!t) { bad('Write a message first.', $('#mtext', m)); return false; }
          update(function (x) { (x.messages[cid] = x.messages[cid] || []).push({ from: 'team', name: me().name, text: t, at: Date.now() }); });
          A.notify(cid, 'New message from ' + me().name + ' at Stackly.');
          $('#mthread', m).innerHTML = thread(); $('#mtext', m).value = ''; A.toast('Message sent');
          return false;
        }
      }]
    });
  }
  function ticketModal(tid) {
    var t0 = db().tickets.filter(function (x) { return x.id === tid; })[0];
    if (!t0) return;
    function thread() {
      var t = db().tickets.filter(function (x) { return x.id === tid; })[0], c = cname(db(), t.clientId);
      return '<div class="thread"><div><small>' + esc(c) + ', ' + ftime(t.created) + '</small><p>' + esc(t.msg) + '</p></div>' +
        t.replies.map(function (r) { return '<div><small>' + (r.from === 'admin' ? esc(r.name || 'Stackly team') : esc(c)) + ', ' + ftime(r.at) + '</small><p>' + esc(r.text) + '</p></div>'; }).join('') + '</div>';
    }
    A.modal({
      title: t0.id + ': ' + t0.subject, wide: true,
      body: '<div id="tthread">' + thread() + '</div><div class="field"><label for="trep">Reply to ' + esc(cname(db(), t0.clientId)) + '</label><textarea id="trep" rows="3" maxlength="800"></textarea></div>',
      actions: [{ label: 'Close' }, {
        label: 'Send reply', cls: 'btn-gold',
        onClick: function (close, m) {
          var txt = $('#trep', m).value.trim();
          if (!txt) { bad('Write a reply first.', $('#trep', m)); return false; }
          update(function (x) { var t = x.tickets.filter(function (y) { return y.id === tid; })[0]; t.replies.push({ from: 'admin', name: me().name, text: txt, at: Date.now() }); if (t.status === 'Open') t.status = 'In progress'; });
          A.notify(t0.clientId, 'Stackly replied to your ticket ' + tid + '.');
          $('#tthread', m).innerHTML = thread(); $('#trep', m).value = ''; A.toast('Reply sent');
          return false;
        }
      }],
      onClose: function () { Shell.rerender(); }
    });
  }

  var views = {};

  /* ---------- overview ---------- */
  views.overview = {
    title: 'Overview',
    render: function (el) {
      var d = db(), cs = clients(d), ps = d.projects, collected = d.invoices.filter(function (i) { return i.status === 'Paid'; }).reduce(function (s, i) { return s + i.amount; }, 0);
      var counts = {}; A.statuses.forEach(function (s) { counts[s] = ps.filter(function (p) { return p.status === s; }).length; });
      var acc = 0, stops = A.statuses.map(function (s) {
        var from = acc; acc += ps.length ? counts[s] / ps.length * 100 : 0; return COLORS[s] + ' ' + from + '% ' + acc + '%';
      }).join(',');
      var tks = d.tickets.slice().sort(function (a, b) { return b.created - a.created; }).slice(0, 4);
      el.innerHTML =
        '<div class="panel hello"><div><h2>Hello, ' + esc(me().name.split(' ')[0]) + '</h2><p>Signed in as admin: <span class="idchip">' + esc(me().email) + '</span></p></div>' +
        '<div class="quick"><button type="button" class="btn btn-gold btn-sm" data-act="addc">Add client</button><button type="button" class="btn btn-ghost btn-sm" data-act="newp">New project</button><button type="button" class="btn btn-ghost btn-sm" data-act="newi">Create invoice</button></div></div>' +
        '<div class="stats"><div class="sc"><small>Active clients</small><b>' + cs.filter(function (c) { return c.status === 'active'; }).length + '</b><em>' + cs.length + ' registered</em></div>' +
        '<div class="sc"><small>Active projects</small><b>' + ps.filter(function (p) { return p.status !== 'Completed'; }).length + '</b><em>' + ps.length + ' in total</em></div>' +
        '<div class="sc"><small>Revenue collected</small><b>' + money(collected) + '</b><em>' + money(d.invoices.filter(function (i) { return i.status === 'Pending'; }).reduce(function (s, i) { return s + i.amount; }, 0)) + ' outstanding</em></div>' +
        '<div class="sc"><small>Open tickets</small><b>' + d.tickets.filter(openTk).length + '</b><em>' + d.tickets.length + ' in total</em></div></div>' +
        '<div class="cols"><div class="panel"><div class="p-head"><h3>Monthly revenue ($ thousands)</h3><select class="sel" id="rr" aria-label="Chart range"><option value="m6">Last 6 months</option><option value="m12">Last 12 months</option></select></div><div class="chart" id="rchart"></div></div>' +
        '<div class="panel"><div class="p-head"><h3>Projects by status</h3></div><div class="donut-wrap"><div class="donut" style="background:conic-gradient(' + (ps.length ? stops : '#ECEDF3 0 100%') + ')"><div class="donut-c"><b>' + ps.length + '</b><small>projects</small></div></div>' +
        '<ul class="legend">' + A.statuses.map(function (s) { return '<li><i style="background:' + COLORS[s] + '"></i>' + esc(s) + '<b>' + counts[s] + '</b></li>'; }).join('') + '</ul></div></div></div>' +
        '<div class="panel"><div class="p-head"><h3>Latest tickets</h3><a class="link-btn" href="#tickets">Open tickets</a></div>' +
        (tks.length ? '<div class="rows">' + tks.map(function (t) {
          return '<div class="row-i s-item"><div class="ri-top"><b>' + esc(t.subject) + '</b>' + pill(TS, t.status) + '</div><div class="ri-top"><small class="muted">' + esc(cname(d, t.clientId)) + ' (' + esc(t.clientId) + ') &middot; ' + esc(t.id) + '</small><button type="button" class="link-btn" data-act="tk" data-arg="' + esc(t.id) + '">View thread</button></div></div>';
        }).join('') + '</div>' : '<p class="empty">No tickets yet.</p>') + '</div>';
      function draw() { var n = rRange === 'm6' ? 6 : 12; A.chart($('#rchart', el), A.monthLabels(n), db().revenue[rRange], '$', 'k'); }
      $('#rr', el).value = rRange; $('#rr', el).addEventListener('change', function () { rRange = this.value; draw(); }); draw();
      on(el, function (act, arg) { if (act === 'addc') addClient(); if (act === 'newp') newProject(); if (act === 'newi') newInvoice(); if (act === 'tk') ticketModal(arg); });
    }
  };

  /* ---------- clients ---------- */
  views.clients = {
    title: 'Clients',
    render: function (el) {
      var d = db(), cs = clients(d);
      el.innerHTML = '<div class="panel"><div class="p-head"><h3>Clients (' + cs.length + ')</h3><div class="p-acts"><button type="button" class="btn btn-ghost btn-sm" data-act="exp">Export CSV</button><button type="button" class="btn btn-gold btn-sm" data-act="addc">Add client</button></div></div>' +
        (cs.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Client ID</th><th>Email</th><th>Projects</th><th>Status</th><th class="r">Actions</th></tr></thead><tbody>' +
          cs.map(function (c) {
            var n = d.projects.filter(function (p) { return p.clientId === c.id; }).length, act = c.status === 'active';
            return '<tr class="s-item"><td data-label="Client"><div class="who2"><span class="av sm">' + esc(A.initials(c.name)) + '</span><div><b>' + esc(c.name) + '</b><small>' + esc(c.company || '') + '</small></div></div></td>' +
              '<td data-label="Login ID"><code>' + esc(c.id) + '</code></td><td data-label="Email">' + esc(c.email) + '</td><td data-label="Projects">' + n + '</td>' +
              '<td data-label="Status">' + pill({ active: 'p-ok', suspended: 'p-bad' }, c.status) + '</td><td class="r cell-acts"><div class="acts">' +
              '<button type="button" class="btn btn-line btn-xs" data-act="msg" data-arg="' + esc(c.id) + '">Message</button>' +
              '<button type="button" class="btn btn-line btn-xs" data-act="rst" data-arg="' + esc(c.id) + '">Reset password</button>' +
              '<button type="button" class="btn btn-line btn-xs" data-act="tog" data-arg="' + esc(c.id) + '">' + (act ? 'Suspend' : 'Activate') + '</button>' +
              '<button type="button" class="btn btn-danger btn-xs" data-act="del" data-arg="' + esc(c.id) + '">Delete</button></div></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="empty">No clients yet. Add your first client.</p>') + '</div>';
      on(el, function (act, arg) {
        if (act === 'addc') addClient();
        if (act === 'msg') messageClient(arg);
        if (act === 'exp') {
          var rows = [['Login ID', 'Name', 'Company', 'Email', 'Status', 'Joined']].concat(cs.map(function (c) { return [c.id, c.name, c.company || '', c.email, c.status, c.joined || '']; }));
          A.download('stackly-clients.csv', A.csv(rows), 'text/csv'); A.toast('Clients exported');
        }
        if (act === 'rst') {
          A.confirmBox('Reset the password for ' + arg + ' to Client@123?', 'Reset password').then(function (ok) {
            if (!ok) return; update(function (x) { x.users[arg].password = 'Client@123'; }); A.toast('Password for ' + arg + ' is now Client@123');
          });
        }
        if (act === 'tog') {
          update(function (x) { x.users[arg].status = x.users[arg].status === 'active' ? 'suspended' : 'active'; });
          A.toast(arg + ' is now ' + db().users[arg].status); Shell.rerender();
        }
        if (act === 'del') {
          A.confirmBox('Delete ' + arg + ' and all of their projects, invoices and tickets? This cannot be undone.', 'Delete client', true).then(function (ok) {
            if (!ok) return;
            update(function (x) {
              delete x.users[arg]; delete x.messages[arg]; delete x.notes[arg]; delete x.prefs[arg];
              ['projects', 'invoices', 'tickets'].forEach(function (k) { x[k] = x[k].filter(function (i) { return i.clientId !== arg; }); });
            });
            A.toast('Client ' + arg + ' deleted'); Shell.rerender();
          });
        }
      });
    }
  };

  /* ---------- projects ---------- */
  views.projects = {
    title: 'Projects',
    render: function (el) {
      var d = db(), ps = d.projects;
      el.innerHTML = '<div class="panel"><div class="p-head"><h3>All projects (' + ps.length + ')</h3><button type="button" class="btn btn-gold btn-sm" data-act="newp">New project</button></div>' +
        (ps.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Due</th><th class="r">Actions</th></tr></thead><tbody>' +
          ps.map(function (p) {
            return '<tr class="s-item"><td data-label="Project"><b>' + esc(p.name) + '</b><div class="muted">' + esc(p.id) + ' &middot; ' + esc(p.platform) + '</div></td><td data-label="Client">' + esc(cname(d, p.clientId)) + '</td>' +
              '<td data-label="Status"><select class="sel" data-st="' + esc(p.id) + '" aria-label="Status for ' + esc(p.name) + '">' + A.statuses.map(function (s) { return '<option' + (s === p.status ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></td>' +
              '<td data-label="Progress"><div class="stepper"><button type="button" data-act="dec" data-arg="' + esc(p.id) + '" aria-label="Decrease progress">&minus;</button><div class="bar"><i style="width:' + p.progress + '%"></i></div><b>' + p.progress + '%</b><button type="button" data-act="inc" data-arg="' + esc(p.id) + '" aria-label="Increase progress">+</button></div></td>' +
              '<td data-label="Due">' + fdate(p.due) + '</td><td class="r cell-acts"><div class="acts"><button type="button" class="btn btn-danger btn-xs" data-act="del" data-arg="' + esc(p.id) + '">Delete</button></div></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="empty">No projects yet.</p>') + '</div>';
      $$('[data-st]', el).forEach(function (s) {
        s.addEventListener('change', function () {
          var id = s.dataset.st, cid;
          update(function (x) {
            var p = x.projects.filter(function (y) { return y.id === id; })[0]; p.status = s.value; cid = p.clientId;
            if (s.value === 'Completed') { p.progress = 100; syncMiles(p); }
          });
          A.notify(cid, 'Your project status changed to ' + s.value + '.'); A.toast('Status updated'); Shell.rerender();
        });
      });
      on(el, function (act, arg) {
        if (act === 'newp') newProject();
        if (act === 'inc' || act === 'dec') {
          var cid, pr;
          update(function (x) {
            var p = x.projects.filter(function (y) { return y.id === arg; })[0];
            p.progress = Math.max(0, Math.min(100, p.progress + (act === 'inc' ? 10 : -10)));
            if (p.progress === 100) p.status = 'Completed'; else if (p.status === 'Completed') p.status = 'In progress';
            syncMiles(p); cid = p.clientId; pr = p.progress;
          });
          A.notify(cid, 'Your project is now ' + pr + '% complete.'); Shell.rerender();
        }
        if (act === 'del') {
          A.confirmBox('Delete project ' + arg + '?', 'Delete project', true).then(function (ok) {
            if (!ok) return; update(function (x) { x.projects = x.projects.filter(function (p) { return p.id !== arg; }); }); A.toast('Project deleted'); Shell.rerender();
          });
        }
      });
    }
  };

  /* ---------- invoices ---------- */
  views.invoices = {
    title: 'Invoices',
    render: function (el) {
      var d = db(), inv = d.invoices.slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; });
      var total = inv.reduce(function (s, i) { return s + i.amount; }, 0), paid = inv.filter(function (i) { return i.status === 'Paid'; }).reduce(function (s, i) { return s + i.amount; }, 0);
      el.innerHTML = '<div class="panel"><div class="p-head"><h3>Invoices</h3><div class="p-acts"><button type="button" class="btn btn-ghost btn-sm" data-act="exp">Export CSV</button><button type="button" class="btn btn-gold btn-sm" data-act="newi">Create invoice</button></div></div>' +
        '<div class="sum"><div><small>Total billed</small><b>' + money(total) + '</b></div><div><small>Collected</small><b>' + money(paid) + '</b></div><div><small>Outstanding</small><b>' + money(total - paid) + '</b></div></div>' +
        (inv.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Invoice</th><th>Client</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th class="r">Actions</th></tr></thead><tbody>' +
          inv.map(function (i) {
            var over = i.status === 'Pending' && i.due < today(), label = over ? 'Overdue' : i.status;
            return '<tr class="s-item"><td data-label="Invoice"><b>' + esc(i.id) + '</b></td><td data-label="Client">' + esc(cname(d, i.clientId)) + '</td><td data-label="Description">' + esc(i.desc) + '</td><td data-label="Amount">' + money(i.amount) + '</td><td data-label="Due">' + fdate(i.due) + '</td>' +
              '<td data-label="Status">' + pill({ Paid: 'p-ok', Pending: 'p-warn', Overdue: 'p-bad' }, label) + '</td><td class="r cell-acts"><div class="acts">' +
              '<button type="button" class="btn btn-line btn-xs" data-act="tog" data-arg="' + esc(i.id) + '">' + (i.status === 'Paid' ? 'Mark pending' : 'Mark paid') + '</button>' +
              '<button type="button" class="btn btn-danger btn-xs" data-act="del" data-arg="' + esc(i.id) + '">Delete</button></div></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="empty">No invoices yet.</p>') + '</div>';
      on(el, function (act, arg) {
        if (act === 'newi') newInvoice();
        if (act === 'exp') {
          var rows = [['Invoice', 'Client ID', 'Client', 'Description', 'Amount', 'Due', 'Status']].concat(inv.map(function (i) { return [i.id, i.clientId, cname(d, i.clientId), i.desc, i.amount, i.due, i.status]; }));
          A.download('stackly-invoices.csv', A.csv(rows), 'text/csv'); A.toast('Invoices exported');
        }
        if (act === 'tog') {
          var cid, st;
          update(function (x) { var i = x.invoices.filter(function (y) { return y.id === arg; })[0]; i.status = i.status === 'Paid' ? 'Pending' : 'Paid'; i.paidAt = i.status === 'Paid' ? Date.now() : null; cid = i.clientId; st = i.status; });
          A.notify(cid, 'Invoice ' + arg + ' is now marked ' + st.toLowerCase() + '.'); A.toast(arg + ' marked ' + st.toLowerCase()); Shell.rerender();
        }
        if (act === 'del') {
          A.confirmBox('Delete invoice ' + arg + '?', 'Delete invoice', true).then(function (ok) {
            if (!ok) return; update(function (x) { x.invoices = x.invoices.filter(function (i) { return i.id !== arg; }); }); A.toast('Invoice deleted'); Shell.rerender();
          });
        }
      });
    }
  };

  /* ---------- tickets ---------- */
  views.tickets = {
    title: 'Tickets',
    render: function (el) {
      var d = db(), list = d.tickets.filter(function (t) { return tFilter === 'All' || t.status === tFilter; }).sort(function (a, b) { return b.created - a.created; });
      el.innerHTML = '<div class="panel"><div class="p-head"><h3>Support tickets</h3><select class="sel" id="tf" aria-label="Filter by status"><option>All</option>' +
        ['Open', 'In progress', 'Resolved', 'Closed'].map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
        (list.length ? '<div class="rows">' + list.map(function (t) {
          return '<article class="row-i tk s-item"><div class="tk-top"><div><b>' + esc(t.subject) + '</b><div class="meta"><span>' + esc(t.id) + '</span><span>' + esc(cname(d, t.clientId)) + ' (' + esc(t.clientId) + ')</span><span>' + ftime(t.created) + '</span></div></div>' +
            '<div class="acts">' + pill(PR, t.priority) + '<select class="sel" data-ts="' + esc(t.id) + '" aria-label="Status for ' + esc(t.id) + '">' + ['Open', 'In progress', 'Resolved', 'Closed'].map(function (s) { return '<option' + (s === t.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
            '<p class="muted" style="margin:0">' + esc(t.msg) + '</p><div class="acts"><button type="button" class="btn btn-ghost btn-sm" data-act="open" data-arg="' + esc(t.id) + '">View thread and reply (' + t.replies.length + ')</button></div></article>';
        }).join('') + '</div>' : '<p class="empty">No tickets in this view.</p>') + '</div>';
      $('#tf', el).value = tFilter; $('#tf', el).addEventListener('change', function () { tFilter = this.value; Shell.rerender(); });
      $$('[data-ts]', el).forEach(function (s) {
        s.addEventListener('change', function () {
          var id = s.dataset.ts, cid;
          update(function (x) { var t = x.tickets.filter(function (y) { return y.id === id; })[0]; t.status = s.value; cid = t.clientId; });
          A.notify(cid, 'Ticket ' + id + ' is now ' + s.value.toLowerCase() + '.'); A.toast('Ticket status updated'); Shell.rerender();
        });
      });
      on(el, function (act, arg) { if (act === 'open') ticketModal(arg); });
    }
  };

  /* ---------- settings ---------- */
  views.settings = {
    title: 'Settings',
    render: function (el) {
      var u = me(), pr = db().prefs[ID] || { alerts: true, signups: true, maintenance: false };
      function sw(key, label, hint) {
        return '<div class="set-row"><div><b>' + label + '</b><small>' + hint + '</small></div><label class="sw"><input type="checkbox" data-pref="' + key + '"' + (pr[key] ? ' checked' : '') + ' aria-label="' + label + '"><span></span></label></div>';
      }
      el.innerHTML =
        '<div class="cols even"><div class="panel"><h3>Admin profile</h3><form id="pf2" class="contact" novalidate>' +
        '<div class="field"><label for="sid">Login email</label><div class="idrow"><input id="sid" value="' + esc(u.email) + '" readonly><button type="button" class="btn btn-line btn-sm" data-copy-id>Copy</button></div><span class="hint">This is the email you signed in with.</span></div>' +
        '<div class="field"><label for="sn">Full name</label><input id="sn" value="' + esc(u.name) + '" maxlength="60"></div>' +
        '<div><button type="submit" class="btn btn-gold btn-sm">Save profile</button></div></form></div>' +
        '<div class="panel"><h3>Change password</h3><p class="muted">Use at least 8 characters with a letter and a number.</p><form id="pw2" class="contact" novalidate>' +
        '<div class="field"><label for="p0">Current password</label><input id="p0" type="password" autocomplete="current-password"></div>' +
        '<div class="field"><label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password"></div>' +
        '<div class="field"><label for="p2">Confirm new password</label><input id="p2" type="password" autocomplete="new-password"></div>' +
        '<div><button type="submit" class="btn btn-gold btn-sm">Update password</button></div></form></div></div>' +
        '<div class="cols even"><div class="panel"><h3>Console preferences</h3>' + sw('alerts', 'Email alerts', 'New tickets, payments and messages') + sw('signups', 'New client alerts', 'When a client account is created') + sw('maintenance', 'Maintenance mode', 'Show a notice to clients (demo setting)') + '</div>' +
        '<div class="panel"><h3>Data and session</h3><p class="muted">Export everything in this demo, or reset it to the starting sample data.</p><div class="quick"><button type="button" class="btn btn-ghost btn-sm" data-act="exp">Export all data</button><button type="button" class="btn btn-danger btn-sm" data-act="reset">Reset demo data</button><button type="button" class="btn btn-ghost btn-sm" data-logout>Log out</button></div></div></div>';
      $('#pf2', el).addEventListener('submit', function (e) {
        e.preventDefault();
        var n = $('#sn', el).value.trim();
        if (!n) return bad('Your name cannot be empty.', $('#sn', el));
        update(function (x) { x.users[ID].name = n; }); Shell.refresh(); A.toast('Profile saved');
      });
      $('#pw2', el).addEventListener('submit', function (e) {
        e.preventDefault();
        var c = $('#p0', el).value, n = $('#p1', el).value, n2 = $('#p2', el).value;
        if (c !== me().password) return bad('Your current password is not correct.', $('#p0', el));
        if (n.length < 8 || !/[A-Za-z]/.test(n) || !/\d/.test(n)) return bad('New password needs 8 or more characters, with a letter and a number.', $('#p1', el));
        if (n !== n2) return bad('The new passwords do not match.', $('#p2', el));
        update(function (x) { x.users[ID].password = n; }); $('#pw2', el).reset(); A.toast('Password updated');
      });
      $$('[data-pref]', el).forEach(function (c) {
        c.addEventListener('change', function () { update(function (x) { x.prefs[ID] = x.prefs[ID] || {}; x.prefs[ID][c.dataset.pref] = c.checked; }); A.toast('Preference saved'); });
      });
      on(el, function (act) {
        if (act === 'exp') {
          var d = JSON.parse(JSON.stringify(db())); Object.keys(d.users).forEach(function (k) { delete d.users[k].password; });
          A.download('stackly-demo-data.json', JSON.stringify(d, null, 2), 'application/json'); A.toast('Data exported');
        }
        if (act === 'reset') {
          A.confirmBox('Reset all demo data to the starting sample? Any clients, projects and invoices you added will be removed.', 'Reset data', true).then(function (ok) {
            if (!ok) return; A.DB.reset(); A.toast('Demo data reset'); Shell.rerender();
          });
        }
      });
    }
  };

  Shell.mount({
    role: 'admin', views: views,
    nav: [{ id: 'overview', label: 'Overview', icon: 'home' }, { id: 'clients', label: 'Clients', icon: 'users' }, { id: 'projects', label: 'Projects', icon: 'folder' },
      { id: 'invoices', label: 'Invoices', icon: 'receipt' }, { id: 'tickets', label: 'Tickets', icon: 'help' }, { id: 'settings', label: 'Settings', icon: 'gear' }],
    badges: function () {
      var d = db();
      return { tickets: d.tickets.filter(openTk).length, invoices: d.invoices.filter(function (i) { return i.status === 'Pending'; }).length };
    }
  });
})();