let currentOrientation = 'white';

// Chess.com piece images for captured pieces display
const PIECE_THEME = 'neo';
const PIECE_BASE_URL = `https://images.chesscomfiles.com/chess-themes/pieces/${PIECE_THEME}/150`;
const CAPTURED_PIECE_IMAGES = {
  'wp': 'wp.png', 'wn': 'wn.png', 'wb': 'wb.png', 'wr': 'wr.png', 'wq': 'wq.png', 'wk': 'wk.png',
  'bp': 'bp.png', 'bn': 'bn.png', 'bb': 'bb.png', 'br': 'br.png', 'bq': 'bq.png', 'bk': 'bk.png'
};

// Chess.com numeric country codes to ISO 2-letter codes
const COUNTRY_CODE_MAP = {
  '1': 'af', // Afghanistan
  '2': 'us', // United States
  '3': 'al', // Albania
  '4': 'dz', // Algeria
  '5': 'ad', // Andorra
  '6': 'ao', // Angola
  '7': 'ar', // Argentina
  '8': 'am', // Armenia
  '9': 'aw', // Aruba
  '10': 'at', // Austria
  '11': 'au', // Australia
  '12': 'az', // Azerbaijan
  '13': 'bs', // Bahamas
  '14': 'bh', // Bahrain
  '15': 'bd', // Bangladesh
  '16': 'by', // Belarus
  '17': 'be', // Belgium
  '18': 'bz', // Belize
  '19': 'bo', // Bolivia
  '20': 'ba', // Bosnia
  '21': 'bw', // Botswana
  '22': 'br', // Brazil
  '23': 'bn', // Brunei
  '24': 'bg', // Bulgaria
  '25': 'kh', // Cambodia
  '26': 'cm', // Cameroon
  '27': 'ca', // Canada
  '28': 'cl', // Chile
  '29': 'cn', // China
  '30': 'co', // Colombia
  '31': 'cr', // Costa Rica
  '32': 'hr', // Croatia
  '33': 'cu', // Cuba
  '34': 'cy', // Cyprus
  '35': 'cz', // Czech Republic
  '36': 'dk', // Denmark
  '37': 'do', // Dominican Republic
  '38': 'ec', // Ecuador
  '39': 'eg', // Egypt
  '40': 'sv', // El Salvador
  '41': 'ee', // Estonia
  '42': 'et', // Ethiopia
  '43': 'fo', // Faroe Islands
  '44': 'fi', // Finland
  '45': 'fr', // France
  '46': 'ge', // Georgia
  '47': 'de', // Germany
  '48': 'gh', // Ghana
  '49': 'gr', // Greece
  '50': 'gt', // Guatemala
  '51': 'hn', // Honduras
  '52': 'hk', // Hong Kong
  '53': 'hu', // Hungary
  '54': 'is', // Iceland
  '55': 'in', // India
  '56': 'id', // Indonesia
  '57': 'ir', // Iran
  '58': 'iq', // Iraq
  '59': 'ie', // Ireland
  '60': 'il', // Israel
  '61': 'it', // Italy
  '62': 'ci', // Ivory Coast
  '63': 'jm', // Jamaica
  '64': 'jp', // Japan
  '65': 'jo', // Jordan
  '66': 'kz', // Kazakhstan
  '67': 'ke', // Kenya
  '68': 'kw', // Kuwait
  '69': 'in', // India (confirmed)
  '70': 'lv', // Latvia
  '71': 'lb', // Lebanon
  '72': 'ly', // Libya
  '73': 'lt', // Lithuania
  '74': 'lu', // Luxembourg
  '75': 'mo', // Macau
  '76': 'mk', // North Macedonia
  '77': 'mg', // Madagascar
  '78': 'mw', // Malawi
  '79': 'my', // Malaysia
  '80': 'mt', // Malta
  '81': 'mu', // Mauritius
  '82': 'mx', // Mexico
  '83': 'md', // Moldova
  '84': 'mc', // Monaco
  '85': 'mn', // Mongolia
  '86': 'me', // Montenegro
  '87': 'ma', // Morocco
  '88': 'mz', // Mozambique
  '89': 'mm', // Myanmar
  '90': 'na', // Namibia
  '91': 'np', // Nepal
  '92': 'nl', // Netherlands
  '93': 'nz', // New Zealand
  '94': 'ni', // Nicaragua
  '95': 'ng', // Nigeria
  '96': 'kp', // North Korea
  '97': 'no', // Norway
  '98': 'om', // Oman
  '99': 'pk', // Pakistan
  '100': 'ps', // Palestine
  '101': 'pa', // Panama
  '102': 'py', // Paraguay
  '103': 'pe', // Peru
  '104': 'ph', // Philippines
  '105': 'pl', // Poland
  '106': 'pt', // Portugal
  '107': 'pr', // Puerto Rico
  '108': 'qa', // Qatar
  '109': 'ro', // Romania
  '110': 'ru', // Russia
  '111': 'rw', // Rwanda
  '112': 'sa', // Saudi Arabia
  '113': 'sn', // Senegal
  '114': 'rs', // Serbia
  '115': 'sg', // Singapore
  '116': 'sk', // Slovakia
  '117': 'si', // Slovenia
  '118': 'so', // Somalia
  '119': 'za', // South Africa
  '120': 'kr', // South Korea
  '121': 'es', // Spain
  '122': 'lk', // Sri Lanka
  '123': 'sd', // Sudan
  '124': 'sr', // Suriname
  '125': 'se', // Sweden
  '126': 'ch', // Switzerland
  '127': 'sy', // Syria
  '128': 'tw', // Taiwan
  '129': 'tj', // Tajikistan
  '130': 'tz', // Tanzania
  '131': 'th', // Thailand
  '132': 'tt', // Trinidad and Tobago
  '133': 'tn', // Tunisia
  '134': 'tr', // Turkey
  '135': 'tm', // Turkmenistan
  '136': 'ug', // Uganda
  '137': 'ua', // Ukraine
  '138': 'ae', // UAE
  '139': 'gb', // United Kingdom
  '140': 'uy', // Uruguay
  '141': 'uz', // Uzbekistan
  '142': 've', // Venezuela
  '143': 'vn', // Vietnam
  '144': 'ye', // Yemen
  '145': 'zm', // Zambia
  '146': 'zw', // Zimbabwe
  '147': 'xk', // Kosovo
  '148': 'sc', // Seychelles
  '149': 'ag', // Antigua and Barbuda
  '150': 'bb', // Barbados
  '151': 'bj', // Benin
  '152': 'bt', // Bhutan
  '153': 'bf', // Burkina Faso
  '154': 'bi', // Burundi
  '155': 'cv', // Cape Verde
  '156': 'cf', // Central African Republic
  '157': 'td', // Chad
  '158': 'km', // Comoros
  '159': 'cg', // Congo
  '160': 'cd', // DR Congo
  '161': 'dj', // Djibouti
  '162': 'dm', // Dominica
  '163': 'gq', // Equatorial Guinea
  '164': 'er', // Eritrea
  '165': 'sz', // Eswatini
  '166': 'fj', // Fiji
  '167': 'ga', // Gabon
  '168': 'gm', // Gambia
  '169': 'gd', // Grenada
  '170': 'gn', // Guinea
  '171': 'gw', // Guinea-Bissau
  '172': 'gy', // Guyana
  '173': 'ht', // Haiti
  '174': 'ki', // Kiribati
  '175': 'la', // Laos
  '176': 'ls', // Lesotho
  '177': 'lr', // Liberia
  '178': 'li', // Liechtenstein
  '179': 'mv', // Maldives
  '180': 'ml', // Mali
  '181': 'mh', // Marshall Islands
  '182': 'mr', // Mauritania
  '183': 'fm', // Micronesia
  '184': 'nr', // Nauru
  '185': 'ne', // Niger
  '186': 'pw', // Palau
  '187': 'pg', // Papua New Guinea
  '188': 'ws', // Samoa
  '189': 'sm', // San Marino
  '190': 'st', // Sao Tome and Principe
  '191': 'sl', // Sierra Leone
  '192': 'sb', // Solomon Islands
  '193': 'ss', // South Sudan
  '194': 'kn', // Saint Kitts and Nevis
  '195': 'lc', // Saint Lucia
  '196': 'vc', // Saint Vincent
  '197': 'tg', // Togo
  '198': 'to', // Tonga
  '199': 'tv', // Tuvalu
  '200': 'vu', // Vanuatu
};

