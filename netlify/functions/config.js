// Gives the browser its (referrer-restricted) Maps key from a Netlify environment variable.
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify({ mapsKey: process.env.GOOGLE_MAPS_API_KEY || "" }),
});
