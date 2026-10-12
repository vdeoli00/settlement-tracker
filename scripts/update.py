#!/usr/bin/env python3
"""Fetch open class action settlements and write data/settlements.json.

Sources (both published for machine reading):
  - OpenClassActions llms.txt directory (all open claims, updated daily)
  - Top Class Actions "open settlements" RSS feed (recent posts; we keep
    items seen in earlier runs until their deadline passes)

Standard library only, so the GitHub Action needs no installs.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "settlements.json")
OCA_URL = "https://openclassactions.com/llms.txt"
TCA_URL = "https://topclassactions.com/category/lawsuit-settlements/open-lawsuit-settlements/feed/"
UA = "settlement-tracker/1.0 (personal deadline tracker)"
TODAY = dt.date.today()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def parse_date(s):
    if not s:
        return None
    s = s.replace("Sept.", "Sep").replace("Sept ", "Sep ").replace(".", "")
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%m/%d/%Y"):
        try:
            return dt.datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            pass
    return None


# Number must be complete (no trailing digit/decimal) so "$59.5M" is not read as "$59".
PER_PERSON = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)(?!\d|[.,]\d)(?!\s?(?:[MBK]\b|million|billion))", re.I)


def payout_hint(text):
    """Largest per-person dollar figure mentioned (ignores fund sizes like $9M)."""
    vals = []
    for m in PER_PERSON.finditer(text or ""):
        try:
            v = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        if 0 < v < 100000:
            vals.append(v)
    return max(vals) if vals else None


def no_proof_amount(text):
    m = re.search(r"\$\s?(\d[\d,]*)\s+(?:with\s+)?no[- ]proof", text or "", re.I)
    return float(m.group(1).replace(",", "")) if m else None


# ---------------- OpenClassActions ----------------
LINE = re.compile(r"^- \[(?P<title>.+?)\]\((?P<url>https?://[^)\s]+)\):\s*(?P<desc>.*)$")


def classify_oca(desc, title):
    d = desc.lower()
    if "automatic payment" in d:
        return "automatic"
    if "no proof required" in d:
        return "none"
    if "id/code from notice" in d or "claim id" in d or "member id" in d:
        return "notice_id"
    if "documentation required" in d or "required" in d:
        return "docs"
    return "unknown"


def parse_oca(text):
    start = text.find("## Open Settlements")
    if start < 0:
        raise ValueError("directory section not found")
    end = text.find("\n## ", start + 5)
    section = text[start:end if end > 0 else None]
    items = []
    for line in section.splitlines():
        m = LINE.match(line.strip())
        if not m:
            continue
        title, url, desc = m["title"], m["url"], m["desc"]
        parts = [p.strip() for p in desc.split(" · ")]
        dl_text = ""
        if parts and parts[0].startswith("Deadline:"):
            dl_text = parts.pop(0)[len("Deadline:"):].strip()
        date_m = re.search(r"[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}", dl_text)
        deadline = parse_date(date_m.group(0)) if date_m and not dl_text.lower().startswith("pending") else None
        proof = classify_oca(desc, title)
        region = next((p for p in parts if re.search(r"residents|only|applicants|requests", p, re.I)), "")
        path = url.split("openclassactions.com/")[-1].split("/")
        category = "recall" if path[0] == "recalls" else (path[1] if len(path) > 2 else "")
        items.append({
            "id": "oca:" + url.rsplit("/", 1)[-1].replace(".php", ""),
            "source": "OpenClassActions",
            "title": title,
            "url": url,
            "claim_url": None,
            "deadline": deadline.isoformat() if deadline else None,
            "deadline_text": dl_text,
            "opt_out": "(opt-out)" in dl_text.lower(),
            "proof": proof,
            "no_proof_option": proof != "none" and bool(re.search(r"no[- ]proof", title, re.I)),
            "no_proof_amount": no_proof_amount(title),
            "payout_max": payout_hint(title),
            "payout_text": title.split("—", 1)[1].strip() if "—" in title else "",
            "proof_text": " · ".join(parts),
            "region": region,
            "category": category.replace("-", " "),
            "summary": "",
        })
    return items


# ---------------- Top Class Actions ----------------
NS = {"content": "http://purl.org/rss/1.0/modules/content/"}


def strip_tags(s):
    t = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", s, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def parse_tca(xml_text):
    root = ET.fromstring(xml_text)
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        raw = it.findtext("content:encoded", namespaces=NS) or it.findtext("description") or ""
        text = strip_tags(raw)
        dl = re.search(r"Deadline\s+(\d{1,2}/\d{1,2}/\d{4})", text)
        deadline = parse_date(dl.group(1)) if dl else None
        award = re.search(r"Potential Award\s+(.*?)\s+Proof of Purchase", text)
        pop = re.search(r"Proof of Purchase\s+(.*?)\s+Claim Form", text)
        claim = re.search(r'<a[^>]+href="([^"]+)"[^>]*>(?:\s|<[^>]+>)*CLICK HERE TO FILE A CLAIM', raw, re.I)
        pop_t = pop.group(1).strip() if pop else ""
        low = text.lower()
        if re.search(r"(class member|claim|unique|notice)\s+(id|identification number|pin)\b", low):
            proof = "notice_id"
        elif pop_t.upper() in ("N/A", "NONE", "") or re.search(r"no proof|not required", pop_t, re.I):
            proof = "none" if pop_t else "unknown"
        else:
            proof = "docs"
        option = proof != "none" and bool(re.search(
            r"without (?:proof|documentation)|do not have (?:proof|documentation)|no proof of purchase"
            r"|alternative (?:cash )?payment|pro rata (?:cash )?payment|one-time payment of \$", low))
        summary = re.sub(r"^\(Photo Credit:[^)]*\)\s*", "", text)[:420]
        award_t = award.group(1).strip() if award else ""
        items.append({
            "id": "tca:" + link.rstrip("/").rsplit("/", 1)[-1],
            "source": "Top Class Actions",
            "title": title,
            "url": link,
            "claim_url": claim.group(1) if claim else None,
            "deadline": deadline.isoformat() if deadline else None,
            "deadline_text": dl.group(1) if dl else "",
            "opt_out": False,
            "proof": proof,
            "no_proof_option": option,
            "no_proof_amount": None,
            "payout_max": payout_hint(award_t),
            "payout_text": award_t if award_t.upper() not in ("TBD", "VARIES", "N/A") else "",
            "proof_text": ("Proof of purchase: " + pop_t) if pop_t else "",
            "region": "",
            "category": "",
            "summary": summary,
        })
    return items


# ---------------- state restrictions ----------------
STATES = {"AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado",
          "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
          "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
          "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
          "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
          "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
          "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
          "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
          "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
          "WI": "Wisconsin", "WY": "Wyoming"}
WHO = r"(?:residents?|citizens|consumers|customers|drivers|members|employees|workers|applicants|policyholders|patients|students|tenants|homeowners|users|individuals|people|persons)"
STATE_LAW = r"(?:wage|PAGA|labor|privacy|Consumer Privacy Act|Biometric|insurance|PIP|UMPD|car insurance|unclaimed)"


def detect_region(title, summary):
    """Best-effort: which US states a settlement is limited to, judged from its title and summary."""
    text = f"{title}. {summary or ''}"
    found = []
    if re.search(r"\bBIPA\b|Illinois Biometric Information Privacy Act", text):
        found.append("IL")
    if re.search(r"\bNew York City\b", title):
        found.append("NY")
    for code, name in sorted(STATES.items(), key=lambda kv: -len(kv[1])):
        n = re.escape(name)
        if code == "VA":  # don't let "West Virginia" count as Virginia
            n = r"(?<!West )Virginia"
        if (re.search(rf"\b{WHO} (?:of|in|from) (?:the state of )?{n}\b", text)
                or re.search(rf"\b(?:live|lived|living|reside|resided|residing|located|worked|work) in (?:the state of )?{n}\b", text)
                or re.search(rf"\b{n} {WHO}\b", text)
                or re.search(rf"\b{n}(?:'s|’s)? {STATE_LAW}\b", title)):
            found.append(code)
    found = list(dict.fromkeys(found))
    # Several states usually means a list of examples, not a restriction.
    return f"{', '.join(found)} residents" if 0 < len(found) <= 3 else ""


# ---------------- merge ----------------
STOP = {"the", "a", "an", "inc", "llc", "co", "corp", "class", "action", "settlement", "data", "breach"}


def company_key(title):
    t = re.sub(r"\$[\d.,]+\s?(?:[mbk]\b)?", " ", title.lower())
    t = re.split(r"\s[—–-]\s|:|\bclass action\b|\bsettlement\b", t)[0]
    words = [w for w in re.findall(r"[a-z0-9&']+", t) if w not in STOP]
    return " ".join(words[:2])


def main():
    prev = {"items": []}
    if os.path.exists(OUT):
        with open(OUT) as f:
            prev = json.load(f)
    prev_by_src = {}
    for it in prev.get("items", []):
        prev_by_src.setdefault(it["source"], []).append(it)

    status = {}
    try:
        oca = parse_oca(fetch(OCA_URL))
        if len(oca) < 20:
            raise ValueError(f"only {len(oca)} rows parsed; format may have changed")
        status["OpenClassActions"] = {"ok": True, "count": len(oca)}
    except Exception as e:  # keep last good data if the source breaks
        print("OCA failed:", e, file=sys.stderr)
        oca = prev_by_src.get("OpenClassActions", [])
        status["OpenClassActions"] = {"ok": False, "error": str(e)[:200], "count": len(oca)}

    try:
        fresh = parse_tca(fetch(TCA_URL))
        # Feed only holds recent posts: keep older ones until their deadline passes.
        seen = {i["id"] for i in fresh}
        tca = fresh + [i for i in prev_by_src.get("Top Class Actions", []) if i["id"] not in seen]
        status["Top Class Actions"] = {"ok": True, "count": len(fresh)}
    except Exception as e:
        print("TCA failed:", e, file=sys.stderr)
        tca = prev_by_src.get("Top Class Actions", [])
        status["Top Class Actions"] = {"ok": False, "error": str(e)[:200], "count": len(tca)}

    def is_open(i):
        return not i["deadline"] or dt.date.fromisoformat(i["deadline"]) >= TODAY

    # Prefer OpenClassActions rows; fold matching TCA rows into them (claim link, summary, payout).
    merged = {i["id"]: dict(i, also=[]) for i in oca if is_open(i)}
    by_key = {}
    for i in merged.values():
        by_key.setdefault(company_key(i["title"]), i)
    for t in tca:
        if not is_open(t):
            continue
        k = company_key(t["title"])
        base = by_key.get(k) if k else None
        if base and (not base["deadline"] or not t["deadline"] or base["deadline"] == t["deadline"]):
            base["also"].append({"source": t["source"], "url": t["url"]})
            base["claim_url"] = base["claim_url"] or t["claim_url"]
            base["summary"] = base["summary"] or t["summary"]
            base["payout_text"] = base["payout_text"] or t["payout_text"]
            base["payout_max"] = base["payout_max"] or t["payout_max"]
        else:
            merged[t["id"]] = dict(t, also=[])

    # first_seen powers the "New" badge. Items already present before this field existed get an
    # old date so the first run doesn't flag everything as new.
    prev_seen = {i["id"]: i.get("first_seen") for i in prev.get("items", [])}
    had_field = any(prev_seen.values())
    for i in merged.values():
        if prev_seen.get(i["id"]):
            i["first_seen"] = prev_seen[i["id"]]
        elif i["id"] in prev_seen and not had_field:
            i["first_seen"] = "2000-01-01"
        else:
            i["first_seen"] = TODAY.isoformat()

    for i in merged.values():
        if not i.get("region") or "residents" not in i["region"]:
            r = detect_region(i["title"], i.get("summary", ""))
            if r and not i.get("region"):
                i["region"] = r

    items = sorted(merged.values(), key=lambda i: (i["deadline"] or "9999", i["title"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                   "sources": status, "items": items}, f, indent=1)
    print(f"wrote {len(items)} open settlements", status)
    if not any(s["ok"] for s in status.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
