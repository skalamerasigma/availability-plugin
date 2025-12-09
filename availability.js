document.addEventListener("DOMContentLoaded", () => {
    const london = document.getElementById("progress-london");
    const ny = document.getElementById("progress-ny");
    const sf = document.getElementById("progress-sf");
  
    const markerLondon = document.getElementById("marker-london");
    const markerNY = document.getElementById("marker-ny");
    const markerSF = document.getElementById("marker-sf");
  
    const overlapLonNy = document.getElementById("overlap-lon-ny");
    const overlapNySf  = document.getElementById("overlap-ny-sf");
  
    const cursor = document.getElementById("cursor");
    const incomingTime = document.getElementById("incoming-time");
    const localTime = document.getElementById("local-time");
  
    const zoneEls = document.querySelectorAll(".zones .zone");
    const intensityEl = document.getElementById("intensity");
  
    const timelineHours = 24;
  
    // ---- Simulation flag ----
    const simulate = true;     // set to false for real time
    const simSpeed = 15 / 60;  // hours per second (1s = 15m)
    let simTime = 0;
  
    // City configs
    const cities = [
      { el: london, name: "London",        code: "LON", tz: "Europe/London",       start: 8,  end: 16, zoneIdx: 0 },
      { el: ny,     name: "New York",      code: "NYC", tz: "America/New_York",    start: 13, end: 21, zoneIdx: 1 },
      { el: sf,     name: "San Francisco", code: "SFO", tz: "America/Los_Angeles", start: 16, end: 24, zoneIdx: 2 }
    ];
  
    // Overlaps
    const overlaps = [
      { el: overlapLonNy, start: 13, end: 16 },
      { el: overlapNySf,  start: 16, end: 21 }
    ];
  
    // Agent status SVG + colors
    const STATUS = [
      { key: "away",    label: "Away",          color: "#737373" },
      { key: "call",    label: "On a call",     color: "#1e90ff" },
      { key: "lunch",   label: "Lunch Break",   color: "#f4b400" }, // pizza slice icon below
      { key: "chat",    label: "Chatting",      color: "#00c853" },
      { key: "closing", label: "Closing",       color: "#9c27b0" }
    ];
    const ICONS = {
      away: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
      call: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 3.18 2 2 0 0 1 4.11 1h2a2 2 0 0 1 2 1.72c.12.92.32 1.82.6 2.68a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.4-1.17a2 2 0 0 1 2.11-.45c.86.28 1.76.48 2.68.6A2 2 0 0 1 22 16.92Z" fill="currentColor"/>
        </svg>`,
      // Pizza slice (stylized)
      lunch: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5c5-3 11-3 16 0L12 21 4 5Z" fill="currentColor"/>
          <circle cx="10" cy="10" r="1.2" fill="#fff"/>
          <circle cx="14" cy="12" r="1" fill="#fff"/>
          <circle cx="12.5" cy="8.5" r="0.9" fill="#fff"/>
        </svg>`,
      chat: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="currentColor"/>
        </svg>`,
      closing: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="3" width="12" height="18" rx="1.5" ry="1.5" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="9" cy="12" r="1" fill="currentColor"/>
        </svg>`
    };
  
    function hourToPercent(h) { return (h / timelineHours) * 100; }
  
    function placeBandsAndMarkers() {
      cities.forEach(c => {
        c.el.style.left  = hourToPercent(c.start) + "%";
        c.el.style.width = (hourToPercent(c.end) - hourToPercent(c.start)) + "%";
      });
      markerLondon.style.left = hourToPercent(16) + "%";
      markerNY.style.left     = hourToPercent(21) + "%";
      markerSF.style.left     = hourToPercent(24) + "%";
  
      overlaps.forEach(o => {
        o.el.style.left  = hourToPercent(o.start) + "%";
        o.el.style.width = (hourToPercent(o.end) - hourToPercent(o.start)) + "%";
      });
    }
  
    // Map slider (0..100) to HSL hue: 0..50 => 120->60, 50..100 => 60->0
    function intensityToHue(value){
      const v = Math.max(0, Math.min(100, Number(value)));
      if (v <= 50){
        // green (120) to yellow (60)
        return 120 - (v/50) * 60;
      } else {
        // yellow (60) to red (0)
        return 60 - ((v-50)/50) * 60;
      }
    }
    function applyIntensity(value){
      const hue = intensityToHue(value);
      const css = `hsl(${hue} 70% 45%)`;
      document.documentElement.style.setProperty("--active-color", css);
    }
  
    function fmtTime(date, tz) {
      return new Intl.DateTimeFormat([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: tz
      }).format(date);
    }
  
    function getIncomingCity(nowUTC) {
      const after = cities.filter(c => nowUTC < c.start).sort((a,b)=>a.start-b.start);
      return after.length ? after[0] : cities[0];
    }
    function getActiveCities(nowUTC) {
      return cities.filter(c => nowUTC >= c.start && nowUTC < c.end);
    }
    function getCurrentCity(nowUTC) {
      const active = getActiveCities(nowUTC);
      if (active.length) return active.slice().sort((a,b)=>b.start - a.start)[0];
      return cities
        .map(c => ({ c, score: c.start <= nowUTC ? c.start : c.start - 24 }))
        .sort((a,b)=>b.score - a.score)[0].c;
    }
  
    function updateCursorAndResize() {
      let now = new Date();
      let nowUTC;
  
      if (simulate) {
        simTime += simSpeed;
        if (simTime >= 24) simTime = 0;
        nowUTC = simTime;
        const h = Math.floor(simTime);
        const m = Math.round((simTime - h) * 60);
        now = new Date(Date.UTC(2025, 0, 1, h, m, 0));
      } else {
        nowUTC = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
      }
  
      cursor.style.left = hourToPercent(nowUTC) + "%";
      const incoming = getIncomingCity(nowUTC);
      const current  = getCurrentCity(nowUTC);
      incomingTime.textContent = `${incoming.code} ${fmtTime(now, incoming.tz)}`;
      localTime.textContent    = `${current.code} ${fmtTime(now, current.tz)}`;
  
      const activeCities = getActiveCities(nowUTC);
  
      // Shift bands: magnify active, dim others
      cities.forEach(c => c.el.classList.remove("magnified","dim"));
      cities.forEach(c => {
        if (activeCities.includes(c)) c.el.classList.add("magnified");
        else c.el.classList.add("dim");
      });
  
      // Zones: mark active as current, others inactive
      const zoneElsArr = Array.from(zoneEls);
      zoneElsArr.forEach(z => z.classList.remove("current","inactive"));
      cities.forEach((c,i) => {
        if (activeCities.includes(c)) zoneElsArr[i].classList.add("current");
        else zoneElsArr[i].classList.add("inactive");
      });
  
      document.documentElement.style.setProperty("--timeline-height", "82px");
    }
  
    // Build agents (9 per zone) with SVG status overlays
    (function buildAgentsWithSVGStatuses() {
      function pickStatus() {
        return STATUS[Math.floor(Math.random() * STATUS.length)];
      }
      document.querySelectorAll(".agents").forEach(zone => {
        zone.innerHTML = "";
        for (let i = 0; i < 9; i++) {
          const agent = document.createElement("div");
          agent.className = "agent";
          agent.style.backgroundImage = `url("https://i.pravatar.cc/40?img=${Math.floor(Math.random()*70)}")`;
  
          const s = pickStatus();
          agent.classList.add(`status-${s.key}`);
          agent.title = s.label;
  
          const badge = document.createElement("div");
          badge.className = "status-badge";
          badge.setAttribute("role", "img");
          badge.setAttribute("aria-label", s.label);
          badge.style.color = s.color;   // SVG inherits currentColor
          badge.innerHTML = ICONS[s.key];
  
          agent.appendChild(badge);
          zone.appendChild(agent);
        }
      });
    })();
  
    // Optional: random status updates every 10s (demo)
    setInterval(() => {
      const agents = Array.from(document.querySelectorAll(".agent"));
      agents.sort(() => Math.random() - 0.5)
        .slice(0, Math.ceil(agents.length * 0.2))
        .forEach(agent => {
          agent.classList.remove("status-away","status-call","status-lunch","status-chat","status-closing");
          const s = STATUS[Math.floor(Math.random() * STATUS.length)];
          agent.classList.add(`status-${s.key}`);
          agent.title = s.label;
  
          const badge = agent.querySelector(".status-badge");
          if (badge) {
            badge.style.color = s.color;
            badge.setAttribute("aria-label", s.label);
            badge.innerHTML = ICONS[s.key];
          }
        });
    }, 10000);
  
    // Initialize
    placeBandsAndMarkers();
    applyIntensity(intensityEl.value);     // set initial color
    updateCursorAndResize();
    setInterval(updateCursorAndResize, 1000);
  
    // Slider events
    intensityEl.addEventListener("input", (e) => applyIntensity(e.target.value));
  });
  