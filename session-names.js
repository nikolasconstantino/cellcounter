/* Mesmos catálogos de rótulos neutros usados pelo aplicativo para macOS. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CellSessionNames = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const adjectives = Object.freeze([
    'azure', 'cobalt', 'indigo', 'cerulean', 'sapphire', 'teal',
    'cyan', 'slate', 'steel', 'pewter', 'glacier', 'frost',
    'arctic', 'polar', 'tidal', 'marine', 'aqua', 'mist',
    'amber', 'ochre', 'sienna', 'umber', 'saffron', 'topaz',
    'copper', 'bronze', 'brass', 'ember', 'rust', 'cinnamon',
    'honey', 'wheat', 'sand', 'dune', 'clay', 'terra',
    'ivory', 'pearl', 'linen', 'ashen', 'smoke', 'shadow',
    'onyx', 'ebony', 'raven', 'sable', 'dusk', 'twilight',
    'midnight', 'obsidian', 'graphite', 'carbon', 'basalt', 'flint',
    'crimson', 'scarlet', 'garnet', 'ruby', 'magenta', 'violet',
    'lavender', 'lilac', 'plum', 'mauve', 'rose', 'coral',
    'jade', 'emerald', 'verdant', 'olive', 'fern', 'moss',
    'lucent', 'lambent', 'radiant', 'luminous', 'gleaming', 'shimmer',
    'prismatic', 'iridescent', 'opaline', 'crystalline', 'limpid', 'clear',
    'bright', 'vivid', 'lucid', 'stark', 'pale', 'muted',
    'burnished', 'polished', 'glassy', 'matte', 'velvet', 'satin',
    'marble', 'quartz', 'granite', 'mineral', 'metallic', 'argent',
    'gilded', 'tarnished', 'weathered', 'hewn', 'facet', 'veined',
    'tranquil', 'serene', 'placid', 'still', 'quiet', 'calm',
    'gentle', 'soft', 'tender', 'mellow', 'supple', 'fluid',
    'steady', 'poised', 'balanced', 'measured', 'precise', 'exact',
    'keen', 'acute', 'deft', 'agile', 'nimble', 'fleet',
    'swift', 'brisk', 'vital', 'robust', 'hardy', 'stalwart',
    'noble', 'regal', 'stately', 'lofty', 'grand', 'prime',
    'candid', 'earnest', 'ardent', 'fervent', 'intent', 'rapt',
    'sage', 'astute', 'lucky', 'blithe', 'buoyant', 'spry',
    'dawn', 'aurora', 'vesper', 'eventide', 'nocturne', 'solstice',
    'equinox', 'zephyr', 'boreal', 'austral', 'vernal', 'estival',
    'halcyon', 'transient', 'fleeting', 'enduring', 'perennial', 'timeless'
  ]);
  const nouns = Object.freeze([
    'europa', 'ganymede', 'callisto', 'io', 'titan', 'rhea',
    'iapetus', 'tethys', 'dione', 'mimas', 'enceladus', 'phoebe',
    'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton',
    'nereid', 'charon', 'deimos', 'phobos', 'amalthea', 'elara',
    'mercury', 'neptune', 'saturn', 'jupiter', 'ceres', 'pluto',
    'vesta', 'pallas', 'juno', 'hygiea', 'eris', 'makemake',
    'haumea', 'sedna', 'orcus', 'quaoar', 'ixion', 'varuna',
    'vega', 'rigel', 'altair', 'deneb', 'antares', 'spica',
    'arcturus', 'capella', 'procyon', 'sirius', 'pollux', 'castor',
    'regulus', 'aldebaran', 'betelgeuse', 'polaris', 'mizar', 'alcor',
    'fomalhaut', 'achernar', 'canopus', 'bellatrix', 'alnilam', 'alnitak',
    'saiph', 'mintaka', 'hadar', 'atria', 'avior', 'miaplacidus',
    'alphard', 'denebola', 'algol', 'almach', 'hamal', 'menkar',
    'alpheratz', 'mirach', 'schedar', 'caph', 'rasalhague', 'sabik',
    'shaula', 'sargas', 'dschubba', 'acrux', 'gacrux', 'mimosa',
    'lyra', 'cygnus', 'aquila', 'draco', 'orion', 'perseus',
    'cassiopeia', 'andromeda', 'pegasus', 'phoenix', 'lynx', 'corvus',
    'crater', 'carina', 'vela', 'puppis', 'pyxis', 'norma',
    'ara', 'lupus', 'grus', 'tucana', 'pavo', 'indus',
    'volans', 'dorado', 'mensa', 'octans', 'apus', 'musca',
    'crux', 'centaurus', 'hydra', 'sextans', 'fornax', 'caelum',
    'pictor', 'reticulum', 'horologium', 'sculptor', 'antlia', 'circinus',
    'aurora', 'corona', 'nebula', 'halo', 'zenith', 'nadir',
    'azimuth', 'meridian', 'apogee', 'perigee', 'syzygy', 'eclipse',
    'transit', 'occult', 'parallax', 'albedo', 'penumbra', 'umbra',
    'facula', 'limb', 'terminator', 'ecliptic', 'solstice', 'equinox',
    'quartz', 'agate', 'onyx', 'opal', 'jasper', 'beryl',
    'garnet', 'topaz', 'zircon', 'spinel', 'peridot', 'olivine',
    'feldspar', 'mica', 'calcite', 'fluorite', 'azurite', 'malachite',
    'lazurite', 'obsidian', 'basalt', 'granite', 'marble', 'flint',
    'pyrite', 'galena', 'hematite', 'cinnabar', 'rutile', 'apatite',
    'kyanite', 'tourmaline', 'amethyst', 'citrine', 'moonstone', 'lodestone',
    'prism', 'lens', 'facet', 'loupe', 'vernier', 'gnomon',
    'sextant', 'astrolabe', 'armilla', 'compass', 'alidade', 'octant'
  ]);

  const alphabet = '23456789BCDFGHJKMNPQRSTVWXYZ';
  const idPattern = new RegExp(`^[${alphabet}]{3}$`);
  const adjectiveSet = new Set(adjectives);
  const nounSet = new Set(nouns);
  const idCapacity = alphabet.length ** 3;

  function valid(label) {
    if (!label || typeof label !== 'object' || Array.isArray(label) ||
        typeof label.name !== 'string' || typeof label.shortID !== 'string' ||
        !idPattern.test(label.shortID)) return false;
    const pair = label.name.split('-');
    return pair.length === 2 && adjectiveSet.has(pair[0]) && nounSet.has(pair[1]);
  }

  function randomIndex(length) {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      try {
        const value = new Uint32Array(1);
        crypto.getRandomValues(value);
        return value[0] % length;
      } catch (_) { /* O rótulo também funciona em navegadores sem esse recurso. */ }
    }
    return Math.floor(Math.random() * length);
  }

  function pairAt(index) {
    return `${adjectives[Math.floor(index / nouns.length)]}-${nouns[index % nouns.length]}`;
  }

  function idAt(index) {
    let id = '';
    for (let position = 0; position < 3; position++) {
      id = alphabet[index % alphabet.length] + id;
      index = Math.floor(index / alphabet.length);
    }
    return id;
  }

  function generate(existing = []) {
    const labels = Array.isArray(existing) ? existing.filter(valid) : [];
    const names = new Set(labels.map(label => label.name));
    const ids = new Set(labels.map(label => label.shortID));
    if (ids.size >= idCapacity) throw new RangeError('Todos os identificadores de sessão estão em uso.');

    let name;
    for (let attempt = 0; attempt <= 12; attempt++) {
      name = `${adjectives[randomIndex(adjectives.length)]}-${nouns[randomIndex(nouns.length)]}`;
      if (!names.has(name)) break;
    }
    // Busca limitada também funciona quando a fonte aleatória repete o mesmo valor.
    if (names.has(name)) {
      for (let index = 0; index < adjectives.length * nouns.length; index++) {
        const candidate = pairAt(index);
        if (!names.has(candidate)) { name = candidate; break; }
      }
    }

    let shortID;
    for (let attempt = 0; attempt <= 12; attempt++) {
      shortID = Array.from({ length: 3 }, () => alphabet[randomIndex(alphabet.length)]).join('');
      if (!ids.has(shortID)) break;
    }
    if (ids.has(shortID)) {
      for (let index = 0; index < idCapacity; index++) {
        const candidate = idAt(index);
        if (!ids.has(candidate)) { shortID = candidate; break; }
      }
    }
    return Object.freeze({ name, shortID });
  }

  return Object.freeze({ generate, valid });
});
