/* Client dashboard: Overview, Projects, Messages, Invoices, Support, Settings. Data comes from the shared demo store in app.js. */
(function () {
  'use strict';
  var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, money = A.money, fdate = A.fdate, ftime = A.ftime, Shell = A.Shell;
  var gate = A.Auth.guard('client');
  if (!gate) return;
  var ID = gate.id;

  var PS = { 'In review': 'p-warn', 'In progress': 'p-info', 'Testing': 'p-info', 'Completed': 'p-ok', 'On hold': 'p-mute' };
  var TS = { 'Open': 'p-warn', 'In progress': 'p-info', 'Resolved': 'p-ok', 'Closed': 'p-mute' };
  var pFilter = 'All', iFilter = 'All', vRange = 'w4', replying = false;

  function pill(map, s) { return '<span class="pill ' + (map[s] || 'p-mute') + '">' + esc(s) + '</span>'; }
  function db() { return A.DB.get(); }
  function me() { return db().users[ID]; }
  function mine(k) { return db()[k].filter(function (x) { return x.clientId === ID; }); }
  function update(fn) { var d = db(); fn(d); A.DB.save(d); }
  function openTk(t) { return t.status === 'Open' || t.status === 'In progress'; }
  function on(el, fn) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b && el.contains(b)) fn(b.dataset.act, b.dataset.arg, b, e);
    });
  }
  function bad(msg, focusEl) { A.toast(msg, 'bad'); if (focusEl) focusEl.focus(); return false; }

  /* ---------- projects ---------- */
  function projCard(p) {
    return '<article class="panel proj s-item"><div class="ri-top"><h3>' + esc(p.name) + '</h3>' + pill(PS, p.status) + '</div>' +
      '<div class="meta"><span>' + esc(p.platform) + '</span><span>Due ' + fdate(p.due) + '</span><span>' + esc(p.id) + '</span></div>' +
      '<div><div class="ri-top"><small class="muted">Progress</small><b>' + p.progress + '%</b></div><div class="bar"><i style="width:' + p.progress + '%"></i></div></div>' +
      '<div class="acts"><button type="button" class="btn btn-ghost btn-sm" data-act="view" data-arg="' + esc(p.id) + '">View details</button>' +
      (p.status === 'In review' ? '<button type="button" class="btn btn-danger btn-sm" data-act="cancel" data-arg="' + esc(p.id) + '">Cancel request</button>' : '') + '</div></article>';
  }
  function openProject(id) {
    var p = mine('projects').filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var locked = p.status === 'In review';
    var body = '<p class="m-msg">' + esc(p.brief || 'No brief added.') + '</p>' +
      '<div class="meta"><span>' + esc(p.platform) + '</span><span>Due ' + fdate(p.due) + '</span><span>Budget ' + esc(p.budget || 'Not set') + '</span></div>' +
      '<div><div class="ri-top"><b>Status ' + pill(PS, p.status) + '</b><b id="mpct">' + p.progress + '%</b></div><div class="bar"><i id="mbar" style="width:' + p.progress + '%"></i></div></div>' +
      '<div class="miles">' + p.milestones.map(function (m, i) {
        return '<label><input type="checkbox" data-i="' + i + '"' + (m.done ? ' checked' : '') + (locked ? ' disabled' : '') + '> ' + esc(m.t) + '</label>';
      }).join('') + '</div>' + (locked ? '<p class="m-msg">Milestones unlock once the team accepts your request.</p>' : '<p class="m-msg">Tick a milestone once you have reviewed and approved it.</p>');
    A.modal({
      title: p.name, body: body, wide: true,
      actions: [{ label: 'Message the team', onClick: function () { setTimeout(function () { Shell.go('messages'); }, 0); } }, { label: 'Done', cls: 'btn-gold', primary: true }],
      onOpen: function (m) {
        $$('input[data-i]', m).forEach(function (cb) {
          cb.addEventListener('change', function () {
            var i = +cb.dataset.i, pr = 0;
            update(function (d) {
              var q = d.projects.filter(function (x) { return x.id === id; })[0];
              q.milestones[i].done = cb.checked;
              var done = q.milestones.filter(function (x) { return x.done; }).length;
              q.progress = Math.round(done / q.milestones.length * 100); pr = q.progress;
              if (pr === 100) q.status = 'Completed'; else if (q.status === 'Completed') q.status = 'In progress';
            });
            $('#mbar', m).style.width = pr + '%'; $('#mpct', m).textContent = pr + '%';
            A.notifyAdmins(me().name + ' ' + (cb.checked ? 'approved' : 'reopened') + ' the "' + p.milestones[i].t + '" milestone on ' + p.name + '.');
            A.toast('Milestone ' + (cb.checked ? 'approved' : 'reopened'));
          });
        });
      },
      onClose: function () { Shell.rerender(); }
    });
  }
  function newRequest() {
    A.modal({
      title: 'New project request', wide: true,
      body: '<div class="form-grid"><div class="field full"><label for="nr_name">Project name</label><input id="nr_name" maxlength="70" placeholder="e.g. Customer rewards app"></div>' +
        '<div class="field"><label for="nr_plat">Platform</label><select id="nr_plat"><option>iOS</option><option>Android</option><option selected>iOS + Android</option><option>Web + Mobile</option></select></div>' +
        '<div class="field"><label for="nr_budget">Budget</label><select id="nr_budget"><option>Under $10k</option><option>$10k to $25k</option><option selected>$25k to $50k</option><option>$50k and above</option></select></div>' +
        '<div class="field full"><label for="nr_due">Ideal launch date</label><input id="nr_due" type="date"></div>' +
        '<div class="field full"><label for="nr_brief">What should the app do?</label><textarea id="nr_brief" rows="4" maxlength="600" placeholder="A few lines about your users and the main features"></textarea></div></div>',
      actions: [{ label: 'Cancel' }, {
        label: 'Send request', cls: 'btn-gold', primary: true,
        onClick: function (close, m) {
          var name = $('#nr_name', m).value.trim(), brief = $('#nr_brief', m).value.trim();
          if (!name) return bad('Give your project a name.', $('#nr_name', m));
          if (brief.length < 10) return bad('Add a short description of at least 10 characters.', $('#nr_brief', m));
          update(function (d) {
            d.projects.push({ id: A.nextNum(d.projects, 'P-', 100), clientId: ID, name: name, platform: $('#nr_plat', m).value, status: 'In review', progress: 0,
              due: $('#nr_due', m).value || A.isoDays(90), budget: $('#nr_budget', m).value, brief: brief,
              milestones: ['Discovery', 'UI design', 'Core build', 'Testing', 'Store launch'].map(function (t) { return { t: t, done: false }; }) });
          });
          A.notifyAdmins(me().name + ' requested a new project: ' + name + '.');
          A.toast('Request sent. We will review it within one working day.');
          setTimeout(function () { Shell.go('projects'); }, 0);
        }
      }]
    });
  }

  var views = {};

  /* ---------- overview ---------- */
  views.overview = {
    title: 'Overview',
    render: function (el) {
      var d = db(), u = me(), ps = mine('projects'), inv = mine('invoices'), tk = mine('tickets');
      var active = ps.filter(function (p) { return p.status !== 'Completed'; }).length;
      var pend = inv.filter(function (i) { return i.status === 'Pending'; });
      var due = pend.reduce(function (s, i) { return s + i.amount; }, 0);
      var avg = ps.length ? Math.round(ps.reduce(function (s, p) { return s + p.progress; }, 0) / ps.length) : 0;
      var notes = (d.notes[ID] || []).slice(0, 5);
      el.innerHTML =
        '<div class="panel hello"><div><h2>Welcome back, ' + esc(u.name.split(' ')[0]) + '</h2><p>You are signed in as <span class="idchip">' + esc(u.email) + '</span></p></div>' +
        '<div class="quick"><button type="button" class="btn btn-gold btn-sm" data-act="new">New project request</button><a class="btn btn-ghost btn-sm" href="#messages">Message the team</a></div></div>' +
        '<div class="stats">' +
        '<div class="sc"><small>Active projects</small><b>' + active + '</b><em>' + ps.length + ' in total</em></div>' +
        '<div class="sc"><small>Average progress</small><b>' + avg + '%</b><em>Across all projects</em></div>' +
        '<div class="sc"><small>Amount due</small><b>' + money(due) + '</b><em>' + pend.length + ' pending invoice' + (pend.length === 1 ? '' : 's') + '</em></div>' +
        '<div class="sc"><small>Open tickets</small><b>' + tk.filter(openTk).length + '</b><em>' + tk.length + ' in total</em></div></div>' +
        '<div class="cols"><div class="panel"><div class="p-head"><h3>Project progress</h3><a class="link-btn" href="#projects">See all</a></div><div class="rows">' +
        (ps.length ? ps.map(function (p) {
          return '<div class="row-i s-item"><div class="ri-top"><b>' + esc(p.name) + '</b>' + pill(PS, p.status) + '</div><div class="bar"><i style="width:' + p.progress + '%"></i></div>' +
            '<div class="ri-top"><small class="muted">Due ' + fdate(p.due) + '</small><button type="button" class="link-btn" data-act="view" data-arg="' + esc(p.id) + '">View details</button></div></div>';
        }).join('') : '<p class="empty">No projects yet. Send a request to get started.</p>') + '</div></div>' +
        '<div class="panel"><div class="p-head"><h3>Recent activity</h3></div>' +
        (notes.length ? '<ul class="act-list">' + notes.map(function (n) { return '<li class="s-item"><div>' + esc(n.text) + '<small>' + ftime(n.at) + '</small></div></li>'; }).join('') + '</ul>' : '<p class="empty">Nothing yet.</p>') + '</div></div>' +
        '<div class="panel"><div class="p-head"><h3>Features delivered each week</h3><select class="sel" id="vr" aria-label="Chart range"><option value="w4">Last 4 weeks</option><option value="w8">Last 8 weeks</option></select></div><div class="chart" id="vchart"></div></div>';
      function draw() {
        var vals = d.velocity[vRange], labels = vals.map(function (_, i) { return 'W' + (i + 1); });
        A.chart($('#vchart', el), labels, vals, '');
      }
      $('#vr', el).value = vRange;
      $('#vr', el).addEventListener('change', function () { vRange = this.value; draw(); });
      draw();
      on(el, function (act, arg) { if (act === 'new') newRequest(); if (act === 'view') openProject(arg); });
    }
  };

  /* ---------- projects ---------- */
  views.projects = {
    title: 'Projects',
    render: function (el) {
      var ps = mine('projects').filter(function (p) { return pFilter === 'All' || p.status === pFilter; });
      el.innerHTML =
        '<div class="panel"><div class="p-head"><h3>Your projects</h3><div class="p-acts"><select class="sel" id="pf" aria-label="Filter by status"><option>All</option>' +
        A.statuses.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select><button type="button" class="btn btn-gold btn-sm" data-act="new">New request</button></div></div>' +
        (ps.length ? '<div class="proj-grid">' + ps.map(projCard).join('') + '</div>' : '<p class="empty">No projects match this filter.</p>') + '</div>';
      $('#pf', el).value = pFilter;
      $('#pf', el).addEventListener('change', function () { pFilter = this.value; Shell.rerender(); });
      on(el, function (act, arg) {
        if (act === 'new') newRequest();
        if (act === 'view') openProject(arg);
        if (act === 'cancel') {
          A.confirmBox('Cancel this project request?', 'Cancel request', true).then(function (ok) {
            if (!ok) return;
            update(function (d) { d.projects = d.projects.filter(function (x) { return !(x.id === arg && x.clientId === ID && x.status === 'In review'); }); });
            A.toast('Request cancelled'); Shell.rerender();
          });
        }
      });
    }
  };

  /* ---------- messages ---------- */
  views.messages = {
    title: 'Messages',
    render: function (el) {
      el.innerHTML = '<div class="panel chat"><div class="chat-head"><span class="av sm">ST</span><div><b>Stackly project team</b><small>Usually replies within a few hours</small></div></div>' +
        '<div class="msgs" id="msgs" aria-live="polite"></div><form class="composer" id="cmp"><textarea id="cmsg" rows="1" maxlength="1000" placeholder="Write a message" aria-label="Message"></textarea><button type="submit" class="btn btn-gold btn-sm">Send</button></form></div>';
      function draw() {
        var box = $('#msgs'); if (!box) return;
        var list = db().messages[ID] || [];
        box.innerHTML = list.length ? list.map(function (m) {
          return '<div class="bub ' + (m.from === 'client' ? 'me' : 'them') + ' s-item">' + esc(m.text).replace(/\n/g, '<br>') + '<small>' + (m.from === 'client' ? 'You' : esc(m.name || 'Stackly team')) + ', ' + ftime(m.at) + '</small></div>';
        }).join('') : '<p class="empty">No messages yet. Say hello to the team.</p>';
        box.scrollTop = box.scrollHeight;
      }
      function autoReply() {
        if (replying) return; replying = true;
        var box = $('#msgs');
        if (box) { var t = document.createElement('div'); t.className = 'bub them typing'; t.innerHTML = '<i></i><i></i><i></i>'; box.appendChild(t); box.scrollTop = box.scrollHeight; }
        setTimeout(function () {
          update(function (d) { (d.messages[ID] = d.messages[ID] || []).push({ from: 'team', name: 'Stackly team', text: 'Thanks for your message. A project manager will reply within a few hours. (Automatic reply)', at: Date.now() }); });
          replying = false; draw();
        }, 1400);
      }
      function send() {
        var ta = $('#cmsg'), text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        update(function (d) { (d.messages[ID] = d.messages[ID] || []).push({ from: 'client', text: text, at: Date.now() }); });
        A.notifyAdmins('New message from ' + me().name + ' (' + ID + ').');
        ta.value = ''; ta.style.height = ''; draw(); autoReply();
      }
      $('#cmp').addEventListener('submit', function (e) { e.preventDefault(); send(); });
      $('#cmsg').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      $('#cmsg').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 140) + 'px'; });
      draw();
    }
  };

  /* ---------- invoices ---------- */
  function invoiceHtml(i) {
    var u = me();
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(i.id) + '</title></head><body style="font-family:Arial,sans-serif;max-width:640px;margin:40px auto;color:#14163A">' +
      '<h1 style="color:#4F3BDB;margin-bottom:0">Stackly</h1><p style="margin-top:4px">Mobile app development</p><hr>' +
      '<h2>Invoice ' + esc(i.id) + '</h2><p>Billed to: <b>' + esc(u.name) + '</b>' + (u.company ? ' (' + esc(u.company) + ')' : '') + '<br>Email: ' + esc(u.email) + '</p>' +
      '<table style="width:100%;border-collapse:collapse"><tr><th align="left" style="border-bottom:1px solid #ccc;padding:8px 0">Description</th><th align="right" style="border-bottom:1px solid #ccc">Amount</th></tr>' +
      '<tr><td style="padding:12px 0">' + esc(i.desc) + '</td><td align="right">' + money(i.amount) + '</td></tr></table>' +
      '<p>Due date: ' + fdate(i.due) + '<br>Status: <b>' + esc(i.status) + '</b>' + (i.paidAt ? ' on ' + ftime(i.paidAt) : '') + '</p><p style="color:#5A5F82">Demo invoice generated by the Stackly client portal.</p></body></html>';
  }
  function payModal(id) {
    var inv = mine('invoices').filter(function (x) { return x.id === id; })[0];
    if (!inv || inv.status === 'Paid') return;
    A.modal({
      title: 'Pay ' + inv.id,
      body: '<p class="m-msg">' + esc(inv.desc) + '</p><div class="sc"><small>Amount</small><b>' + money(inv.amount) + '</b></div>' +
        '<div class="opts"><label class="opt"><input type="radio" name="pm" value="Card" checked> Credit or debit card</label><label class="opt"><input type="radio" name="pm" value="UPI"> UPI</label><label class="opt"><input type="radio" name="pm" value="Net banking"> Net banking</label></div>' +
        '<p class="m-msg">This is a demo. No real payment is taken.</p>',
      actions: [{ label: 'Cancel' }, {
        label: 'Pay ' + money(inv.amount), cls: 'btn-gold', primary: true,
        onClick: function (close, m) {
          var method = $('input[name=pm]:checked', m).value;
          update(function (d) { var q = d.invoices.filter(function (x) { return x.id === id; })[0]; q.status = 'Paid'; q.paidAt = Date.now(); q.method = method; });
          A.notifyAdmins(me().name + ' paid ' + id + ' (' + money(inv.amount) + ') by ' + method + '.');
          A.toast('Payment recorded for ' + id); Shell.rerender();
        }
      }]
    });
  }
  views.invoices = {
    title: 'Invoices',
    render: function (el) {
      var all = mine('invoices'), list = all.filter(function (i) { return iFilter === 'All' || i.status === iFilter; });
      var paid = all.filter(function (i) { return i.status === 'Paid'; }).reduce(function (s, i) { return s + i.amount; }, 0);
      var pend = all.filter(function (i) { return i.status === 'Pending'; }).reduce(function (s, i) { return s + i.amount; }, 0);
      el.innerHTML = '<div class="panel"><div class="p-head"><h3>Invoices</h3><div class="tabs small">' +
        ['All', 'Pending', 'Paid'].map(function (f) { return '<button type="button" data-act="filter" data-arg="' + f + '" class="' + (iFilter === f ? 'on' : '') + '">' + f + '</button>'; }).join('') + '</div></div>' +
        '<div class="sum"><div><small>Paid so far</small><b>' + money(paid) + '</b></div><div><small>Waiting for payment</small><b>' + money(pend) + '</b></div></div>' +
        (list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Invoice</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th class="r">Actions</th></tr></thead><tbody>' +
          list.map(function (i) {
            return '<tr class="s-item"><td data-label="Invoice"><b>' + esc(i.id) + '</b></td><td data-label="Description">' + esc(i.desc) + '</td><td data-label="Amount">' + money(i.amount) + '</td><td data-label="Due">' + fdate(i.due) + '</td>' +
              '<td data-label="Status">' + pill({ Paid: 'p-ok', Pending: 'p-warn' }, i.status) + '</td><td class="r cell-acts"><div class="acts">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-act="dl" data-arg="' + esc(i.id) + '">Download</button>' +
              (i.status === 'Pending' ? '<button type="button" class="btn btn-gold btn-sm" data-act="pay" data-arg="' + esc(i.id) + '">Pay now</button>' : '') + '</div></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="empty">No invoices in this view.</p>') + '</div>';
      on(el, function (act, arg) {
        if (act === 'filter') { iFilter = arg; Shell.rerender(); }
        if (act === 'pay') payModal(arg);
        if (act === 'dl') {
          var i = all.filter(function (x) { return x.id === arg; })[0];
          A.download(arg + '.html', invoiceHtml(i), 'text/html'); A.toast('Invoice downloaded');
        }
      });
    }
  };

  /* ---------- support ---------- */
  function tkCard(t) {
    var thread = '<div class="thread"><div><small>You, ' + ftime(t.created) + '</small><p>' + esc(t.msg) + '</p></div>' +
      t.replies.map(function (r) { return '<div><small>' + (r.from === 'admin' ? esc(r.name || 'Stackly team') : 'You') + ', ' + ftime(r.at) + '</small><p>' + esc(r.text) + '</p></div>'; }).join('') + '</div>';
    return '<article class="panel tk s-item"><div class="tk-top"><div><h3>' + esc(t.subject) + '</h3><div class="meta"><span>' + esc(t.id) + '</span><span>Priority ' + esc(t.priority) + '</span></div></div>' + pill(TS, t.status) + '</div>' + thread +
      '<div class="reply-row"><input data-rin="' + esc(t.id) + '" maxlength="400" placeholder="Write a reply" aria-label="Reply to ' + esc(t.subject) + '"><button type="button" class="btn btn-ghost btn-sm" data-act="reply" data-arg="' + esc(t.id) + '">Send reply</button></div>' +
      '<div class="acts">' + (openTk(t) || t.status === 'Resolved' ? '<button type="button" class="btn btn-line btn-sm" data-act="close" data-arg="' + esc(t.id) + '">Close ticket</button>' : '<button type="button" class="btn btn-line btn-sm" data-act="reopen" data-arg="' + esc(t.id) + '">Reopen ticket</button>') + '</div></article>';
  }
  views.support = {
    title: 'Support',
    render: function (el) {
      var list = mine('tickets').sort(function (a, b) { return b.created - a.created; });
      el.innerHTML = '<div class="panel"><h3>Open a new ticket</h3><p class="muted">Tell us what is wrong and how urgent it is.</p><form id="tf" class="contact" novalidate>' +
        '<div class="form-grid"><div class="field"><label for="ts">Subject</label><input id="ts" maxlength="80"></div><div class="field"><label for="tp">Priority</label><select id="tp"><option>Low</option><option selected>Medium</option><option>High</option></select></div>' +
        '<div class="field full"><label for="tm">What do you need help with?</label><textarea id="tm" rows="3" maxlength="600"></textarea></div></div><div><button class="btn btn-gold btn-sm" type="submit">Submit ticket</button></div></form></div>' +
        (list.length ? list.map(tkCard).join('') : '<p class="empty panel">No tickets yet.</p>');
      $('#tf', el).addEventListener('submit', function (e) {
        e.preventDefault();
        var s = $('#ts', el).value.trim(), m = $('#tm', el).value.trim();
        if (!s) return bad('Add a subject.', $('#ts', el));
        if (m.length < 10) return bad('Describe the problem in at least 10 characters.', $('#tm', el));
        var pr = $('#tp', el).value, newId;
        update(function (d) { newId = A.nextNum(d.tickets, 'T-', 300); d.tickets.push({ id: newId, clientId: ID, subject: s, priority: pr, status: 'Open', msg: m, created: Date.now(), replies: [] }); });
        A.notifyAdmins(me().name + ' opened ticket ' + newId + ': ' + s + '.');
        A.toast('Ticket ' + newId + ' created'); Shell.rerender();
      });
      function reply(id) {
        var inp = $('[data-rin="' + id + '"]', el), text = inp.value.trim();
        if (!text) return bad('Write a reply first.', inp);
        update(function (d) { var t = d.tickets.filter(function (x) { return x.id === id; })[0]; t.replies.push({ from: 'client', name: me().name, text: text, at: Date.now() }); if (!openTk(t)) t.status = 'Open'; });
        A.notifyAdmins(me().name + ' replied on ticket ' + id + '.'); A.toast('Reply sent'); Shell.rerender();
      }
      $$('[data-rin]', el).forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); reply(i.dataset.rin); } }); });
      on(el, function (act, arg) {
        if (act === 'reply') reply(arg);
        if (act === 'close' || act === 'reopen') {
          update(function (d) { d.tickets.filter(function (x) { return x.id === arg; })[0].status = act === 'close' ? 'Closed' : 'Open'; });
          A.notifyAdmins(me().name + (act === 'close' ? ' closed ' : ' reopened ') + 'ticket ' + arg + '.');
          A.toast('Ticket ' + (act === 'close' ? 'closed' : 'reopened')); Shell.rerender();
        }
      });
    }
  };

  /* ---------- settings ---------- */
  views.settings = {
    title: 'Settings',
    render: function (el) {
      var u = me(), pr = db().prefs[ID] || { email: true, sms: false, weekly: true };
      function sw(key, label, hint) {
        return '<div class="set-row"><div><b>' + label + '</b><small>' + hint + '</small></div><label class="sw"><input type="checkbox" data-pref="' + key + '"' + (pr[key] ? ' checked' : '') + ' aria-label="' + label + '"><span></span></label></div>';
      }
      el.innerHTML =
        '<div class="cols even"><div class="panel"><h3>Profile</h3><p class="muted">Your details appear on invoices and messages.</p><form id="pf2" class="contact" novalidate>' +
        '<div class="field"><label for="sid">Login email</label><div class="idrow"><input id="sid" value="' + esc(u.email) + '" readonly><button type="button" class="btn btn-line btn-sm" data-copy-id>Copy</button></div><span class="hint">This is the email you signed in with.</span></div>' +
        '<div class="field"><label for="sn">Full name</label><input id="sn" value="' + esc(u.name) + '" maxlength="60"></div>' +
        '<div class="field"><label for="sc">Company</label><input id="sc" value="' + esc(u.company || '') + '" maxlength="60"></div>' +
        '<div><button type="submit" class="btn btn-gold btn-sm">Save profile</button></div></form></div>' +
        '<div class="panel"><h3>Change password</h3><p class="muted">Use at least 8 characters with a letter and a number.</p><form id="pw2" class="contact" novalidate>' +
        '<div class="field"><label for="p0">Current password</label><input id="p0" type="password" autocomplete="current-password"></div>' +
        '<div class="field"><label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password"></div>' +
        '<div class="field"><label for="p2">Confirm new password</label><input id="p2" type="password" autocomplete="new-password"></div>' +
        '<div><button type="submit" class="btn btn-gold btn-sm">Update password</button></div></form></div></div>' +
        '<div class="cols even"><div class="panel"><h3>Notifications</h3>' + sw('email', 'Email updates', 'Milestones, invoices and ticket replies') + sw('sms', 'Text message alerts', 'Only for urgent issues') + sw('weekly', 'Weekly progress summary', 'Every Monday morning') + '</div>' +
        '<div class="panel"><h3>Your data and session</h3><p class="muted">Download everything we hold for your account or sign out of this device.</p><div class="quick"><button type="button" class="btn btn-ghost btn-sm" data-act="export">Download my data</button><button type="button" class="btn btn-danger btn-sm" data-logout>Log out</button></div></div></div>';

      $('#pf2', el).addEventListener('submit', function (e) {
        e.preventDefault();
        var n = $('#sn', el).value.trim();
        if (!n) return bad('Your name cannot be empty.', $('#sn', el));
        update(function (d) { var x = d.users[ID]; x.name = n; x.company = $('#sc', el).value.trim(); });
        Shell.refresh(); A.toast('Profile saved');
      });
      $('#pw2', el).addEventListener('submit', function (e) {
        e.preventDefault();
        var c = $('#p0', el).value, n = $('#p1', el).value, n2 = $('#p2', el).value;
        if (c !== me().password) return bad('Your current password is not correct.', $('#p0', el));
        if (n.length < 8 || !/[A-Za-z]/.test(n) || !/\d/.test(n)) return bad('New password needs 8 or more characters, with a letter and a number.', $('#p1', el));
        if (n !== n2) return bad('The new passwords do not match.', $('#p2', el));
        update(function (d) { d.users[ID].password = n; });
        $('#pw2', el).reset(); A.toast('Password updated');
      });
      $$('[data-pref]', el).forEach(function (c) {
        c.addEventListener('change', function () { update(function (d) { d.prefs[ID] = d.prefs[ID] || {}; d.prefs[ID][c.dataset.pref] = c.checked; }); A.toast('Preference saved'); });
      });
      on(el, function (act) {
        if (act === 'export') {
          var d = db(), u2 = JSON.parse(JSON.stringify(d.users[ID])); delete u2.password;
          A.download('stackly-' + A.slug(u2.email || ID) + '-data.json', JSON.stringify({ account: u2, projects: mine('projects'), invoices: mine('invoices'), tickets: mine('tickets'), messages: d.messages[ID] || [] }, null, 2), 'application/json');
          A.toast('Data downloaded');
        }
      });
    }
  };

  Shell.mount({
    role: 'client', views: views,
    nav: [{ id: 'overview', label: 'Overview', icon: 'home' }, { id: 'projects', label: 'Projects', icon: 'folder' }, { id: 'messages', label: 'Messages', icon: 'chat' },
      { id: 'invoices', label: 'Invoices', icon: 'receipt' }, { id: 'support', label: 'Support', icon: 'help' }, { id: 'settings', label: 'Settings', icon: 'gear' }],
    badges: function () {
      return {
        invoices: mine('invoices').filter(function (i) { return i.status === 'Pending'; }).length,
        support: mine('tickets').filter(openTk).length
      };
    }
  });
})();