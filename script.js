/* ---------- Data ---------- */
let BUSINESSES = [];
let OBITUARIES = [];
let SAMPLES = [];

/* ---------- Load Data ---------- */
async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    BUSINESSES = data.businesses;
    OBITUARIES = data.obituaries;
    SAMPLES = data.samples;
    console.log('Data loaded:', { businesses: BUSINESSES.length, obituaries: OBITUARIES.length, samples: SAMPLES.length });
    initSamples();
  } catch (error) {
    console.error('Error loading data:', error);
    console.error('Make sure to run this page through a web server, not file://');
    // Show error message to user
    const sampleGrid = document.getElementById('sampleGrid');
    if (sampleGrid) {
      sampleGrid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">Error loading data. Please open via web server.</p>';
    }
  }
}

/* ---------- Utilities ---------- */
function normalize(str) {
  return str.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function tokenize(str) {
  return normalize(str).split(' ').filter(t => t.length > 0);
}

function jaroWinkler(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  if (m === 0 || n === 0) return 0;
  if (s1 === s2) return 1;

  const matchWindow = Math.floor(Math.max(m, n) / 2) - 1;
  const s1Matches = new Array(m).fill(false);
  const s2Matches = new Array(n).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < m; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, n);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < m; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / m + matches / n + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, m, n); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function nameScore(userInput, record) {
  const userNorm = normalize(userInput);
  const userTokens = tokenize(userInput);
  const allNames = [record.full_name, ...record.aliases];

  let bestScore = 0;

  for (const name of allNames) {
    const nameNorm = normalize(name);
    const nameTokens = tokenize(name);

    const jwScore = jaroWinkler(userNorm, nameNorm);

    const commonTokens = userTokens.filter(ut => nameTokens.some(nt => nt.includes(ut) || ut.includes(nt)));
    const overlapScore = commonTokens.length / Math.max(userTokens.length, 1);

    const combinedScore = Math.max(jwScore, overlapScore);
    bestScore = Math.max(bestScore, combinedScore);
  }

  return bestScore;
}

function yearScore(userYear, recordYear) {
  if (!userYear) return 1.0;
  const delta = Math.abs(userYear - recordYear);
  if (delta === 0) return 1.0;
  if (delta === 1) return 0.9;
  if (delta === 2) return 0.8;
  return Math.max(0.5 - Math.min(delta / 50, 0.4), 0.1);
}

function computeMatchScore(userInput, userYear, record) {
  const nScore = nameScore(userInput, record);
  const yScore = yearScore(userYear, record.birth_year);
  return 0.7 * nScore + 0.3 * yScore;
}

function highlightName(name, userInput) {
  const userTokens = tokenize(userInput);
  const words = name.split(/\s+/);

  return words.map(word => {
    const normWord = normalize(word);
    const hasMatch = userTokens.some(ut => normWord.includes(ut) || ut.includes(normWord));
    return hasMatch ? '<span class="highlight">' + word + '</span>' : word;
  }).join(' ');
}

async function performSearch(nameInput, yearInput) {
  if (!nameInput.trim()) return [];

  const userYear = yearInput ? parseInt(yearInput) : null;

  const results = OBITUARIES.map(obit => {
    const score = computeMatchScore(nameInput, userYear, obit);
    return { ...obit, matchScore: score };
  });

  results.sort((a, b) => b.matchScore - a.matchScore);

  return results.slice(0, 5).filter(r => r.matchScore >= 0.95);
}

function renderResults(results, userInput) {
  const container = document.getElementById('resultsContainer');

  if (results.length === 0) {
    container.innerHTML = '<div class="no-results"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><p>No matches found. Try a different name or birth year.</p></div>';
    return;
  }

  const html = results.map(result => {
    const matchPercent = Math.round(result.matchScore * 100);
    const highlightedName = highlightName(result.full_name, userInput);

    const businessCards = result.business_affiliations.map(aff => {
      const business = BUSINESSES.find(b => b.name === aff.name);
      return '<div class="business-card"><div class="business-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg></div><div class="business-info"><div class="business-name">' + aff.name + '</div><div class="business-meta"><span class="business-role">' + aff.role + '</span>' + (business ? '<span>• ' + business.category + '</span>' : '') + '</div></div></div>';
    }).join('');

    return '<div class="result-card"><div class="result-header"><div><div class="result-name">' + highlightedName + '</div>' + (result.aliases.length > 0 ? '<div style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem;">Also known as: ' + result.aliases.join(', ') + '</div>' : '') + '</div><div class="match-score">' + matchPercent + '% Match</div></div><div class="result-meta"><div class="meta-item"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span>' + result.birth_year + ' - ' + result.death_year + '</span></div><div class="meta-item"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span>' + result.last_residence + '</span></div></div><div class="result-occupation">' + result.occupation + '</div><div class="business-section"><h4>Business Affiliations (' + result.business_affiliations.length + ')</h4><div class="business-cards">' + businessCards + '</div></div><button class="copy-btn" onclick="copyResultJSON(' + JSON.stringify(result).replace(/"/g, '&quot;') + ')"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy JSON</button></div>';
  }).join('');

  container.innerHTML = html;
}

function showLoading() {
  const container = document.getElementById('resultsContainer');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching records...</p></div>';
}

async function handleSearch(e) {
  e.preventDefault();

  const nameInput = document.getElementById('nameInput').value;
  const yearInput = document.getElementById('yearInput').value;

  if (!nameInput.trim()) return;

  showLoading();

  await new Promise(resolve => setTimeout(resolve, 350));

  const results = await performSearch(nameInput, yearInput);
  renderResults(results, nameInput);
}

function copyResultJSON(result) {
  const json = JSON.stringify(result, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    console.log('Copied to clipboard');
  });
}

function initTheme() {
  const stored = localStorage.getItem('theme');
  const theme = stored || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  icon.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function initSamples() {
  const grid = document.getElementById('sampleGrid');
  grid.innerHTML = SAMPLES.map(sample => {
    return '<button class="sample-btn" onclick="fillSample(\'' + sample.name + '\', ' + sample.year + ')">' + sample.name + '</button>';
  }).join('');
}

function fillSample(name, year) {
  document.getElementById('nameInput').value = name;
  document.getElementById('yearInput').value = year;
  document.getElementById('nameInput').focus();
}

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('nameInput').value = '';
      document.getElementById('yearInput').value = '';
      document.getElementById('resultsContainer').innerHTML = '<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg><p>Enter a name to search for customer intelligence</p></div>';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadData();
  initKeyboard();

  document.getElementById('searchForm').addEventListener('submit', handleSearch);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  document.getElementById('nameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch(e);
  });
  document.getElementById('yearInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch(e);
  });
});

window.copyResultJSON = copyResultJSON;
window.fillSample = fillSample;
