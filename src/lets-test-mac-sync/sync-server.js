const http = require('http');
const { execFile } = require('child_process');

const PORT = 9090;

function runJXA(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        if (error) reject(stderr || error.message);
        else resolve(stdout.trim());
      }
    );
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/reminders' && req.method === 'GET') {
    const listFilter = url.searchParams.get('lists') || '';
    const filterArray = listFilter ? listFilter.split(',').map(s => s.trim()).filter(Boolean) : [];
    const filterStr = filterArray.map(s => `"${s}"`).join(', ');

    const script = `
      const app = Application('Reminders');
      const lists = app.lists();
      const reminders = [];
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const targetLists = [${filterStr}];

      for (let i = 0; i < lists.length; i++) {
        const list = lists[i];
        const listName = list.name();
        if (targetLists.length > 0 && targetLists.indexOf(listName) === -1) continue;
        
        const todos = list.reminders();
        for (let j = 0; j < todos.length; j++) {
          const todo = todos[j];
          const completed = todo.completed();
          const compDate = todo.completionDate();
          let shouldKeep = !completed;
          if (completed && compDate) {
            const d = new Date(compDate);
            if (d >= twoDaysAgo) shouldKeep = true;
          }
          if (shouldKeep) {
            reminders.push({
              id: todo.id(),
              name: todo.name() || "Untitled",
              body: todo.body() || "",
              dueDate: todo.dueDate() ? todo.dueDate().toISOString() : null,
              completed: completed,
              completionDate: compDate ? compDate.toISOString() : null,
              list: listName,
              priority: todo.priority()
            });
          }
        }
      }
      JSON.stringify(reminders);
    `;

    try {
      const data = await runJXA(script);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.toString());
    }
  } else if (url.pathname === '/reminders/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        const script = `
          const app = Application('Reminders');
          const todo = app.reminders.byId("${id}");
          if (todo && !todo.completed()) {
            todo.completed = true;
            "ok";
          } else {
            "no_change";
          }
        `;
        const result = await runJXA(script);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.toString());
      }
    });
  } else if (url.pathname === '/calendar' && req.method === 'GET') {
    const calFilter = url.searchParams.get('calendars') || '';
    const filterArray = calFilter ? calFilter.split(',').map(s => s.trim()).filter(Boolean) : [];
    const filterStr = filterArray.map(s => `"${s}"`).join(', ');
    const range = url.searchParams.get('range') || 'today';

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (range === 'today_tomorrow') {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
    } else if (range === 'week') {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 23, 59, 59);
    }

    const script = `
      const app = Application('Calendar');
      const calendars = app.calendars();
      const events = [];
      const start = new Date("${start.toISOString()}");
      const end = new Date("${end.toISOString()}");
      const targetCalendars = [${filterStr}];

      for (let i = 0; i < calendars.length; i++) {
        const cal = calendars[i];
        const calName = cal.name();
        if (targetCalendars.length > 0 && targetCalendars.indexOf(calName) === -1) continue;
        
        const calEvents = cal.events();
        for (let j = 0; j < calEvents.length; j++) {
          const ev = calEvents[j];
          const evStart = ev.startDate();
          if (evStart >= start && evStart <= end) {
            events.push({
              id: ev.id(),
              title: ev.summary() || "Untitled",
              startDate: evStart.toISOString(),
              endDate: ev.endDate() ? ev.endDate().toISOString() : null,
              description: ev.description() || "",
              location: ev.location() || "",
              calendar: calName
            });
          }
        }
      }
      JSON.stringify(events);
    `;

    try {
      const data = await runJXA(script);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.toString());
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`macOS Sync Companion Server running at http://localhost:${PORT}`);
});
