// Real bright stars catalog (Hipparcos-based subset)
export const BRIGHT_STARS = [
  { id: 'sirius', name: 'Sirius', constellation: 'Canis Major', ra: 101.29, dec: -16.72, magnitude: -1.46, distance_ly: 8.6, spectral: 'A1V', color: 'blue', myth: 'The Dog Star, brightest in the night sky. Ancient Egyptians used its heliacal rising to predict the Nile flood. Greeks called it Seirios, meaning "glowing" or "scorching".' },
  { id: 'canopus', name: 'Canopus', constellation: 'Carina', ra: 95.99, dec: -52.70, magnitude: -0.74, distance_ly: 310, spectral: 'F0Ib', color: 'yellow', myth: 'Navigator of the ancient world. Used by spacecraft as a navigational reference. Named after the chief pilot of the Greek king Menelaus.' },
  { id: 'arcturus', name: 'Arcturus', constellation: 'Boötes', ra: 213.92, dec: 19.18, magnitude: -0.05, distance_ly: 37, spectral: 'K0IIIp', color: 'orange', myth: 'Guardian of the Bear. Its light that opened the 1933 World\'s Fair in Chicago was 40 years old when it arrived—having left the star in 1893, the year of the previous World\'s Fair.' },
  { id: 'vega', name: 'Vega', constellation: 'Lyra', ra: 279.23, dec: 38.78, magnitude: 0.03, distance_ly: 25, spectral: 'A0Va', color: 'blue', myth: 'The Falling Eagle. Formed the Summer Triangle with Deneb and Altair. In Chinese mythology, Vega is Zhī Nǚ (the weaver girl) separated from her lover Niú Láng (Altair) by the Milky Way.' },
  { id: 'capella', name: 'Capella', constellation: 'Auriga', ra: 79.17, dec: 45.99, magnitude: 0.08, distance_ly: 43, spectral: 'G8III', color: 'yellow', myth: 'The Little She-Goat. A binary star system representing the goat Amalthea who suckled Zeus. The Greek god broke off her horn, creating the cornucopia — the horn of plenty.' },
  { id: 'rigel', name: 'Rigel', constellation: 'Orion', ra: 78.63, dec: -8.20, magnitude: 0.13, distance_ly: 860, spectral: 'B8Ia', color: 'blue', myth: 'Foot of the Giant. One of the most luminous stars known — 120,000 times brighter than the Sun. In Arabic, Rijl Jauzah means "the foot of the central one".' },
  { id: 'procyon', name: 'Procyon', constellation: 'Canis Minor', ra: 114.83, dec: 5.22, magnitude: 0.37, distance_ly: 11.4, spectral: 'F5IV', color: 'yellow', myth: 'Before the Dog. Rises just before Sirius, the Dog Star. In Greek, Procyon means "before the dog". Ancient Egyptians tracked it to predict the Nile flooding season.' },
  { id: 'betelgeuse', name: 'Betelgeuse', constellation: 'Orion', ra: 88.79, dec: 7.41, magnitude: 0.42, distance_ly: 700, spectral: 'M2Iab', color: 'red', myth: 'Shoulder of Orion. A red supergiant 1000x the Sun\'s diameter — if placed at our Sun, it would engulf Mars. Expected to explode as a supernova within 100,000 years.' },
  { id: 'altair', name: 'Altair', constellation: 'Aquila', ra: 297.70, dec: 8.87, magnitude: 0.76, distance_ly: 17, spectral: 'A7V', color: 'white', myth: 'The Eagle. Spins so fast (once every 9 hours vs Earth\'s 24) it bulges at its equator. In East Asian mythology, Altair is the Cowherd star, separated from Vega by the Milky Way.' },
  { id: 'aldebaran', name: 'Aldebaran', constellation: 'Taurus', ra: 68.98, dec: 16.51, magnitude: 0.85, distance_ly: 65, spectral: 'K5III', color: 'orange', myth: 'Eye of Taurus the Bull. One of four Royal Stars of ancient Persia. Pioneer 10 spacecraft is heading toward Aldebaran and will pass it in about 2 million years.' },
  { id: 'spica', name: 'Spica', constellation: 'Virgo', ra: 201.30, dec: -11.16, magnitude: 0.97, distance_ly: 250, spectral: 'B1V', color: 'blue', myth: 'Ear of Grain. Helped Hipparchus discover the precession of equinoxes in 127 BC. One of the most luminous stars in our galaxy neighborhood.' },
  { id: 'antares', name: 'Antares', constellation: 'Scorpius', ra: 247.35, dec: -26.43, magnitude: 1.05, distance_ly: 550, spectral: 'M1Iab', color: 'red', myth: 'Rival of Mars. Its reddish color rivals Mars in the sky. A red supergiant 700x the Sun\'s diameter with a blue companion star. Ancient sailors used it for navigation.' },
  { id: 'pollux', name: 'Pollux', constellation: 'Gemini', ra: 116.33, dec: 28.03, magnitude: 1.14, distance_ly: 34, spectral: 'K0IIIb', color: 'orange', myth: 'Immortal Twin. One of the Gemini twins. Pollux (immortal) and Castor (mortal) — sons of Zeus. Pollux has a confirmed exoplanet, Pollux b.' },
  { id: 'fomalhaut', name: 'Fomalhaut', constellation: 'Piscis Austrinus', ra: 344.41, dec: -29.62, magnitude: 1.16, distance_ly: 25, spectral: 'A3Va', color: 'white', myth: 'Mouth of the Southern Fish. Called Autumn\'s Star, the "loneliest bright star" visible from mid-northern latitudes. Has a debris disk — evidence of planet formation.' },
  { id: 'deneb', name: 'Deneb', constellation: 'Cygnus', ra: 310.36, dec: 45.28, magnitude: 1.25, distance_ly: 2600, spectral: 'A2Ia', color: 'white', myth: 'Tail of the Swan. One of the most distant naked-eye stars. If Deneb were as close as Sirius, it would cast shadows at night. Part of the Summer Triangle asterism.' },
  { id: 'regulus', name: 'Regulus', constellation: 'Leo', ra: 152.09, dec: 11.97, magnitude: 1.35, distance_ly: 79, spectral: 'B8IVn', color: 'blue', myth: 'Little King. Heart of the Lion. One of the four Royal Stars. Spins so fast its equatorial diameter is 32% larger than polar. Regulus means "little king" or "prince" in Latin.' },
  { id: 'polaris', name: 'Polaris', constellation: 'Ursa Minor', ra: 37.95, dec: 89.26, magnitude: 1.97, distance_ly: 434, spectral: 'F7Ib', color: 'yellow', myth: 'The North Star. The ultimate navigation star — within 1° of the celestial north pole. Used by sailors, explorers, and enslaved people escaping via the Underground Railroad. Will remain north star for ~1000 more years.' },
  { id: 'castor', name: 'Castor', constellation: 'Gemini', ra: 113.65, dec: 31.89, magnitude: 1.58, distance_ly: 51, spectral: 'A2Vm', color: 'white', myth: 'Mortal Twin. The brighter-looking of the Gemini twins. A remarkable sextuple star system — 6 stars in a complex gravitational dance, two binary pairs and another binary.' },
  { id: 'bellatrix', name: 'Bellatrix', constellation: 'Orion', ra: 81.28, dec: 6.35, magnitude: 1.64, distance_ly: 250, spectral: 'B2III', color: 'blue', myth: 'Female Warrior. The left shoulder of Orion. In J.K. Rowling\'s Harry Potter, Bellatrix Lestrange takes her name from this star. Known as the Amazon Star.' },
  { id: 'elnath', name: 'Elnath', constellation: 'Taurus', ra: 81.57, dec: 28.61, magnitude: 1.65, distance_ly: 130, spectral: 'B7III', color: 'blue', myth: 'The Butting One. Tip of the northern horn of Taurus. Shared between Taurus and Auriga constellations. The name comes from Arabic, meaning "the butting" as in the bull butting with its horns.' },
  { id: 'miaplacidus', name: 'Miaplacidus', constellation: 'Carina', ra: 138.30, dec: -69.72, magnitude: 1.67, distance_ly: 111, spectral: 'A2IV', color: 'white', myth: 'Placid Waters. Second brightest star in Carina. Part of the old Argo Navis constellation representing Jason\'s ship in search of the Golden Fleece.' },
  { id: 'alnilam', name: 'Alnilam', constellation: 'Orion', ra: 84.05, dec: -1.20, magnitude: 1.69, distance_ly: 2000, spectral: 'B0Ia', color: 'blue', myth: 'String of Pearls. Middle star of Orion\'s Belt. One of the most distant naked-eye stars. Shines with the luminosity of 375,000 suns. Part of the trio that aligned with the pyramids of Giza.' },
  { id: 'alnitak', name: 'Alnitak', constellation: 'Orion', ra: 85.19, dec: -1.94, magnitude: 1.74, distance_ly: 1260, spectral: 'O9.5Ib', color: 'blue', myth: 'The Girdle. Easternmost star of Orion\'s Belt. Near the Horsehead Nebula, one of astronomy\'s most iconic images. A triple star system with a blue supergiant primary.' },
  { id: 'alioth', name: 'Alioth', constellation: 'Ursa Major', ra: 193.51, dec: 55.96, magnitude: 1.76, distance_ly: 81, spectral: 'A0pCr', color: 'white', myth: 'Fat Tail. Brightest star in the Big Dipper (Plough). Part of Ursa Major, the Great Bear. The name is Arabic, referring to the tail of the bear.' },
  { id: 'dubhe', name: 'Dubhe', constellation: 'Ursa Major', ra: 165.93, dec: 61.75, magnitude: 1.79, distance_ly: 123, spectral: 'K0IIIa', color: 'orange', myth: 'The Bear. One of the Pointer Stars of the Big Dipper, pointing toward Polaris. Used by navigators for millennia to find north. A binary system with a sun-like companion.' },
  { id: 'mirfak', name: 'Mirfak', constellation: 'Perseus', ra: 51.08, dec: 49.86, magnitude: 1.79, distance_ly: 592, spectral: 'F5Ib', color: 'yellow', myth: 'The Elbow. Brightest star in Perseus, the hero who saved Andromeda. Alpha Persei Cluster surrounds it — visible to naked eye. Ancient sailors used Perseus for winter navigation.' },
  { id: 'wezen', name: 'Wezen', constellation: 'Canis Major', ra: 107.10, dec: -26.39, magnitude: 1.83, distance_ly: 1600, spectral: 'F8Ia', color: 'yellow', myth: 'The Weight. A yellow-white supergiant 50,000x more luminous than the Sun. Will explode as a supernova within ~100,000 years. The name reflects its "heavy" spectral type.' },
  { id: 'kaus-australis', name: 'Kaus Australis', constellation: 'Sagittarius', ra: 276.04, dec: -34.38, magnitude: 1.85, distance_ly: 143, spectral: 'B9.5III', color: 'white', myth: 'Southern Bow. Brightest star of Sagittarius, the Archer. Points toward the galactic center — the supermassive black hole Sagittarius A* lies in this direction.' },
  { id: 'avior', name: 'Avior', constellation: 'Carina', ra: 125.63, dec: -59.51, magnitude: 1.86, distance_ly: 630, spectral: 'K3III', color: 'orange', myth: 'Ship of Heroes. Part of the former Argo Navis constellation. Used for navigation in the southern hemisphere. A binary star system with an orange giant and blue-white companion.' },
  { id: 'alkaid', name: 'Alkaid', constellation: 'Ursa Major', ra: 206.89, dec: 49.31, magnitude: 1.86, distance_ly: 101, spectral: 'B3V', color: 'blue', myth: 'Leader of the Mourning Maidens. Tip of the Big Dipper handle. In Islamic culture, the stars of the Dipper\'s handle were mourning daughters of a slain leader.' },
];

