# -*- coding: utf-8 -*-
"""Pull public listing facts from texashaunts.net into data.js."""
import json
import re
import urllib.request
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TexasHauntsGuide/1.0)"}
OUT = r"z:\Web Development\texas-haunts\data.js"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

REGIONS = {
    "north texas", "houston", "houston area", "san antonio", "san antonio area",
    "east texas", "west texas", "south texas", "louisiana", "oklahoma", "arkansas",
    "central texas", "galveston", "new mexico",
}

DATE_RE = re.compile(
    r"^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}$",
    re.I,
)
TIME_RE = re.compile(
    r"(\d{1,2}(?::\d{2})?\s*(?:am|pm)|midnight|dusk|dark\b|hours tba|opens\b|tickets\b|ticket booth|"
    r"timed\b|low scare|regular opening|festival opens|all drinks|box office|gate opens|lobby|"
    r"midway|sold in|time slot|their market)",
    re.I,
)
CLOSED_RE = re.compile(r"(permanently closed|closed for 2026|closed in 2026)", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read()


def norm(s):
    if not s:
        return ""
    s = (
        s.replace("\xa0", " ")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\ufffd", "'")
    )
    return re.sub(r"\s+", " ", s).strip()


def clean_url(href):
    if not href:
        return ""
    href = href.strip()
    if href.startswith("mailto:") or href.startswith("javascript:"):
        return ""
    if "google.com/url" in href:
        q = parse_qs(urlparse(href).query).get("q", [""])[0]
        if q:
            href = q
    parts = urlparse(href)
    if not parts.scheme:
        return href
    drop = {"fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"}
    q = [(k, v) for k, v in parse_qs(parts.query, keep_blank_values=False).items() if k.lower() not in drop]
    flat = []
    for k, vals in q:
        for v in vals:
            flat.append((k, v))
    return urlunparse((parts.scheme, parts.netloc, parts.path, "", urlencode(flat), ""))


def link_kind(url):
    host = urlparse(url).netloc.lower()
    if "facebook.com" in host:
        return "Facebook"
    if "eventbrite." in host or "allevents.in" in host:
        return "Tickets"
    if "imdb.com" in host:
        return "IMDb"
    return "Site"


def split_detail(detail):
    detail = norm(detail).strip(" -")
    status = ""
    m = CLOSED_RE.search(detail)
    if m:
        status = m.group(1).strip().title() if m.group(1).lower() != "permanently closed" else "Permanently closed"
        if m.group(1).lower() == "closed for 2026":
            status = "Closed for 2026"
        if m.group(1).lower() == "closed in 2026":
            status = "Closed in 2026"
        detail = norm(CLOSED_RE.sub("", detail)).strip(" -.,")
    tm = TIME_RE.search(detail)
    if not tm:
        return detail, "", status
    city = detail[: tm.start()].strip(" -.,")
    hours = detail[tm.start() :].strip()
    return city, hours, status


def paragraphs(post):
    sc = post.select_one(".storycontent")
    return sc.find_all("p") if sc else []


def post_meta(post):
    h = post.select_one("h3.storytitle a")
    title = norm(h.get_text(" ", strip=True)) if h else ""
    url = h.get("href") if h else ""
    meta = post.select_one(".meta")
    date = ""
    cats = []
    if meta:
        text = norm(meta.get_text(" ", strip=True))
        date = text.split("Filed under")[0].strip(" -")
        cats = [norm(a.get_text()) for a in meta.select("a")]
    return {"title": title, "url": url, "date": date, "categories": cats}


def anchors(para):
    out = []
    for a in para.find_all("a"):
        href = clean_url(a.get("href") or "")
        text = norm(a.get_text(" ", strip=True))
        if not href or not text:
            continue
        if "texashaunts.net" in href and "/category/" not in href and "/20" not in href:
            continue
        if "wordpress.org" in href or "76creative" in href or "samburdge" in href:
            continue
        out.append({"text": text, "url": href, "kind": link_kind(href)})
    return out


def is_region(text):
    return norm(text).lower() in REGIONS


def is_date_label(text):
    t = norm(text)
    if DATE_RE.match(t):
        return True
    low = t.lower()
    return low in {"multiple dates", "open all year", "halloween", "july/august", "september", "october"}


def item_from_para(para, region, when):
    links = anchors(para)
    full = norm(para.get_text(" ", strip=True))
    if not full:
        return None
    if links:
        name = links[0]["text"]
        rest = full
        if rest.lower().startswith(name.lower()):
            rest = rest[len(name) :].strip(" -")
        city, hours, status = split_detail(rest)
        return {
            "name": name,
            "city": city,
            "hours": hours,
            "status": status or "Listed",
            "region": region,
            "when": when,
            "url": links[0]["url"],
            "linkKind": links[0]["kind"],
            "links": links,
        }
    city, hours, status = split_detail(full)
    # unlinked line: treat whole line as the name if no time, else name is city portion
    if hours:
        return {
            "name": city or full,
            "city": "",
            "hours": hours,
            "status": status or "Listed",
            "region": region,
            "when": when,
            "url": "",
            "linkKind": "",
            "links": [],
        }
    return {
        "name": full,
        "city": "",
        "hours": "",
        "status": status or "Listed",
        "region": region,
        "when": when,
        "url": "",
        "linkKind": "",
        "links": [],
    }


def parse_region_dated(post):
    region = ""
    when = ""
    items = []
    notes = []
    for para in paragraphs(post):
        em = para.find("em")
        links = anchors(para)
        text = norm(para.get_text(" ", strip=True))
        if not text:
            continue
        if text.lower().startswith("urgent:") or text.lower().startswith("hours are for opening"):
            notes.append(text)
            continue
        region_text = norm(em.get_text(" ", strip=True)) if em else ""
        if region_text and is_region(region_text):
            region = region_text
            if links:
                item = item_from_para(para, region, when)
                if item:
                    items.append(item)
            continue
        if not links and is_region(text):
            region = text
            continue
        if not links and is_date_label(text):
            when = text
            continue
        if not links and len(text) > 180:
            notes.append(text)
            continue
        item = item_from_para(para, region, when)
        if item:
            items.append(item)
    return items, notes


def parse_shops(post):
    group = "Merchandise"
    place = "National"
    items = []
    intro_links = []
    for i, para in enumerate(paragraphs(post)):
        text = norm(para.get_text(" ", strip=True))
        links = anchors(para)
        if not text:
            continue
        if i == 0:
            intro_links = links
            continue
        if not links and len(text) < 50:
            known_places = {
                "dfw", "houston", "austin", "san antonio", "west texas", "south texas",
                "louisiana", "arkansas", "oklahoma", "new mexico",
            }
            known_groups = {
                "merchandise", "in person and online", "online only", "costume shops",
                "online", "costume shops adult online", "pet costumes",
                "costume shops in person and online",
            }
            low = text.lower()
            if low in known_groups:
                group = text
                if low in {"merchandise", "costume shops", "pet costumes"}:
                    place = "National" if low != "costume shops in person and online" else place
                if low == "costume shops in person and online":
                    place = "Texas & nearby"
                continue
            if low in known_places:
                place = text
                continue
            group = text
            continue
        if links:
            items.append({
                "name": links[0]["text"],
                "url": links[0]["url"],
                "linkKind": links[0]["kind"],
                "group": group,
                "place": place,
            })
        elif text:
            items.append({
                "name": text, "url": "", "linkKind": "", "group": group, "place": place,
            })
    return items, intro_links


def parse_paranormal(post):
    kind = "Haunted places"
    state = ""
    items = []
    for para in paragraphs(post):
        text = norm(para.get_text(" ", strip=True))
        links = anchors(para)
        if not text:
            continue
        if text in {"Haunted Places", "Ghost Tours"}:
            kind = "Haunted places" if text == "Haunted Places" else "Ghost tours"
            state = ""
            continue
        if not links and text in {
            "Texas", "Louisiana", "Arkansas", "Oklahoma", "New Mexico",
        }:
            state = text
            continue
        if links:
            items.append({
                "name": links[0]["text"],
                "url": links[0]["url"],
                "kind": kind,
                "state": state or "Regional",
            })
    return items


def parse_movies(post):
    bucket = ""
    movies = []
    theaters = []
    for para in paragraphs(post):
        text = norm(para.get_text(" ", strip=True))
        links = anchors(para)
        if not text:
            continue
        if text in {
            "July/August", "September", "October",
            "Theaters Showing Vintage Horror Movies",
            "Theaters Showing Vintage and First Run Horror Movies in October",
        }:
            bucket = text
            continue
        if bucket.startswith("Theaters"):
            theaters.append({
                "name": links[0]["text"] if links else text,
                "url": links[0]["url"] if links else "",
                "group": "Vintage houses" if "Vintage Horror" in bucket and "First Run" not in bucket else "October houses",
            })
            continue
        name = links[0]["text"] if links else text
        rest = text
        if links and rest.lower().startswith(name.lower()):
            rest = rest[len(name):].strip(" .")
        movies.append({
            "name": name,
            "when": rest,
            "month": bucket,
            "url": links[0]["url"] if links else "",
        })
    return movies, theaters


def parse_screenings(post, venue):
    items = []
    blurb = ""
    venue_url = ""
    for i, para in enumerate(paragraphs(post)):
        text = norm(para.get_text(" ", strip=True))
        links = anchors(para)
        if not text:
            continue
        if i == 0:
            blurb_links = links
            if blurb_links:
                venue_url = blurb_links[0]["url"]
            blurb = text
            continue
        items.append({"title": text, "venue": venue, "url": venue_url})
    return items, blurb, venue_url


def parse_tv(post):
    blocks = []
    current = None
    for para in paragraphs(post):
        text = norm(para.get_text(" ", strip=True))
        links = anchors(para)
        if not text:
            continue
        if not links and len(text) < 80:
            current = {"title": text, "links": [], "note": ""}
            blocks.append(current)
            continue
        if current is None:
            current = {"title": "Season guides", "links": [], "note": ""}
            blocks.append(current)
        current["links"].extend(links)
        if not current["note"]:
            # keep a short factual label, not the source paragraph
            current["note"] = ""
    return blocks


def parse_simple_lines(post):
    lines = []
    for para in paragraphs(post):
        text = norm(para.get_text(" ", strip=True))
        if text:
            lines.append({"text": text, "links": anchors(para)})
    return lines


def load_pages():
    pages = []
    html = fetch("https://texashaunts.net/")
    pages.append(BeautifulSoup(html, "html.parser"))
    for n in range(2, 10):
        try:
            html = fetch(f"https://texashaunts.net/page/{n}/")
        except Exception:
            break
        pages.append(BeautifulSoup(html, "html.parser"))
    return pages


def main():
    pages = load_pages()
    home = pages[0]
    by_title = {}
    archive = []
    for soup in pages:
        for post in soup.select("div.post"):
            meta = post_meta(post)
            if not meta["title"]:
                continue
            archive.append(meta)
            if meta["title"] not in by_title:
                by_title[meta["title"]] = post

    def need(title):
        if title not in by_title:
            raise SystemExit("missing post: " + title)
        return by_title[title]

    weekend, weekend_notes = parse_region_dated(need("Haunted Houses Opening This Weekend"))
    calendar, calendar_notes = parse_region_dated(need("Haunted House Opening Dates"))
    directory, _ = parse_region_dated(need("Statewide Haunted House Listings"))
    dallas, _ = parse_region_dated(need("Halloween Parties and Events Dallas County 2026"))
    dfw, _ = parse_region_dated(need("Halloween Parties and Events DFW Surrounding Area 2026"))
    tarrant, _ = parse_region_dated(need("Halloween Parties And Events Tarrant County 2026"))
    for item in dallas:
        item["area"] = "Dallas County"
    for item in dfw:
        item["area"] = "DFW surrounding"
    for item in tarrant:
        item["area"] = "Tarrant County"
    parties = dallas + dfw + tarrant

    patches, _ = parse_region_dated(need("Pumpkin Patches, Corn Mazes, and Hayrides"))
    shops, shop_links = parse_shops(need("Halloween Merchandise and Costume Links"))
    ghosts = parse_paranormal(need("Paranormal Places and Ghost Tours"))
    movies, theaters = parse_movies(need("New and Vintage Horror/SciFi Movies 2026"))
    inwood, inwood_blurb, inwood_url = parse_screenings(
        need("Cine Insomnia Scary Spaces at the Inwood Theater"), "Inwood Theater"
    )
    granada, granada_blurb, granada_url = parse_screenings(
        need("Horror Movies at Sundown at Granada"), "Sundown at Granada"
    )
    tv = parse_tv(need("Horror/SCIFI TV Shows October 2026"))

    # Hand-written epitaphs. Facts only, original wording.
    epitaphs = [
        ("Screams Halloween Theme Park", "Waxahachie", "1996-2024. Five-attraction Halloween park on FM 66. The 2024 season was the last."),
        ("Tayman Graveyard", "Midlothian", "2005-2021. Built on the grounds of the earlier Tayman Manor."),
        ("Dallas Scaregrounds", "Dallas Design District", "Grew out of Dr. Blood's into a haunt festival. Closed when the Design District was redeveloped."),
        ("Fatal End / The Dollhouse", "Dallas West End", "Opened in the late 2000s. Necroplex merged with it in 2011. Redevelopment ended the run."),
        ("Dallas Slaughterhouse", "Dallas", "Started in the West End, moved to Deep Ellum, and merged with J&F in Garland in 2016."),
        ("Dungeon of Doom", "Arlington", "Original show was in the Arlington Museum of Art basement and closed after 2007."),
        ("Necroplex", "Italy, Texas", "Opened in 2008 south of Waxahachie and merged with Fatal End in 2011."),
        ("Tayman Manor", "Midlothian", "Intense 1990s and early-2000s haunt. Lost in a fire, along with most of neighboring Addamsville."),
        ("Addamsville", "Midlothian", "Haunt park beside Tayman Manor, open only in 2002 and 2003."),
        ("Dr. Haunt's Chamber of Fear", "Gainesville", "Roadside haunt staffed by college volunteers through the 2000s."),
        ("Terrorplex", "Mansfield", "Small park of four or five houses south of Arlington. Mead Manor was the strongest of them."),
        ("Lafitte's Landing", "Allen", "Pirate-themed house from the mid-2000s, with one later season in Allen."),
        ("Phantom's Haunted House", "Lewisville / Frisco / Allen", "Moved from Lewisville to Frisco, spent three seasons at the State Fair, and finished in Allen."),
        ("Faustas Sanitarium", "Cleburne", "Upstairs in Wright Plaza from the 1990s until about 2003."),
        ("Haunt House", "Caddo Mills", "Small haunt off the I-30 access road. Early user of shock pads."),
        ("Ripley's Haunted House", "Grand Prairie", "Wax-museum haunt inside Ripley's during the 2000s."),
        ("Strangling Brothers Haunted Circus", "Irving / Grand Prairie", "Trailer-circus haunt for three DFW seasons starting in 2013. A Utah version continued."),
        ("Reindeer Manor / 13th Street Morgue", "Red Oak / Waxahachie", "Opened in 1974 in Red Oak. After late moves to Grand Prairie and Waxahachie, 2025 was the final season."),
    ]

    rip_post = need("RIP")
    notable = []
    grab = False
    for para in paragraphs(rip_post):
        text = norm(para.get_text(" ", strip=True))
        if text.lower().startswith("other notable"):
            grab = True
            continue
        if grab and text:
            notable.append(text)

    reviews = [
        {
            "name": "Scarborough's Hollow",
            "year": 2025,
            "score": None,
            "place": "Waxahachie",
            "status": "Open for 2026",
            "url": "https://srfestival.com/",
            "source": "https://texashaunts.net/2025/10/13/scarborough-hollow-review/",
            "summary": "A fantasy fall festival on the Scarborough Faire grounds, with three haunted attractions inside a smaller renaissance-fair layout. It is a different event from the old Screams park. Saturdays run 2pm-10pm from mid-October into November, with a later close on Halloween night.",
        },
        {
            "name": "Cutting Edge Haunted House",
            "year": 2019,
            "score": 10,
            "place": "Fort Worth",
            "status": "Still listed for 2026",
            "url": "https://www.cuttingedgehauntedhouse.com/",
            "source": "https://texashaunts.net/2019/10/14/cutting-edge-haunted-house-review/",
            "summary": "A top-scored Fort Worth haunt on East Lancaster, just west of the I-30 and I-35 interchange. The 2019 visit treated it as a full professional show and a season priority. Timed tickets are the usual way in.",
        },
        {
            "name": "Texas Scaregrounds",
            "year": 2019,
            "score": 9,
            "place": "Mineral Wells",
            "status": "Still listed for 2026",
            "url": "https://www.facebook.com/CHAOSHauntedHouse/",
            "source": "https://texashaunts.net/2019/10/12/texas-scaregrounds-review/",
            "summary": "Mineral Wells haunt open Friday and Saturday nights in October, plus Halloween. The 2019 ticket was about $20, with a food-drive discount and separate ghost-hunting tickets.",
        },
        {
            "name": "Thrillvania",
            "year": 2019,
            "score": 9,
            "place": "Terrell",
            "status": "Still listed for 2026",
            "url": "https://www.thrillvania.com/",
            "source": "https://texashaunts.net/2019/10/12/thrillvania-haunted-house-park-review/",
            "summary": "Haunt park at the southeast corner of I-20 and Wilson Road in Terrell, about half an hour east of downtown Dallas. Admission is sold in timed blocks.",
        },
        {
            "name": "Screams Halloween Theme Park",
            "year": 2019,
            "score": 10,
            "place": "Waxahachie",
            "status": "Closed after 2024",
            "url": "",
            "source": "https://texashaunts.net/2019/10/06/screams-halloween-theme-park/",
            "summary": "The long-running Waxahachie park on FM 66 earned a perfect score in both 2018 and 2019 for a grounds full of major haunted attractions. It is closed. The last season was 2024.",
        },
        {
            "name": "Dead Zone & Chainsaw Nightmare",
            "year": 2019,
            "score": 9.5,
            "place": "Elm Mott",
            "status": "Closed",
            "url": "",
            "source": "https://texashaunts.net/2019/09/30/waco-haunted-houses/",
            "summary": "Two houses on the I-35 access road in Elm Mott, about ten minutes north of Waco, scored 9.5 in 2019. The Elm Mott complex is on the closed list now.",
        },
        {
            "name": "Parker House",
            "year": 2018,
            "score": 9.5,
            "place": "Denton",
            "status": "Still listed for 2026",
            "url": "https://www.hauntedhousedenton.com/",
            "source": "https://texashaunts.net/2018/10/06/parker-house/",
            "summary": "Denton haunt on Highway 380, a little over two miles west of I-35. The entrance is easy to miss on the north side of University Drive. Still on the 2026 North Texas list.",
        },
        {
            "name": "Halls of Horror",
            "year": 2018,
            "score": 9,
            "place": "Lewisville",
            "status": "Closed",
            "url": "",
            "source": "https://texashaunts.net/2018/09/29/halls-of-horror/",
            "summary": "A mall haunt on the second floor of Music City Mall in Lewisville, across from the food court. Scored a 9 in its first season and has since closed.",
        },
    ]

    news = [
        {
            "title": "Rain check before you drive",
            "kicker": "This weekend",
            "text": "Heavy rain was expected into the opening weekend. Check the haunt's own site for cancellations before you leave.",
            "url": "",
        },
        {
            "title": "Junkyard opens a third location",
            "kicker": "Dallas",
            "text": "Old City Park joins the Sylvan Street and Fort Worth Junkyard gates on October 2. Hours are 8pm-midnight, tickets are $25, and parking is free.",
            "url": "https://www.junkyardhauntedhouse.com/",
        },
        {
            "title": "Pumpkin Nights at Howell Farms",
            "kicker": "Arlington",
            "text": "An all-ages trail of lighted pumpkin zones, plus a village with fire shows, carving, and a haunted house. Runs from September 17 through Halloween. Tickets are timed, and parking is $10 a car.",
            "url": "https://dallas.pumpkinnights.com/",
        },
        {
            "title": "Denton's 31 Days of Halloween",
            "kicker": "Denton",
            "text": "The city season starts October 1 with a kickoff and pumpkin drop at the civic center, 6pm-8pm. The city site lists the rest of the month.",
            "url": "https://www.dentonhalloween.com/",
        },
        {
            "title": "Spirit Halloween stores are up",
            "kicker": "Shops",
            "text": "Spirit published its 2026 store list. Use the store finder for the seasonal shop nearest you.",
            "url": "https://stores.spirithalloween.com/",
        },
    ]

    tv_blurbs = {
        "AMC FearFest": "AMC's October horror marathon. The 2026 host is the Crypt Keeper.",
        "Shudder 61 Days of Halloween": "Shudder's fall marathon started September 1. Subscribe on Shudder or through Prime Video.",
        "TCM October Horror": "Turner Classic Movies posted a full October horror schedule.",
        "MeTV Boonanza 2026": "MeTV's October marathon, hosted in part by Svengoolie.",
        "FreeForm's 31 Nights of Halloween": "Freeform's nightly Halloween movie block for October.",
        "The Food Network 2026 Halloween Schedule": "Halloween Wars and Halloween Baking Championship lead the Food Network's fall slate, which started in mid-September.",
    }

    for block in tv:
        block["blurb"] = tv_blurbs.get(block["title"], "Season schedule and related links.")
        # de-dupe links
        seen = set()
        uniq = []
        for link in block["links"]:
            if link["url"] in seen:
                continue
            seen.add(link["url"])
            uniq.append(link)
        block["links"] = uniq

    data = {
        "source": "https://texashaunts.net/",
        "season": 2026,
        "asOf": "2026-10-03",
        "alert": "Heavy rain was in the forecast for opening weekend. Confirm the night you want on the haunt's own site before you go.",
        "news": news,
        "weekend": weekend,
        "calendar": calendar,
        "directory": directory,
        "parties": parties,
        "patches": patches,
        "shops": shops,
        "shopLinks": shop_links,
        "ghosts": ghosts,
        "movies": movies,
        "theaters": theaters,
        "inwood": inwood,
        "granada": granada,
        "tv": tv,
        "reviews": reviews,
        "epitaphs": [{"name": n, "place": p, "note": note} for n, p, note in epitaphs],
        "notable": notable,
        "archive": archive,
        "counts": {
            "weekend": len(weekend),
            "calendar": len(calendar),
            "directory": len(directory),
            "parties": len(parties),
            "patches": len(patches),
            "shops": len(shops),
            "ghosts": len(ghosts),
            "movies": len(movies),
            "archive": len(archive),
        },
    }

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.HAUNT_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(json.dumps(data["counts"], indent=2))
    print("--- weekend sample ---")
    print(json.dumps(weekend[:3], indent=2)[:800])
    print("--- directory closed ---")
    closed = [d for d in directory if d["status"] != "Listed"]
    print(len(closed))
    for c in closed:
        print(c["name"], c["city"], c["status"])
    print("--- tv ---")
    for b in tv:
        print(b["title"], len(b["links"]))
    print("--- patches sample ---")
    print(patches[0])
    print("--- party sample ---")
    print(parties[0])
    print("archive", len(archive), "pages", len(pages))


if __name__ == "__main__":
    main()
