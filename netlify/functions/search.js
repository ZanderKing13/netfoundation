// Church search. Keys come from Netlify environment variables, never from source code.
const PLACES = "https://places.googleapis.com/v1/places:searchText";
const GEO = "https://maps.googleapis.com/maps/api/geocode/json";
const FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,nextPageToken";
const RADII = [5, 10, 25, 50, 100];
const GUESS = [["lutheran", "Lutheran"], ["catholic", "Roman Catholic"], ["orthodox", "Eastern Orthodox"], ["episcopal", "Anglican / Episcopal"], ["anglican", "Anglican / Episcopal"], ["presbyterian", "Presbyterian"], ["methodist", "Methodist"], ["baptist", "Baptist"], ["reformed", "Reformed"], ["pentecostal", "Pentecostal"], ["assembl", "Pentecostal"], ["mennonite", "Mennonite"], ["brethren", "Brethren"], ["evangelical", "Evangelical"], ["wesleyan", "Wesleyan"], ["alliance", "Christian & Missionary Alliance"], ["congregational", "Congregational"], ["united church of christ", "Congregational"]];
const DEMO = [["Sample Lutheran Church", "Lutheran", .02, -.02], ["Sample Catholic Church", "Roman Catholic", -.02, .01], ["Sample Baptist Church", "Baptist", .03, .03], ["Sample Community Church", "Non-Denominational Christian", -.03, -.03]];
const cache = new Map();

const miles = (a, b, c, d) => { const r = Math.PI / 180, h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 3958.8 * 2 * Math.asin(Math.sqrt(h)); };
const reply = (code, obj) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

function buildQuery(den, body) {
  if (body) {
    const m = body.match(/\(([A-Z]+)\)/);
    if (m) return `${m[1]} ${den} church`;
    if (!body.startsWith("Other") && body !== den) return `${body} church`;
  }
  return den ? `${den} church` : "Christian church";
}

async function geocode(text, key) {
  const r = await fetch(`${GEO}?address=${encodeURIComponent(text)}&key=${key}`);
  const d = await r.json();
  if (d.status !== "OK") throw new Error(`Couldn't find that location (${d.status}): ${d.error_message || "Try a city, state, or ZIP."}`);
  const g = d.results[0];
  return [g.geometry.location.lat, g.geometry.location.lng, g.formatted_address];
}

async function placesSearch(query, lat, lng, radius, key) {
  const dlat = radius / 69, dlng = radius / (69 * Math.max(Math.cos(lat * Math.PI / 180), 0.01));
  const body = { textQuery: query, includedType: "church", strictTypeFiltering: true, pageSize: 20,
    locationRestriction: { rectangle: { low: { latitude: lat - dlat, longitude: lng - dlng }, high: { latitude: lat + dlat, longitude: lng + dlng } } } };
  let out = [];
  for (let i = 0; i < 2; i++) {
    const r = await fetch(PLACES, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) throw new Error((d.error && d.error.message) || "Google Places request failed.");
    out = out.concat(d.places || []);
    if (!d.nextPageToken) break;
    body.pageToken = d.nextPageToken;
  }
  return out;
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const den = (q.denomination || "").trim(), bodyName = (q.body || "").trim();
  const radius = RADII.includes(+q.radius) ? +q.radius : 25;
  const text = (q.q || "").trim().slice(0, 120);
  let lat = parseFloat(q.lat), lng = parseFloat(q.lng), label = "your location";
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    if (!hasCoords) { lat = 44.5133; lng = -88.0133; label = "Green Bay, Wisconsin (demo)"; }
    const churches = DEMO.map(([name, denomination, a, b], i) => ({ id: "demo" + i, name, denomination, denominationGroup: "", address: "123 Sample St (fictional)", latitude: lat + a, longitude: lng + b, phone: "", website: "", distance: miles(lat, lng, lat + a, lng + b) }));
    return reply(200, { demo: true, origin: { lat, lng, label }, churches });
  }
  try {
    if (!hasCoords) {
      if (!text) return reply(400, { error: "Enter a city, state, or ZIP code, or use your location." });
      [lat, lng, label] = await geocode(text, key);
    }
    const ck = [lat.toFixed(3), lng.toFixed(3), radius, den, bodyName].join("|");
    let churches; const hit = cache.get(ck);
    if (hit && Date.now() - hit[0] < 600000) churches = hit[1];
    else {
      const places = await placesSearch(buildQuery(den, bodyName), lat, lng, radius, key);
      churches = places.filter(p => p.id).map(p => {
        const name = (p.displayName && p.displayName.text) || "Church", loc = p.location || {};
        const g = GUESS.find(([k]) => name.toLowerCase().includes(k));
        return { id: p.id, placeId: p.id, name, denomination: den || (g ? g[1] : "Christian church"), denominationGroup: bodyName,
          address: p.formattedAddress || "", latitude: loc.latitude, longitude: loc.longitude, phone: p.nationalPhoneNumber || "",
          website: p.websiteUri || "", mapsUri: p.googleMapsUri || "", distance: miles(lat, lng, loc.latitude ?? lat, loc.longitude ?? lng) };
      }).filter(c => c.distance <= radius).sort((a, b) => a.distance - b.distance);
      cache.set(ck, [Date.now(), churches]);
    }
    return reply(200, { demo: false, origin: { lat, lng, label }, churches });
  } catch (e) {
    return reply(502, { error: e.message || "Search failed." });
  }
};