// Constellations with connecting lines (star pairs)
export const CONSTELLATION_LINES = {
  'Orion': [
    ['betelgeuse', 'bellatrix'],
    ['betelgeuse', 'alnilam'],
    ['bellatrix', 'alnilam'],
    ['alnilam', 'alnitak'],
    ['alnilam', 'rigel'],
    ['alnitak', 'rigel'],
  ],
  'Ursa Major': [
    ['alioth', 'dubhe'],
    ['alioth', 'alkaid'],
  ],
  'Gemini': [
    ['castor', 'pollux'],
  ],
};

// Planets data
export const PLANETS = [
  { id: 'venus', name: 'Venus', symbol: '♀', color: '#fffde7', size: 4, description: 'Evening/Morning Star. Our twin planet, shrouded in thick clouds.' },
  { id: 'mars', name: 'Mars', symbol: '♂', color: '#ff6b6b', size: 3, description: 'The Red Planet. Humans may walk here within your lifetime.' },
  { id: 'jupiter', name: 'Jupiter', symbol: '♃', color: '#ffcc80', size: 5, description: 'King of Planets. The Great Red Spot storm has raged for 350+ years.' },
  { id: 'saturn', name: 'Saturn', symbol: '♄', color: '#fff9c4', size: 4, description: 'Lord of the Rings. Winds reach 1,800 km/h on Saturn.' },
  { id: 'mercury', name: 'Mercury', symbol: '☿', color: '#b0bec5', size: 2, description: 'The Swift Planet. A year on Mercury is just 88 Earth days.' },
];

