/* Rótulos neutros: adjetivos do aplicativo para macOS, natureza e especiarias. */
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
    'halcyon', 'transient', 'fleeting', 'enduring', 'perennial', 'timeless',
    // Vocabulário simples de luz, paisagens, cores e qualidades suaves.
    'sunny', 'moonlit', 'starlit', 'snowy', 'misty', 'breezy',
    'leafy', 'floral', 'coastal', 'oceanic', 'sandy', 'pastel',
    'smooth', 'golden', 'silver', 'beige', 'cozy', 'peaceful', 'curious'
  ]);
  const nouns = Object.freeze([
    // Paisagens e lugares naturais.
    'mountain', 'valley', 'hill', 'peak', 'ridge', 'cliff',
    'canyon', 'cave', 'field', 'meadow', 'forest', 'woodland',
    'grove', 'garden', 'park', 'island', 'coast', 'shore',
    // Rios, lagos e mar.
    'river', 'stream', 'brook', 'creek', 'lake', 'pond',
    'spring', 'waterfall', 'lagoon', 'laguna', 'ocean', 'sea',
    'bay', 'gulf', 'inlet', 'cove', 'beach', 'reef',
    // Elementos marítimos.
    'wave', 'tide', 'surf', 'current', 'foam', 'ripple',
    'coral', 'shell', 'pearl', 'sand', 'dune', 'harbor',
    'port', 'dock', 'pier', 'sail', 'boat', 'anchor',
    // Vida marinha.
    'whale', 'dolphin', 'seal', 'otter', 'turtle', 'crab',
    'lobster', 'shrimp', 'oyster', 'clam', 'mussel', 'squid',
    'octopus', 'starfish', 'seahorse', 'shark', 'ray', 'salmon',
    // Plantas e suas formas.
    'tree', 'leaf', 'flower', 'petal', 'bud', 'seed',
    'root', 'branch', 'bark', 'grass', 'moss', 'fern',
    'reed', 'vine', 'bamboo', 'ivy', 'palm', 'pine',
    // Árvores e flores.
    'oak', 'maple', 'willow', 'cedar', 'birch', 'elm',
    'ash', 'beech', 'poplar', 'aspen', 'spruce', 'fir',
    'rose', 'lily', 'lotus', 'daisy', 'tulip', 'orchid',
    // Céu e clima.
    'sun', 'moon', 'star', 'cloud', 'rain', 'snow',
    'frost', 'mist', 'fog', 'breeze', 'wind', 'storm',
    'thunder', 'rainbow', 'dew', 'sunrise', 'sunset', 'sky',
    // Pedras e algumas referências celestes familiares.
    'rock', 'stone', 'pebble', 'crystal', 'quartz', 'opal',
    'amber', 'jade', 'ruby', 'onyx', 'granite', 'marble',
    'vega', 'sirius', 'orion', 'lyra', 'aurora', 'eclipse',
    // Árvores e frutíferas conhecidas.
    'apple', 'cherry', 'peach', 'lemon', 'orange', 'olive',
    'coconut', 'eucalyptus', 'sequoia', 'redwood', 'acacia', 'jacaranda',
    // Flores familiares.
    'sunflower', 'lavender', 'jasmine', 'violet', 'iris', 'poppy',
    'peony', 'azalea', 'camellia', 'dahlia', 'hibiscus', 'magnolia',
    // Ervas e outras plantas do cotidiano.
    'mint', 'basil', 'rosemary', 'sage', 'thyme', 'oregano',
    'parsley', 'aloe', 'cactus', 'clover', 'agave', 'coffee',
    // Mais árvores, frutos e flores familiares.
    'mango', 'guava', 'fig', 'pear', 'walnut', 'almond',
    'gardenia', 'petunia', 'geranium', 'marigold', 'verbena', 'zinnia',
    // Plantas, cultivos e referências do litoral.
    'ginger', 'vanilla', 'sesame', 'cotton', 'cocoa', 'fennel',
    'marina', 'lighthouse', 'kelp', 'sponge', 'pelican', 'penguin',
    // Especiarias; cinnamon e saffron já estão na lista de adjetivos.
    'paprika', 'pepper', 'cumin', 'clove', 'nutmeg', 'turmeric',
    'cardamom', 'coriander', 'anise', 'allspice', 'mustard', 'curry',
    // Seleção natural revisada; nomes fantásticos e animais usados como insulto ficam fora.
    'mangrove', 'dandelion', 'allium', 'cornflower', 'wildflower', 'lilac',
    'seagrass', 'sugarcane', 'pumpkin', 'melon', 'berry', 'shrub', 'mushroom',
    'sandstone', 'gravel', 'diamond', 'amethyst', 'calcite', 'jungle',
    'savanna', 'plateau', 'geyser', 'fox', 'panda', 'parrot',
    'rabbit', 'bee', 'axolotl', 'armadillo', 'nautilus'
  ]);
  // Apenas para restaurar sessões anteriores sem trocar seus identificadores.
  // A geração usa somente o catálogo ativo acima.
  const legacyNouns = Object.freeze([
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
  const nounSet = new Set([...nouns, ...legacyNouns]);
  const idCapacity = alphabet.length ** 3;
  // Exclusões editoriais de pares inteiros, sem bloquear fragmentos de palavras.
  // Aplicam-se somente à geração; rótulos já emitidos continuam válidos.
  const excludedPairs = new Set([
    'crystalline-crystal', 'opaline-opal', 'tidal-tide', 'ashen-ash',
    'sunny-sun', 'moonlit-moon', 'starlit-star', 'snowy-snow',
    'misty-mist', 'breezy-breeze', 'leafy-leaf', 'floral-flower',
    'coastal-coast', 'oceanic-ocean', 'sandy-sand', 'sandy-sandstone',
    // Referência à aparência/idade de pessoas ou duplo sentido sexual.
    'silver-fox', 'golden-rain'
  ]);

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

  function canGenerate(name) {
    const [adjective, noun] = name.split('-');
    return adjective !== noun && !excludedPairs.has(name);
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
      const candidate = `${adjectives[randomIndex(adjectives.length)]}-${nouns[randomIndex(nouns.length)]}`;
      if (canGenerate(candidate) && !names.has(candidate)) { name = candidate; break; }
    }
    // Busca limitada também funciona quando a fonte aleatória repete o mesmo valor.
    if (!name) {
      for (let index = 0; index < adjectives.length * nouns.length; index++) {
        const candidate = pairAt(index);
        if (canGenerate(candidate) && !names.has(candidate)) { name = candidate; break; }
      }
    }
    if (!name) throw new RangeError('Todos os nomes de sessão disponíveis estão em uso.');

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
