const DEG = Math.PI / 180

/**
 * Approximate position of the point on Earth where the Sun is directly
 * overhead, for a given instant (NOAA / low-precision solar ephemeris).
 * Accurate to a few hundredths of a degree, which is far beyond what is
 * visible here.
 *
 * @param {Date} date
 * @returns {{ lat: number, lon: number }} degrees, lon east-positive
 */
export function subsolarPoint(date) {
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0

  // Mean longitude and mean anomaly of the Sun
  const L = (280.46 + 0.9856474 * n) % 360
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG

  // Ecliptic longitude
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG
  const obliquity = (23.439 - 0.0000004 * n) * DEG

  // Declination == latitude of the subsolar point
  const lat = Math.asin(Math.sin(obliquity) * Math.sin(lambda)) / DEG

  // Right ascension and Greenwich mean sidereal time -> subsolar longitude
  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda)) / DEG
  const gmst = (280.46061837 + 360.98564736629 * n) % 360

  let lon = ra - gmst
  lon = (((lon + 180) % 360) + 360) % 360 - 180

  return { lat, lon }
}
