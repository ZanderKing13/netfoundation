# The Church's One Foundation: Netlify version

public/index.html                static site
netlify/functions/search.js      church search (Google Places + Geocoding)
netlify/functions/config.js      hands the browser Maps key to the page
netlify.toml                     publish dir, functions dir, /api/* redirects

## Deploy
1. Push this folder to a GitHub repo (do NOT commit a .env file).
2. Netlify > Add new site > Import an existing project > pick the repo.
   Build command: leave blank. Publish directory: public.
3. Site configuration > Environment variables, add:
   GOOGLE_MAPS_API_KEY    (browser key)
   GOOGLE_PLACES_API_KEY  (server key)
4. Deploy. Then in Google Cloud, add your site to the browser key's HTTP referrers:
   https://YOUR-SITE.netlify.app/*   (and your custom domain, if any)
5. Server key: Netlify functions have no fixed IP, so keep Application restrictions = None,
   keep API restrictions = Geocoding API + Places API (New), and set a budget alert and daily quota cap in Google Cloud.

## Test locally (optional)
npm i -g netlify-cli, put keys in a .env file here, run `netlify dev`, open http://localhost:8888
(add http://localhost:8888/* to the browser key's referrers).