function connectWebSocket() {
  const ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    console.log('Players overlay connected');
  };

  ws.onmessage = (event) => {
    try {
      const gameState = JSON.parse(event.data);
      updatePlayers(gameState);
    } catch (e) {
      console.error('Failed to parse game state:', e);
    }
  };

  ws.onclose = () => {
    console.log('Disconnected, reconnecting in 2s...');
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

function updatePlayers(state) {
  currentOrientation = state.orientation || 'white';

  const topColor = currentOrientation === 'white' ? 'black' : 'white';
  const bottomColor = currentOrientation === 'white' ? 'white' : 'black';

  const topPlayer = state.players?.[topColor] || {};
  const bottomPlayer = state.players?.[bottomColor] || {};

  updatePlayerInfo('top', topPlayer, state.clocks?.[topColor], state.turn === topColor);
  updatePlayerInfo('bottom', bottomPlayer, state.clocks?.[bottomColor], state.turn === bottomColor);

  updateCapturedPieces('top', state.capturedPieces?.[topColor]);
  updateCapturedPieces('bottom', state.capturedPieces?.[bottomColor]);
}

function updatePlayerInfo(position, player, clockSeconds, isActive) {
  const avatarEl = document.getElementById(`${position}-avatar`);
  const flagEl = document.getElementById(`${position}-flag`);
  const titleEl = document.getElementById(`${position}-title`);
  const nameEl = document.getElementById(`${position}-name`);
  const ratingEl = document.getElementById(`${position}-rating`);
  const clockEl = document.getElementById(`${position}-clock`);

  // Avatar
  if (player.avatar) {
    avatarEl.src = player.avatar;
    avatarEl.style.display = 'block';
  } else {
    avatarEl.style.display = 'none';
  }

  // Flag
  if (player.countryCode) {
    let isoCode = player.countryCode;

    // If it's a numeric code, convert to ISO using our mapping
    if (/^\d+$/.test(player.countryCode)) {
      isoCode = COUNTRY_CODE_MAP[player.countryCode];
    }

    if (isoCode && /^[a-z]{2}$/.test(isoCode)) {
      flagEl.src = `https://flagcdn.com/w40/${isoCode}.png`;
      flagEl.style.display = 'block';
      flagEl.onerror = () => { flagEl.style.display = 'none'; };
    } else {
      flagEl.style.display = 'none';
    }
  } else {
    flagEl.style.display = 'none';
  }

  titleEl.textContent = player.title || '';
  nameEl.textContent = player.name || 'Unknown';
  ratingEl.textContent = player.rating ? `(${player.rating})` : '';

  if (clockSeconds !== undefined && clockSeconds !== null) {
    clockEl.textContent = formatTime(clockSeconds);
    clockEl.classList.toggle('active', isActive);
    clockEl.classList.toggle('low-time', clockSeconds < 30);
  } else {
    clockEl.textContent = '--:--';
    clockEl.classList.remove('active', 'low-time');
  }
}

function updateCapturedPieces(position, capturedData) {
  const container = document.getElementById(`${position}-captured`);
  if (!container) return;

  if (!capturedData || capturedData.pieces.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  for (const piece of capturedData.pieces) {
    const imgFile = CAPTURED_PIECE_IMAGES[piece];
    if (imgFile) {
      html += `<img class="captured-piece-img" src="${PIECE_BASE_URL}/${imgFile}" alt="${piece}">`;
    }
  }

  if (capturedData.score) {
    html += `<span class="captured-score">${capturedData.score}</span>`;
  }

  container.innerHTML = html;
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

connectWebSocket();
