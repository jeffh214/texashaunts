(function () {
  const D = window.HAUNT_DATA;
  const main = document.getElementById("main");
  const MONTH = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  const GUIDE = new Date(2026, 9, 3);
  const REGION_ORDER = [
    "North Texas", "Central Texas", "Houston", "Houston area", "Galveston",
    "San Antonio", "San Antonio area", "East Texas", "West Texas", "South Texas",
    "Louisiana", "Oklahoma", "Arkansas", "New Mexico"
  ];

  const state = {
    q: "",
    region: "All",
    area: "All",
    kind: "All",
    month: "October",
    year: "All",
    group: "All"
  };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  }

  function niceLink(link) {
    const host = hostOf(link.url);
    const raw = (link.text || "").trim();
    if (host.includes("christmastvschedule")) return "All-channel Halloween TV list";
    if (host.includes("californiacostumes") && /store/i.test(link.url)) return "Costume shop finder";
    if (host.includes("californiacostumes") && /online/i.test(link.url)) return "Online costume directory";
    if (host.includes("californiacostumes")) return "California Costumes";
    if (/^(here|this|amc)$/i.test(raw) || raw.length < 4) {
      if (host.includes("facebook")) return "Facebook";
      if (host.includes("imdb")) return "IMDb";
      if (host.includes("eventbrite")) return "Tickets";
      return host || "Link";
    }
    return raw;
  }

  function nightState(when) {
    const label = String(when || "");
    if (/open all year/i.test(label)) return "open";
    if (/^halloween$/i.test(label)) return "soon";
    const m = label.match(/([A-Za-z]+)\s+(\d{1,2})/);
    if (!m || MONTH[m[1].toLowerCase()] == null) return "";
    const d = new Date(2026, MONTH[m[1].toLowerCase()], Number(m[2]));
    if (d.getMonth() === GUIDE.getMonth() && d.getDate() === GUIDE.getDate()) return "tonight";
    return d < GUIDE ? "open" : "soon";
  }

  function pill(item) {
    if (item.status && item.status !== "Listed") {
      return `<span class="pill closed">${esc(item.status)}</span>`;
    }
    const n = nightState(item.when);
    if (n === "tonight") return `<span class="pill tonight">Opens tonight</span>`;
    if (n === "open") return `<span class="pill open">In season</span>`;
    if (n === "soon") return `<span class="pill soon">${esc(item.when || "Upcoming")}</span>`;
    if (item.when) return `<span class="pill">${esc(item.when)}</span>`;
    return "";
  }

  function detail(item) {
    return [item.city, item.hours].filter(Boolean).join(" · ");
  }

  function visit(item) {
    if (!item.url) return "";
    const label = item.linkKind === "Facebook" ? "Facebook" : "Visit";
    return `<a class="go" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  }

  function ticket(item) {
    const line = detail(item);
    return `<article class="ticket">
      <p class="kicker">${esc(item.region || item.area || item.place || item.kind || "Listing")}</p>
      <h3>${esc(item.name)}</h3>
      ${line ? `<p class="sub">${esc(line)}</p>` : ""}
      <div class="ticket-bot">${pill(item)} ${visit(item)}</div>
    </article>`;
  }

  function match(item, q) {
    if (!q) return true;
    const blob = [item.name, item.city, item.hours, item.region, item.area, item.place, item.when, item.status, item.group, item.kind, item.state, item.note, item.summary, item.title]
      .filter(Boolean).join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => blob.includes(w));
  }

  function sortRegions(names) {
    return [...names].sort((a, b) => {
      const ia = REGION_ORDER.indexOf(a);
      const ib = REGION_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  }

  function dateValue(when) {
    const m = String(when || "").match(/([A-Za-z]+)\s+(\d{1,2})/);
    if (!m || MONTH[m[1].toLowerCase()] == null) {
      if (/multiple/i.test(when || "")) return -1;
      if (/halloween/i.test(when || "")) return 1031;
      if (/all year/i.test(when || "")) return 0;
      return 9999;
    }
    return MONTH[m[1].toLowerCase()] * 100 + Number(m[2]);
  }

  function sheet(inner) {
    main.innerHTML = `<div class="sheet">${inner}</div>`;
    const current = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "";
    document.querySelectorAll(".nav a").forEach((a) => {
      a.setAttribute("aria-current", a.dataset.route === current ? "page" : "false");
      if (a.getAttribute("aria-current") !== "page") a.removeAttribute("aria-current");
    });
  }

  function chips(values, key, label) {
    const all = ["All", ...values];
    return `<div class="chips" role="group" aria-label="${esc(label)}">${all.map((v) => {
      const pressed = state[key] === v;
      return `<button class="chip" type="button" data-key="${esc(key)}" data-value="${esc(v)}" aria-pressed="${pressed}">${esc(v)}</button>`;
    }).join("")}</div>`;
  }

  function toolbar(placeholder) {
    return `<div class="toolbar">
      <label class="sr-only" for="filter-q">Search</label>
      <input id="filter-q" type="search" value="${esc(state.q)}" placeholder="${esc(placeholder)}">
    </div>`;
  }

  function heroArt() {
    return `<div class="hero-art">
      <svg viewBox="0 0 640 420" role="img" aria-label="Night illustration of a haunted farmhouse, bats, and jack-o-lanterns">
        <rect width="640" height="420" fill="#070605"/>
        <circle cx="470" cy="108" r="62" fill="#ffb347"/>
        <circle cx="498" cy="92" r="52" fill="#070605"/>
        <path d="M0 300 C80 270 120 320 200 290 C280 260 300 250 380 280 C470 314 520 250 640 286 L640 420 L0 420 Z" fill="#1a100c"/>
        <path d="M0 348 C90 324 150 368 250 346 C360 320 430 358 640 334 L640 420 L0 420 Z" fill="#0c0908"/>
        <g fill="#100a09">
          <path d="M168 292 L214 214 L260 292 Z"/>
          <rect x="176" y="248" width="76" height="92"/>
          <rect x="202" y="286" width="22" height="36" fill="#ff7a18"/>
          <rect x="186" y="262" width="14" height="16" fill="#ffb347"/>
          <rect x="228" y="262" width="14" height="16" fill="#ffb347"/>
        </g>
        <g fill="#ff7a18">
          <ellipse cx="108" cy="334" rx="22" ry="16"/>
          <ellipse cx="156" cy="340" rx="16" ry="12"/>
          <ellipse cx="78" cy="342" rx="14" ry="10"/>
        </g>
        <g fill="#140800">
          <path d="M98 332 h6 l3 5 h-12z"/>
          <path d="M116 332 h6 l3 5 h-12z"/>
          <path d="M100 342 h16 l-8 6z"/>
        </g>
        <path d="M108 312 v12" stroke="#2f6b32" stroke-width="3"/>
        <path d="M36 168 c18 10 10 22 28 28" fill="none" stroke="#ff7a18" stroke-width="3"/>
        <path d="M560 150 l16 6 -16 6 3-6z" fill="#ffb347"/>
        <path d="M500 188 l12 4 -12 4 2-4z" fill="#ff7a18"/>
      </svg>
      <p class="hero-caption">Opening weekend · Oct 3</p>
    </div>`;
  }

  function home() {
    document.title = "Texas Haunts — 2026 Field Guide";
    const tonight = D.weekend.filter((i) => nightState(i.when) === "tonight");
    const regions = sortRegions([...new Set(D.directory.map((i) => i.region).filter(Boolean))]);
    sheet(`
      <section class="hero">
        <div>
          <p class="eyebrow">Field guide · Texas and the border states</p>
          <h1>Where to get scared this October.</h1>
          <p class="lede">Haunted houses, hayrides, city parties, ghost walks, and the movies still on a screen. Built from this season’s public listings, then set in type you can actually read.</p>
          <form class="search" id="home-search" role="search">
            <label class="sr-only" for="q">Search haunts, towns, and events</label>
            <input id="q" name="q" placeholder="Try Plano, Junkyard, or ghost tour">
            <button type="submit">Search the guide</button>
          </form>
        </div>
        ${heroArt()}
      </section>
      <div class="alert"><strong>Weather.</strong> ${esc(D.alert)}</div>
      <div class="stats">
        <a class="stat" href="#/directory"><strong>${D.counts.directory}</strong><span>haunted attractions</span></a>
        <a class="stat" href="#/weekend"><strong>${tonight.length}</strong><span>opening tonight</span></a>
        <a class="stat" href="#/parties"><strong>${D.counts.parties}</strong><span>DFW parties</span></a>
        <a class="stat" href="#/reviews"><strong>${D.reviews.length}</strong><span>scored visits</span></a>
      </div>
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">October 3</p>
            <h2>Opening tonight</h2>
          </div>
          <a class="more" href="#/weekend">All weekend gates</a>
        </div>
        <div class="grid">${tonight.map(ticket).join("") || `<p class="empty">No new gates are marked for tonight. Houses that opened yesterday are already in season.</p>`}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Season notes</h2></div>
        <div class="news-row">${D.news.map((n) => `<article class="news-card">
          <p class="kicker">${esc(n.kicker)}</p>
          <h3>${esc(n.title)}</h3>
          <p class="sub">${esc(n.text)}</p>
          ${n.url ? `<div class="ticket-bot"><a class="linkish" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(n.url))}</a></div>` : ""}
        </article>`).join("")}</div>
      </section>
      <section class="section">
        <div class="section-head">
          <div>
            <p class="eyebrow">From the notebook</p>
            <h2>Reviews worth keeping</h2>
          </div>
          <a class="more" href="#/reviews">All reviews</a>
        </div>
        <div class="stack">${D.reviews.filter((r) => /2026|Open/.test(r.status)).slice(0, 3).map(reviewCard).join("")}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>Browse by region</h2><p>The same regions used in the statewide list.</p></div>
        <div class="chips">${regions.map((r) => `<a class="chip" href="#/directory?region=${encodeURIComponent(r)}">${esc(r)}</a>`).join("")}</div>
      </section>
    `);
  }

  function reviewCard(r) {
    const score = r.score == null ? `<div class="score">—<small> notes</small></div>` : `<div class="score">${esc(r.score)}<small> /10</small></div>`;
    return `<article class="review">
      ${score}
      <div>
        <p class="kicker">${esc(r.place)} · ${esc(String(r.year))}</p>
        <h3>${esc(r.name)}</h3>
        <span class="pill ${/closed/i.test(r.status) ? "closed" : "open"}">${esc(r.status)}</span>
      </div>
      <div class="body">
        <p>${esc(r.summary)}</p>
        <div class="links">
          ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Official page</a>` : ""}
          <a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">Original write-up</a>
        </div>
      </div>
    </article>`;
  }

  function weekend() {
    document.title = "Opening this weekend — Texas Haunts";
    const items = D.weekend.filter((i) => match(i, state.q) && (state.region === "All" || i.region === state.region));
    const regions = sortRegions([...new Set(D.weekend.map((i) => i.region))]);
    sheet(`
      <p class="eyebrow">October 1–3</p>
      <h1>Gates opening this weekend.</h1>
      <p class="lede">New houses for the first weekend of October. If a date has already passed, that haunt is in season — hours below are for opening night.</p>
      ${toolbar("Search a haunt or town")}
      ${chips(regions, "region", "Region")}
      <p class="countline" aria-live="polite">${items.length} opening${items.length === 1 ? "" : "s"}</p>
      ${grouped(items, (i) => i.region, (i) => i.when)}
    `);
  }

  function calendar() {
    document.title = "Opening calendar — Texas Haunts";
    const items = D.calendar.filter((i) => match(i, state.q) && (state.region === "All" || i.region === state.region));
    const regions = sortRegions([...new Set(D.calendar.map((i) => i.region))]);
    sheet(`
      <p class="eyebrow">Full season</p>
      <h1>When the houses open.</h1>
      <p class="lede">Hours are for opening night. Attractions change their schedule through October, so check the night you plan to attend.</p>
      ${toolbar("Search the calendar")}
      ${chips(regions, "region", "Region")}
      <p class="countline" aria-live="polite">${items.length} opening nights</p>
      ${grouped(items, (i) => i.region, (i) => i.when)}
    `);
  }

  function directory() {
    document.title = "Haunted attractions — Texas Haunts";
    const items = D.directory.filter((i) => match(i, state.q) && (state.region === "All" || i.region === state.region));
    const regions = sortRegions([...new Set(D.directory.map((i) => i.region))]);
    sheet(`
      <p class="eyebrow">Statewide list</p>
      <h1>The houses still on the map.</h1>
      <p class="lede">Every attraction in the 2026 statewide list, including a few already marked closed. Links go to the operator’s site or Facebook page.</p>
      ${toolbar("Search haunts")}
      ${chips(regions, "region", "Region")}
      <p class="countline" aria-live="polite">${items.length} attractions</p>
      <div class="grid">${items.map(ticket).join("") || empty()}</div>
    `);
  }

  function parties() {
    document.title = "Halloween parties — Texas Haunts";
    const items = D.parties
      .filter((i) => match(i, state.q) && (state.area === "All" || i.area === state.area))
      .sort((a, b) => dateValue(a.when) - dateValue(b.when) || a.name.localeCompare(b.name));
    const areas = ["Dallas County", "DFW surrounding", "Tarrant County"];
    sheet(`
      <p class="eyebrow">Dallas–Fort Worth</p>
      <h1>Parties, crawls, and pumpkin tables.</h1>
      <p class="lede">City events for Dallas County, Tarrant County, and the suburbs around them. Times come from the season listings and can move.</p>
      ${toolbar("Search parties")}
      ${chips(areas, "area", "Area")}
      <p class="countline" aria-live="polite">${items.length} events</p>
      ${grouped(items, (i) => i.area, (i) => i.when)}
    `);
  }

  function reviews() {
    document.title = "Reviews — Texas Haunts";
    sheet(`
      <p class="eyebrow">Scored visits</p>
      <h1>What the long write-ups actually said.</h1>
      <p class="lede">These are short original summaries of published reviews, with the year of the visit. Scores are historical. Screams, the Elm Mott houses, and Halls of Horror have since closed.</p>
      <div class="stack">${D.reviews.map(reviewCard).join("")}</div>
    `);
  }

  function screen() {
    document.title = "Horror on screen — Texas Haunts";
    const months = [...new Set(D.movies.map((m) => m.month))];
    const movies = D.movies.filter((m) => (state.month === "All" || m.month === state.month) && match(m, state.q));
    const tv = D.tv.map((block) => {
      const extra = block.links.filter((l) => /christmastvschedule/.test(l.url));
      const links = block.links.filter((l) => !/christmastvschedule/.test(l.url));
      return { ...block, links, extra };
    });
    const extraLinks = D.tv.flatMap((b) => b.links).filter((l) => /christmastvschedule/.test(l.url));
    sheet(`
      <p class="eyebrow">October nights indoors</p>
      <h1>Movies, marathons, and two Dallas roofs.</h1>
      <p class="lede">New horror still ahead this month, the theaters that program it, and the cable marathons worth knowing about.</p>
      <div class="two">
        <article class="panel">
          <p class="kicker">Inwood · Cine Insomnia</p>
          <h2>Friday nights at 10</h2>
          <ul class="plain-list">${D.inwood.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ul>
          ${D.inwood[0] ? `<div class="links"><a href="${esc(D.inwood[0].url)}" target="_blank" rel="noopener noreferrer">Inwood lineup</a></div>` : ""}
        </article>
        <article class="panel">
          <p class="kicker">Lower Greenville</p>
          <h2>Sundown at Granada</h2>
          <ul class="plain-list">${D.granada.map((s) => `<li>${esc(s.title)}</li>`).join("")}</ul>
          ${D.granada[0] ? `<div class="links"><a href="${esc(D.granada[0].url)}" target="_blank" rel="noopener noreferrer">Sundown at Granada</a></div>` : ""}
        </article>
      </div>
      <section class="section">
        <h2>2026 horror releases</h2>
        ${toolbar("Search a title")}
        ${chips(months, "month", "Month")}
        <div class="grid">${movies.map((m) => `<article class="ticket">
          <p class="kicker">${esc(m.month)}</p>
          <h3>${esc(m.name)}</h3>
          <p class="sub">${esc(m.when)}</p>
          <div class="ticket-bot">${m.url ? `<a class="go" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">IMDb</a>` : ""}</div>
        </article>`).join("") || empty()}</div>
      </section>
      <section class="section">
        <h2>Theaters</h2>
        <div class="grid">${D.theaters.map((t) => `<article class="ticket">
          <p class="kicker">${esc(t.group)}</p>
          <h3>${esc(t.name)}</h3>
          <div class="ticket-bot">${t.url ? `<a class="go" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(t.url))}</a>` : ""}</div>
        </article>`).join("")}</div>
      </section>
      <section class="section">
        <h2>On television</h2>
        <div class="stack">${tv.map((b) => `<article class="screen-block">
          <p class="kicker">Marathon</p>
          <h3>${esc(b.title)}</h3>
          <p class="sub">${esc(b.blurb)}</p>
          <div class="links">${b.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(niceLink(l))}</a>`).join("")}</div>
        </article>`).join("")}
        ${extraLinks.length ? `<article class="screen-block">
          <p class="kicker">Every channel</p>
          <h3>Broadcast and cable Halloween grid</h3>
          <p class="sub">A schedule site that started as a Christmas guide and now keeps a Halloween section too.</p>
          <div class="links">${extraLinks.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(niceLink(l))}</a>`).join("")}</div>
        </article>` : ""}
        </div>
      </section>
    `);
  }

  function harvest() {
    document.title = "Pumpkin patches and mazes — Texas Haunts";
    const items = D.patches.filter((i) => match(i, state.q) && (state.region === "All" || i.region === state.region));
    const regions = sortRegions([...new Set(D.patches.map((i) => i.region))]);
    sheet(`
      <p class="eyebrow">Patches, mazes, hayrides</p>
      <h1>Daylight scares and pumpkin mud.</h1>
      <p class="lede">Farms and mazes across Texas, Louisiana, Arkansas, Oklahoma, and New Mexico.</p>
      ${toolbar("Search a farm or town")}
      ${chips(regions, "region", "Region")}
      <p class="countline" aria-live="polite">${items.length} places</p>
      <div class="grid">${items.map(ticket).join("") || empty()}</div>
    `);
  }

  function ghosts() {
    document.title = "Ghost tours and haunted places — Texas Haunts";
    const items = D.ghosts.filter((i) => match(i, state.q) && (state.kind === "All" || i.kind === state.kind) && (state.region === "All" || i.state === state.region));
    const states = [...new Set(D.ghosts.map((i) => i.state))];
    const kinds = [...new Set(D.ghosts.map((i) => i.kind))];
    sheet(`
      <p class="eyebrow">Paranormal</p>
      <h1>Places with a reputation, and people who will walk you through them.</h1>
      <p class="lede">Reading lists for haunted sites, then tour companies in Texas, Louisiana, Arkansas, Oklahoma, and New Mexico.</p>
      ${toolbar("Search a tour or town")}
      ${chips(kinds, "kind", "Kind")}
      ${chips(states, "region", "State")}
      <p class="countline" aria-live="polite">${items.length} links</p>
      <div class="grid">${items.map((i) => ticket({ ...i, region: i.state, city: i.kind })).join("") || empty()}</div>
    `);
  }

  function shopLabel(group) {
    const map = {
      "In Person and online": "Decor · in store and online",
      "Online only": "Decor · online",
      "Online": "Costumes · online",
      "Costume Shops Adult Online": "Adult costumes · online",
      "Pet Costumes": "Pet costumes",
      "Costume Shops In Person and online": "Costume shops"
    };
    return map[group] || group;
  }

  function shops() {
    document.title = "Costumes and decor — Texas Haunts";
    const groups = [...new Set(D.shops.map((s) => shopLabel(s.group)))];
    const items = D.shops.filter((s) => {
      const labeled = { ...s, group: shopLabel(s.group), city: s.place };
      return match(labeled, state.q) && (state.group === "All" || shopLabel(s.group) === state.group);
    });
    sheet(`
      <p class="eyebrow">Costumes and props</p>
      <h1>Where the decorations actually are.</h1>
      <p class="lede">Seasonal shops, prop houses, and local costume counters. Grocery and drugstore aisles still carry candy and decor, they just do not list it online.</p>
      <div class="links" style="margin-bottom:1rem">
        ${D.shopLinks.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(niceLink(l))}</a>`).join("")}
      </div>
      ${toolbar("Search a shop")}
      ${chips(groups, "group", "Kind of shop")}
      <p class="countline" aria-live="polite">${items.length} shops</p>
      <div class="grid">${items.map((s) => ticket({
        name: s.name,
        region: shopLabel(s.group),
        city: s.place,
        url: s.url,
        linkKind: s.linkKind
      })).join("") || empty()}</div>
    `);
  }

  function memorial() {
    document.title = "Closed haunts — Texas Haunts";
    sheet(`
      <p class="eyebrow">Gone dark</p>
      <h1>Houses that finished their run.</h1>
      <p class="lede">A short roll of retired haunts. The notes are original, drawn from the public record of when they opened, where they stood, and why they stopped.</p>
      <div class="grid">${D.epitaphs.map((e) => `<article class="epitaph">
        <p class="kicker">${esc(e.place)}</p>
        <h3>${esc(e.name)}</h3>
        <p class="sub">${esc(e.note)}</p>
      </article>`).join("")}</div>
      <section class="section">
        <h2>Also closed</h2>
        <ul class="notable">${D.notable.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      </section>
    `);
  }

  function archiveDate(s) {
    const m = String(s || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!m) return { label: s || "", year: "Undated", sort: 0 };
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      label: `${Number(m[1])} ${months[Number(m[2]) - 1]} ${m[3]}`,
      year: m[3],
      sort: Number(m[3] + m[2] + m[1])
    };
  }

  function archive() {
    document.title = "Archive — Texas Haunts";
    const rows = D.archive.map((a) => ({ ...a, ...archiveDate(a.date) }))
      .filter((a) => (state.year === "All" || a.year === state.year) && match({ name: a.title, city: (a.categories || []).join(" ") }, state.q))
      .sort((a, b) => b.sort - a.sort);
    const years = [...new Set(D.archive.map((a) => archiveDate(a.date).year))].sort((a, b) => b.localeCompare(a));
    const groups = new Map();
    rows.forEach((row) => {
      if (!groups.has(row.year)) groups.set(row.year, []);
      groups.get(row.year).push(row);
    });
    sheet(`
      <p class="eyebrow">Source notebook</p>
      <h1>Every post, back to 2018.</h1>
      <p class="lede">${D.counts.archive} posts from the original site. Titles link through to the full entry. Older hours and ticket prices belong to the year they were written.</p>
      ${toolbar("Search the archive")}
      ${chips(years, "year", "Year")}
      <p class="countline" aria-live="polite">${rows.length} posts</p>
      ${[...groups.entries()].map(([year, list]) => `<section>
        <h2 class="group-title">${esc(year)}</h2>
        <ul class="archive-list">${list.map((a) => `<li>
          <span class="when">${esc(a.label)}</span>
          <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>
          <span class="cats">${esc((a.categories || []).join(", "))}</span>
        </li>`).join("")}</ul>
      </section>`).join("") || empty()}
    `);
  }

  function grouped(items, major, minor) {
    if (!items.length) return empty();
    const majors = sortRegions([...new Set(items.map(major))]);
    return majors.map((name) => {
      const slice = items.filter((i) => major(i) === name);
      const dates = [...new Set(slice.map(minor))].sort((a, b) => dateValue(a) - dateValue(b));
      const body = dates.map((d) => {
        const group = slice.filter((i) => minor(i) === d);
        return `<h3 class="group-title">${esc(d || "Listed")}</h3><div class="grid">${group.map(ticket).join("")}</div>`;
      }).join("");
      return `<section class="section"><h2>${esc(name || "Listed")}</h2>${body}</section>`;
    }).join("");
  }

  function empty() {
    return `<p class="empty">Nothing matches that search. Try a town, a haunt name, or clear the filters.</p>`;
  }

  const views = {
    "": home,
    weekend, calendar, directory, parties, reviews, screen, harvest, ghosts, shops, memorial, archive
  };

  function readParams() {
    const raw = location.hash.replace(/^#\/?/, "");
    const q = raw.split("?")[1] || "";
    return new URLSearchParams(q);
  }

  let lastPath = null;
  function render() {
    const path = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "";
    if (path !== lastPath) {
      state.q = "";
      state.region = "All";
      state.area = "All";
      state.kind = "All";
      state.month = path === "screen" ? "October" : "All";
      state.year = "All";
      state.group = "All";
      const params = readParams();
      if (params.get("q")) state.q = params.get("q");
      if (params.get("region")) state.region = params.get("region");
      lastPath = path;
    }
    (views[path] || home)();
    main.focus({ preventScroll: true });
  }

  main.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip || !chip.dataset.key) return;
    const key = chip.dataset.key;
    const value = chip.dataset.value;
    state[key] = value;
    const path = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "";
    lastPath = path;
    (views[path] || home)();
    const again = [...document.querySelectorAll(".chip")].find((el) => el.dataset.key === key && el.dataset.value === value);
    if (again) again.focus();
  });

  main.addEventListener("input", (event) => {
    if (event.target.id !== "filter-q") return;
    state.q = event.target.value;
    const path = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "";
    lastPath = path;
    const pos = event.target.selectionStart;
    (views[path] || home)();
    const box = document.getElementById("filter-q");
    if (box) {
      box.focus();
      box.setSelectionRange(pos, pos);
    }
  });

  main.addEventListener("submit", (event) => {
    if (event.target.id !== "home-search") return;
    event.preventDefault();
    const q = new FormData(event.target).get("q") || "";
    lastPath = null;
    location.hash = "#/directory?q=" + encodeURIComponent(String(q));
  });

  window.addEventListener("hashchange", render);
  render();
})();