// Get star color hex
export function getStarColorHex(color) {
  const colors = {
    blue: '#93c5fd',
    white: '#f0f9ff',
    yellow: '#fef08a',
    orange: '#fb923c',
    red: '#f87171',
  };
  return colors[color] || '#f0f9ff';
}

// Calculate star screen position from RA/Dec + viewer azimuth/altitude
export function celestialToScreen(ra, dec, azimuth, altitude, fov, width, height) {
  // Convert RA to azimuth (simplified, ignoring LST for demo)
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const azRad = (azimuth * Math.PI) / 180;
  const altRad = (altitude * Math.PI) / 180;

  // Project onto screen
  const dAz = raRad - azRad;
  const dAlt = decRad - altRad;

  const fovRad = (fov * Math.PI) / 180;
  const x = width / 2 + (dAz / fovRad) * width;
  const y = height / 2 - (dAlt / fovRad) * height;

  return { x, y };
}

// Magnitude to visual size
export function magnitudeToSize(mag) {
  // Brighter = smaller magnitude number = larger dot
  return Math.max(1.5, Math.min(10, 6 - mag * 1.2));
}

// Magnitude to opacity
export function magnitudeToOpacity(mag) {
  return Math.max(0.3, Math.min(1, 1 - mag * 0.12));
}