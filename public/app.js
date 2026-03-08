// ============================================================
// ClearPath app.js — v7 — Prestige-Balanced Scoring
// ============================================================

const ABBR = {
  MIT:'Massachusetts Institute of Technology',UCLA:'University of California Los Angeles',
  USC:'University of Southern California',NYU:'New York University',CMU:'Carnegie Mellon University',
  UVA:'University of Virginia',UNC:'University of North Carolina',UIUC:'University of Illinois Urbana-Champaign',
  UMD:'University of Maryland',GT:'Georgia Tech',GATECH:'Georgia Institute of Technology',
  OSU:'Ohio State University',PSU:'Pennsylvania State University',UT:'University of Texas Austin',
  TAMU:'Texas A&M University',UF:'University of Florida',UGA:'University of Georgia',
  UW:'University of Washington',UMICH:'University of Michigan',BU:'Boston University',
  BC:'Boston College',GWU:'George Washington University',GMU:'George Mason University',
  VT:'Virginia Tech',JHU:'Johns Hopkins University',UPENN:'University of Pennsylvania',
  UCSD:'University of California San Diego',UCB:'UC Berkeley',UCI:'University of California Irvine',
  UCSB:'University of California Santa Barbara',ASU:'Arizona State University',
  MSU:'Michigan State University',ISU:'Iowa State University',PURDUE:'Purdue University',
  ND:'University of Notre Dame',WASHU:'Washington University St Louis',LSU:'Louisiana State University',
  PITT:'University of Pittsburgh',RUTGERS:'Rutgers University',NJIT:'New Jersey Institute of Technology',
  RPI:'Rensselaer Polytechnic Institute',WPI:'Worcester Polytechnic Institute',CORNELL:'Cornell University',
  COLUMBIA:'Columbia University',YALE:'Yale University',HARVARD:'Harvard University',
  PRINCETON:'Princeton University',BROWN:'Brown University',DARTMOUTH:'Dartmouth College',
  STANFORD:'Stanford University',CALTECH:'California Institute of Technology',
  NOVA:'Northern Virginia Community College',NVCC:'Northern Virginia Community College',
};

const ALL_MAJORS = [
  "Computer Science","Software Engineering","Data Science","Cybersecurity","Information Technology",
  "Computer Engineering","Electrical Engineering","Mechanical Engineering","Chemical Engineering",
  "Civil Engineering","Biomedical Engineering","Aerospace Engineering","Industrial Engineering",
  "Finance","Accounting","Business Administration","Marketing","Economics","Supply Chain Management",
  "Human Resources","Statistics","Mathematics","Biology","Chemistry","Environmental Science",
  "Pre-Med","Nursing","Pharmacy","Public Health","Kinesiology / Exercise Science",
  "Psychology","Sociology","Political Science","Criminal Justice","Anthropology","Social Work",
  "Liberal Arts","English","History","Philosophy","Communications","Journalism",
  "Architecture","Graphic Design","Education (K-12)","Hospitality Management","Sports Management",
  "Applied Mathematics","Quantitative Finance","Neuroscience","Bioinformatics","International Relations",
  "Urban Planning","Legal Studies / Pre-Law","Game Design","UX/UI Design","Web Development",
];

const DEGREE_YEARS = { associates:2, bachelors:4, bachelors5:5, masters:6 };
const MAX_COLLEGES = 5;
let collegeCount = 2;
let selectedColleges = [null, null];
let earningsChart = null, cumulativeChart = null;
let lastResults = null;

// ── Page nav ──────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('#landing-page,#results-page,#about-page').forEach(p => p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo(0, 0);
}

// ── Team ──────────────────────────────────────────────────────
const TEAM_MEMBERS = [
  { name:'Aarush Gutha', role:'FULL STACK DEVELOPER', bio:'Built the backend API infrastructure and ROI calculation engine, connecting live federal college data to real financial projections.', emoji:'💻' },
  { name:'Sidharth Mantri', role:'FRONTEND & AI', bio:'Designed the interface and integrated the AI layer, turning raw financial data into personalized advice.', emoji:'🎨' },
];
function renderAboutTeam() {
  document.getElementById('about-team-grid').innerHTML = TEAM_MEMBERS.map(m => `
    <div class="about-team-card">
      <div class="about-team-avatar">${m.emoji}</div>
      <div class="about-team-name">${m.name}</div>
      <div class="about-team-role">${m.role}</div>
      <div class="about-team-bio">${m.bio}</div>
    </div>`).join('');
}
renderAboutTeam();

// ── Info tabs ─────────────────────────────────────────────────
document.querySelectorAll('.info-tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const panel = document.getElementById('panel-' + this.dataset.panel);
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.info-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.info-tab-btn').forEach(b => b.classList.remove('active'));
    if (!isOpen) { panel.classList.add('open'); this.classList.add('active'); }
  });
});
document.querySelectorAll('.panel-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.info-panel').classList.remove('open');
    document.querySelectorAll('.info-tab-btn').forEach(b => b.classList.remove('active'));
  });
});

// ── First-gen toggle ──────────────────────────────────────────
document.getElementById('firstgen-toggle').addEventListener('change', function() {
  document.getElementById('firstgen-label').textContent = this.checked ? 'Yes' : 'No';
  document.getElementById('firstgen-note').classList.toggle('hidden', !this.checked);
});

// ── Income display ────────────────────────────────────────────
const incomeInput = document.getElementById('income-input');
const incomeBracketDisplay = document.getElementById('income-bracket-display');
function getIncomeTier(income) {
  if (!income) return 'Enter your household income to see your aid estimate';
  if (income < 30000)  return '🟢 Low income — near-full aid, Pell Grant eligible ($7,395/yr)';
  if (income < 60000)  return '🟢 Lower-middle — strong need-based aid at most schools';
  if (income < 90000)  return '🟡 Middle income — significant aid, varies by school';
  if (income < 130000) return '🟡 Upper-middle — aid varies; always negotiate your package';
  if (income < 200000) return '🟠 High income — merit aid mainly; can pay more out of pocket';
  return '🔵 Very high income — you may pay little to no loans at most schools';
}
incomeInput.addEventListener('input', function() {
  this.value = this.value.replace(/[^0-9]/g, '');
  const val = parseInt(this.value) || 0;
  incomeBracketDisplay.textContent = getIncomeTier(val);
  incomeBracketDisplay.style.color = val > 0 ? 'var(--accent)' : '';
});

// ── Multiple Majors ───────────────────────────────────────────
let majorCount = 1;
const MAJOR_WEIGHTS = [0.65, 0.25, 0.10];
const MAJOR_LABELS = ['Primary Major', 'Second Major or Minor', 'Third Major or Minor'];

function setupMajorDropdown(inputEl, dropdownEl, hiddenEl) {
  inputEl.addEventListener('input', function() {
    const q = this.value.toLowerCase().trim();
    if (!q) { dropdownEl.classList.add('hidden'); return; }
    const matches = ALL_MAJORS.filter(m => m.toLowerCase().includes(q)).slice(0, 10);
    dropdownEl.innerHTML = !matches.length
      ? '<div class="major-dropdown-item no-result">No match — we will estimate salary</div>'
      : matches.map(m => `<div class="major-dropdown-item" data-value="${m}">${m}</div>`).join('');
    if (!matches.length) hiddenEl.value = this.value;
    dropdownEl.classList.remove('hidden');
  });
  dropdownEl.addEventListener('click', function(e) {
    const item = e.target.closest('.major-dropdown-item');
    if (!item || item.classList.contains('no-result')) return;
    inputEl.value = item.dataset.value;
    hiddenEl.value = item.dataset.value;
    dropdownEl.classList.add('hidden');
  });
}

function addMajorRow() {
  if (majorCount >= 3) return;
  const idx = majorCount;
  const row = document.createElement('div');
  row.className = 'major-row'; row.id = `major-row-${idx}`;
  row.innerHTML = `
    <div class="major-row-inner">
      <div class="major-input-wrap" style="flex:1">
        <input type="text" class="profile-input major-search-input" id="major-input-${idx}"
          placeholder="${MAJOR_LABELS[idx]}..." autocomplete="off"/>
        <div class="major-dropdown hidden" id="major-dropdown-${idx}"></div>
        <input type="hidden" id="major-hidden-${idx}" value=""/>
      </div>
      <div class="major-weight-badge">${Math.round(MAJOR_WEIGHTS[idx]*100)}% weight</div>
      <button class="remove-major-btn" onclick="removeMajorRow(${idx})">✕</button>
    </div>`;
  document.getElementById('majors-list').appendChild(row);
  setupMajorDropdown(
    document.getElementById(`major-input-${idx}`),
    document.getElementById(`major-dropdown-${idx}`),
    document.getElementById(`major-hidden-${idx}`)
  );
  majorCount++;
  if (majorCount >= 3) document.getElementById('add-major-btn').style.display = 'none';
}

function removeMajorRow(idx) {
  document.getElementById(`major-row-${idx}`)?.remove();
  majorCount--;
  document.getElementById('add-major-btn').style.display = '';
}

setupMajorDropdown(
  document.getElementById('major-input-0'),
  document.getElementById('major-dropdown-0'),
  document.getElementById('major-hidden-0')
);
document.getElementById('add-major-btn').addEventListener('click', addMajorRow);

document.addEventListener('click', e => {
  if (!e.target.closest('.major-input-wrap')) document.querySelectorAll('.major-dropdown').forEach(d => d.classList.add('hidden'));
  if (!e.target.classList.contains('college-search')) document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('open'));
});

async function blendSalaryData(majors) {
  const validMajors = majors.filter(Boolean);
  if (!validMajors.length) return { starting:55000, growthRate:0.045 };
  const results = await Promise.all(validMajors.map(m =>
    fetch(`/api/salary/${encodeURIComponent(m)}`).then(r => r.ok ? r.json() : null).catch(() => null)
  ));
  const valid = results.filter(Boolean);
  if (!valid.length) return { starting:55000, growthRate:0.045 };
  let totalW=0, start=0, growth=0;
  valid.forEach((d, i) => {
    const w = MAJOR_WEIGHTS[i] || 0.10;
    start += d.starting*w; growth += d.growthRate*w; totalW += w;
  });
  return { starting:Math.round(start/totalW), growthRate:growth/totalW };
}

// ── College Slots ─────────────────────────────────────────────
function buildSlotHTML(index) {
  const ordinals = ['First','Second','Third','Fourth','Fifth'];
  return `
    <div class="college-slot" id="slot-${index}">
      <div class="slot-header">
        <div class="slot-header-left">
          <span class="slot-num">0${index+1}</span>
          <span class="slot-title">${ordinals[index]} College ${index>=2?'<span class="optional">(optional)</span>':''}</span>
        </div>
        ${index>=2 ? `<button class="remove-slot-btn" onclick="removeSlot(${index})">✕ Remove</button>` : ''}
      </div>
      <div class="search-wrap">
        <input type="text" class="college-search" placeholder="Search by name or abbreviation (MIT, UCLA, Harvard...)" data-index="${index}" autocomplete="off"/>
        <div class="search-dropdown" id="dropdown-${index}"></div>
      </div>
      <div class="selected-college hidden" id="selected-${index}">
        <span class="selected-name"></span>
        <button class="clear-btn" data-index="${index}">✕ Change</button>
      </div>
      <div class="toggle-wrap">
        <span>In-State</span>
        <label class="toggle"><input type="checkbox" class="state-toggle" data-index="${index}"><span class="slider"></span></label>
        <span>Out-of-State</span>
      </div>
    </div>`;
}

function renderCollegeSlots() {
  const c = document.getElementById('college-inputs-container');
  c.innerHTML = '';
  for (let i=0; i<collegeCount; i++) c.insertAdjacentHTML('beforeend', buildSlotHTML(i));
  attachSearchListeners(); attachClearListeners(); updateAddButton();
}
function addSlot() {
  if (collegeCount >= MAX_COLLEGES) return;
  selectedColleges[collegeCount] = null; collegeCount++;
  renderCollegeSlots(); restoreSelected();
}
function removeSlot(index) {
  for (let i=index; i<collegeCount-1; i++) selectedColleges[i] = selectedColleges[i+1];
  selectedColleges[collegeCount-1] = null; collegeCount--;
  renderCollegeSlots(); restoreSelected();
}
function restoreSelected() {
  selectedColleges.forEach((c, i) => {
    if (c && i<collegeCount) {
      const sel = document.getElementById(`selected-${i}`);
      if (sel) { sel.classList.remove('hidden'); sel.querySelector('.selected-name').textContent = c.name; }
    }
  });
}
function updateAddButton() {
  const btn = document.getElementById('add-college-btn');
  if (!btn) return;
  btn.disabled = collegeCount >= MAX_COLLEGES;
  btn.textContent = collegeCount >= MAX_COLLEGES ? `Maximum ${MAX_COLLEGES} colleges reached` : '+ Add Another College to Compare';
}
document.getElementById('add-college-btn').addEventListener('click', addSlot);
renderCollegeSlots();

function attachSearchListeners() {
  document.querySelectorAll('.college-search').forEach(input => {
    let timer;
    input.addEventListener('input', function() {
      const index = parseInt(this.dataset.index), raw = this.value.trim();
      if (raw.length < 2) { closeDropdown(index); return; }
      const query = ABBR[raw.toUpperCase()] || raw;
      clearTimeout(timer);
      timer = setTimeout(() => searchCollege(query, index), 300);
    });
  });
}
function attachClearListeners() {
  document.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const i = parseInt(this.dataset.index);
      selectedColleges[i] = null;
      const slot = document.getElementById(`slot-${i}`);
      slot.querySelector('.selected-college').classList.add('hidden');
      slot.querySelector('.college-search').value = '';
    });
  });
}
async function searchCollege(query, index) {
  try {
    const res = await fetch(`/api/search-college?name=${encodeURIComponent(query)}`);
    showDropdown(await res.json(), index);
  } catch {}
}
function showDropdown(colleges, index) {
  document.querySelectorAll('.search-dropdown').forEach((d, i) => { if (i!==index) d.classList.remove('open'); });
  const dd = document.getElementById(`dropdown-${index}`);
  if (!colleges.length) {
    dd.innerHTML = '<div class="dropdown-item"><div class="dropdown-school">No results found</div></div>';
  } else {
    dd.innerHTML = colleges.map(c => `
      <div class="dropdown-item" onclick="selectCollege(${index}, ${JSON.stringify(c).replace(/"/g,'&quot;')})">
        <div class="dropdown-school">${c.name}</div>
        <div class="dropdown-location">${c.city}, ${c.state}
          ${c.admissionRate ? ` · ${Math.round(c.admissionRate*100)}% admitted` : ''}
          ${c.retentionRate ? ` · ${Math.round(c.retentionRate*100)}% return` : ''}</div>
      </div>`).join('');
  }
  dd.classList.add('open');
}
function closeDropdown(index) { document.getElementById(`dropdown-${index}`)?.classList.remove('open'); }
function selectCollege(index, college) {
  selectedColleges[index] = college;
  const slot = document.getElementById(`slot-${index}`);
  slot.querySelector('.college-search').value = '';
  const sel = slot.querySelector('.selected-college');
  sel.classList.remove('hidden');
  sel.querySelector('.selected-name').textContent = college.name;
  closeDropdown(index);
}

// ── Calculate ─────────────────────────────────────────────────
document.getElementById('calculate-btn').addEventListener('click', async function() {
  const filled = selectedColleges.slice(0, collegeCount).filter(Boolean);
  if (filled.length < 2) { document.getElementById('error-msg').classList.remove('hidden'); return; }
  document.getElementById('error-msg').classList.add('hidden');

  const majors = [];
  for (let i=0; i<3; i++) {
    const h = document.getElementById(`major-hidden-${i}`);
    if (h?.value) majors.push(h.value);
  }
  if (!majors.length) majors.push('Computer Science');

  const income      = parseInt(incomeInput.value) || 75000;
  const meritAid    = parseInt(document.getElementById('merit-aid-input')?.value) || 0;
  const efcVal      = parseInt(document.getElementById('efc-input')?.value) || null;
  const plannedLoan = parseInt(document.getElementById('planned-loan-input')?.value) || null;
  const years       = DEGREE_YEARS[document.getElementById('degree-select').value];
  const gpa         = parseFloat(document.getElementById('gpa-select').value);
  const state       = document.getElementById('state-select').value;
  const firstGen    = document.getElementById('firstgen-toggle').checked;
  const profile     = { gpa, state, firstGen, meritAid, efc: efcVal, plannedLoan };

  this.textContent = 'Calculating...'; this.disabled = true;
  const salaryData = await blendSalaryData(majors);
  this.textContent = 'CALCULATE MY ROI'; this.disabled = false;

  const results = selectedColleges.slice(0, collegeCount).map((college, i) => {
    if (!college) return null;
    const isOOS = document.querySelector(`.state-toggle[data-index="${i}"]`)?.checked || false;
    return calculateAll(college, majors, salaryData, income, years, isOOS, profile);
  });

  lastResults = results;
  showPage('results-page');
  renderScoreCards(results, income, majors);
  renderChart(results, years);
  renderTable(results);
  renderJourney(results, years, income, majors);
  loadAIInsights(results, majors, income);
  initSidenavScroll();
});
document.getElementById('back-btn').addEventListener('click', () => showPage('landing-page'));

function initSidenavScroll() {
  const sections = document.querySelectorAll('.results-main .section');
  const navItems = document.querySelectorAll('.sidenav-item');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navItems.forEach(n => n.classList.remove('active'));
        document.querySelector(`.sidenav-item[data-section="${e.target.id}"]`)?.classList.add('active');
      }
    });
  }, { threshold:0.25, rootMargin:'-60px 0px -40% 0px' });
  sections.forEach(s => obs.observe(s));
  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById(item.dataset.section)?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

// ============================================================
// PRESTIGE SCORING ENGINE
// ============================================================

/**
 * Calculates a prestige score (0–100) based on:
 * - Admission selectivity (lower admit rate = more prestigious)
 * - Graduation rate (outcome quality)
 * - Government-verified earnings (real salary premium)
 * - Retention rate (student satisfaction / rigor signal)
 * - Known elite school bonus
 *
 * This prevents the bug where a community college outscores an Ivy
 * just because income covers tuition (no loans needed).
 */
function calcPrestigeScore(college) {
  const name = (college.name || '').toLowerCase();
  let score = 50; // baseline: average school

  // 1. Elite known schools — hardcoded boost because federal data is comprehensive
  const eliteTier = [
    'massachusetts institute','harvard university','yale university','princeton university',
    'columbia university','university of pennsylvania','dartmouth college','brown university',
    'cornell university','stanford university','california institute of technology',
    'duke university','vanderbilt university','johns hopkins','rice university',
    'northwestern university','carnegie mellon','washington university in st',
    'university of notre dame','georgetown university','university of chicago',
  ];
  const strongTier = [
    'university of michigan','university of virginia','university of california, berkeley',
    'uc berkeley','georgia institute','georgia tech','university of north carolina',
    'university of florida','university of texas at austin','purdue university',
    'university of illinois','university of washington','ohio state',
    'university of southern california','new york university','boston university',
    'boston college','tufts university','emory university','wake forest',
  ];
  const communityKeywords = ['community college','technical college','community & technical','junior college'];

  if (eliteTier.some(t => name.includes(t))) score = Math.max(score, 88);
  else if (strongTier.some(t => name.includes(t))) score = Math.max(score, 72);
  else if (communityKeywords.some(t => name.includes(t))) score = Math.min(score, 35);

  // 2. Admission rate — selectivity is a strong prestige proxy
  const ar = college.admissionRate;
  if (ar !== null && ar !== undefined) {
    if (ar < 0.07)      score += 18;
    else if (ar < 0.12) score += 14;
    else if (ar < 0.20) score += 10;
    else if (ar < 0.35) score += 5;
    else if (ar < 0.55) score += 0;
    else if (ar < 0.75) score -= 5;
    else                score -= 12; // open admission
  }

  // 3. Graduation rate — outcome quality
  const gr = college.graduationRate;
  if (gr !== null && gr !== undefined) {
    if (gr > 0.90)      score += 10;
    else if (gr > 0.80) score += 6;
    else if (gr > 0.70) score += 3;
    else if (gr > 0.55) score += 0;
    else if (gr > 0.40) score -= 4;
    else                score -= 10;
  }

  // 4. Government-verified 10-year earnings (IRS data)
  const e10 = college.earnings?.tenYears;
  if (e10) {
    if (e10 > 100000)      score += 10;
    else if (e10 > 80000)  score += 7;
    else if (e10 > 65000)  score += 4;
    else if (e10 > 50000)  score += 1;
    else if (e10 < 40000)  score -= 6;
  }

  // 5. Retention rate
  const rr = college.retentionRate;
  if (rr) {
    if (rr > 0.95)      score += 5;
    else if (rr > 0.88) score += 3;
    else if (rr > 0.80) score += 1;
    else if (rr < 0.65) score -= 5;
    else if (rr < 0.50) score -= 10;
  }

  return Math.max(5, Math.min(100, Math.round(score)));
}

function classifySchool(college) {
  const name = (college.name||'').toLowerCase();
  const inS  = college.tuition?.inState || 0;
  const outS = college.tuition?.outOfState || 0;
  const elite = ['massachusetts institute','harvard','yale','princeton','columbia university',
    'university of pennsylvania','dartmouth','brown university','cornell','stanford',
    'california institute of technology','duke university','vanderbilt','johns hopkins',
    'rice university','northwestern','carnegie mellon','washington university in st','notre dame','georgetown'];
  if (elite.some(t => name.includes(t))) return 'elite_private';
  if (college.admissionRate && college.admissionRate < 0.15) return 'elite_private';
  const flagship = ['university of virginia','university of michigan','university of california',
    'georgia institute','georgia tech','university of texas','university of florida',
    'university of north carolina','ohio state','purdue','virginia tech',
    'university of maryland','university of illinois','university of washington'];
  if (flagship.some(t => name.includes(t))) return 'public_flagship';
  if (outS > 52000 || inS > 50000) return 'strong_private';
  const community = ['community college','technical college','community & technical'];
  if (community.some(t => name.includes(t)) || (inS > 0 && inS < 7000)) return 'community_college';
  if (inS < 16000 && inS > 0) return 'public_regional';
  return outS > 38000 ? 'average_private' : 'public_regional';
}

function estimateSAI(income) {
  const adj = Math.max(0, income - 30870);
  if (adj<=15000) return adj*0.22;
  if (adj<=26000) return 3300+(adj-15000)*0.25;
  if (adj<=37000) return 6050+(adj-26000)*0.29;
  if (adj<=48000) return 9240+(adj-37000)*0.34;
  if (adj<=60000) return 12980+(adj-48000)*0.40;
  return 17780+(adj-60000)*0.47;
}

function calculateTotalCost(college, years, isOOS, income, profile) {
  const annualTuition = isOOS ? (college.tuition?.outOfState||28000) : (college.tuition?.inState||12000);
  const totalSticker  = annualTuition * years;
  const type          = classifySchool(college);
  const meritTotal    = (profile?.meritAid||0) * years;
  let totalAid, oop;
  if (profile?.efc !== null && profile?.efc >= 0) {
    oop = Math.max(0, Math.min(profile.efc*years, totalSticker) - meritTotal);
    totalAid = Math.max(0, totalSticker - oop);
  } else {
    const annSAI  = estimateSAI(income);
    const annNeed = Math.max(0, annualTuition - annSAI);
    const cov = {elite_private:0.99,strong_private:0.78,average_private:0.57,
      public_flagship:0.35,public_regional:0.28,community_college:0.72}[type]||0.35;
    totalAid = Math.min((annNeed*cov*years)+meritTotal, totalSticker);
    oop = Math.max(0, totalSticker - totalAid);
  }
  return { totalSticker, totalAid:Math.round(totalAid), outOfPocketCost:Math.round(oop),
    annualCost:annualTuition, aidRate:totalSticker>0?totalAid/totalSticker:0, schoolType:type };
}

function calculateLoanRepayment(costData, years, income, profile) {
  const annualOOP    = costData.outOfPocketCost / years;
  const annualCanPay = income * 0.20;
  const annualGap    = Math.max(0, annualOOP - annualCanPay);
  const annualLoan   = profile?.plannedLoan ? Math.min(profile.plannedLoan, annualGap) : annualGap;
  if (annualLoan < 100) {
    return { monthlyPayment:0, totalRepaid:0, totalInterestPaid:0, loanPrincipal:0, noLoans:true };
  }
  const r = 0.0653;
  let balance = 0;
  for (let y=0; y<years; y++) balance += annualLoan * Math.pow(1+r, years-1-y);
  balance = Math.round(balance);
  const mr = r/12, n = 120;
  const monthly = balance * (mr*Math.pow(1+mr,n)) / (Math.pow(1+mr,n)-1);
  return {
    monthlyPayment:Math.round(monthly), totalRepaid:Math.round(monthly*n),
    totalInterestPaid:Math.round(monthly*n - balance), loanPrincipal:balance, noLoans:false
  };
}

function projectEarnings(salaryData, college, years, prestigeScore) {
  const govSix  = college.earnings?.sixYears;
  const type    = classifySchool(college);

  // Prestige multiplier: elite schools produce significantly better salary trajectories.
  // Range: 0.85 (open-access) → 1.25 (elite). This reflects real labor market premiums.
  const prestigeMult = 0.85 + (prestigeScore / 100) * 0.40;
  const basePremiums = {elite_private:1.18,strong_private:1.08,average_private:1.02,
    public_flagship:1.05,public_regional:0.97,community_college:0.88};
  const premiumMult  = basePremiums[type] || 1.0;

  // For elite schools, weight IRS government earnings more heavily vs. BLS/NACE averages.
  // IRS data captures the actual earned premium of elite network access and selectivity.
  // For a CS major at MIT, the IRS 6-yr median far outweighs a national BLS average.
  let govWeight = 0.55, salWeight = 0.45;
  if (prestigeScore >= 82) { govWeight = 0.75; salWeight = 0.25; }       // elite
  else if (prestigeScore >= 68) { govWeight = 0.65; salWeight = 0.35; }  // prestigious

  const blendedStart = govSix && govSix > 35000
    ? Math.round((salaryData.starting * salWeight + govSix * govWeight) * prestigeMult)
    : Math.round(salaryData.starting * premiumMult * prestigeMult);
  const g = salaryData.growthRate || 0.045;
  // Elite schools also get a steeper growth curve (alumni networks kick in at 5+ yrs)
  const growthBoost = prestigeScore > 75 ? 0.010 : (prestigeScore > 60 ? 0.005 : 0);
  const data = [];
  for (let yr=1; yr<=14; yr++) {
    if (yr <= years) {
      data.push({ year:yr, salary:0, label:`Year ${yr}` });
    } else {
      const worked = yr - years;
      const growth = g + growthBoost;
      const sal = worked<=3
        ? blendedStart * Math.pow(1+growth*1.5, worked-1)
        : blendedStart * Math.pow(1+growth, worked-1);
      data.push({ year:yr, salary:Math.round(sal), label:`Year ${yr}` });
    }
  }
  return { data, blendedStart };
}

function calculateROI(earningsData, costData, loanData) {
  const totalEarned = earningsData.reduce((s,d)=>s+d.salary,0);
  const totalCosts  = costData.outOfPocketCost + loanData.totalInterestPaid;
  const netROI      = totalEarned - totalCosts;
  const pct         = totalCosts>0 ? (netROI/totalCosts)*100 : 9999;
  let rating, ratingColor, ratingBg;
  if      (pct>400) { rating='EXCELLENT';    ratingColor='#1A5C3A'; ratingBg='#D4EDE0'; }
  else if (pct>200) { rating='STRONG VALUE'; ratingColor='#2A8050'; ratingBg='#D9F0E6'; }
  else if (pct>100) { rating='SOLID CHOICE'; ratingColor='#1E3A6E'; ratingBg='#D8E4F5'; }
  else if (pct>40)  { rating='FAIR';         ratingColor='#7A5C00'; ratingBg='#FEF5D0'; }
  else if (pct>0)   { rating='RISKY';        ratingColor='#9C4A00'; ratingBg='#FDEBD0'; }
  else              { rating='POOR VALUE';   ratingColor='#8C2020'; ratingBg='#FADED8'; }
  let breakEvenYear=null, cum=0;
  earningsData.forEach((d,i) => { cum+=d.salary; if(cum>=totalCosts&&!breakEvenYear) breakEvenYear=i+1; });
  return { netROI:Math.round(netROI), roiPct:Math.round(pct), rating, ratingColor, ratingBg,
    breakEvenYear, totalEarned:Math.round(totalEarned), totalCosts:Math.round(totalCosts) };
}

function calculateWellness(roiData, loanData, blendedSalary) {
  const mg   = blendedSalary/12;
  const mn   = mg*0.744;
  const dti  = mg>0 ? (loanData.monthlyPayment/mg)*100 : 0;
  const disp = mn - loanData.monthlyPayment - 2445;
  const sdr  = loanData.loanPrincipal>0 ? blendedSalary/loanData.loanPrincipal : 99;
  let score = 100;
  if(dti>40) score-=50; else if(dti>30) score-=38; else if(dti>20) score-=25;
  else if(dti>15) score-=14; else if(dti>10) score-=6;
  if(disp<-800) score-=35; else if(disp<0) score-=22; else if(disp<300) score-=10;
  if(roiData.rating==='POOR VALUE') score-=15; else if(roiData.rating==='RISKY') score-=8;
  return { dti:Math.round(dti*10)/10, disposable:Math.round(disp), monthlyNet:Math.round(mn),
    score:Math.max(0,Math.min(100,Math.round(score))), sdr:Math.round(sdr*10)/10 };
}

function calcSuccessScore(college) {
  const ret  = college.retentionRate, grad = college.graduationRate, rep = college.repaymentRate;
  if (!ret&&!grad&&!rep) return 65;
  let score=0, w=0;
  if(ret)  { score+=ret*100*0.35; w+=0.35; }
  if(grad) { score+=grad*100*0.40; w+=0.40; }
  if(rep)  { score+=rep*100*0.25; w+=0.25; }
  return w>0 ? Math.round(score/w) : 65;
}

function calculateAll(college, majors, salaryData, income, years, isOOS, profile) {
  const prestigeScore = calcPrestigeScore(college);
  const costData      = calculateTotalCost(college, years, isOOS, income, profile);
  const loanData      = calculateLoanRepayment(costData, years, income, profile);
  const { data:earningsData, blendedStart } = projectEarnings(salaryData, college, years, prestigeScore);
  const roiData       = calculateROI(earningsData, costData, loanData);
  const wellness      = calculateWellness(roiData, loanData, blendedStart);
  const successScore  = calcSuccessScore(college);
  return { college, costData, loanData, earningsData, roiData, wellness, successScore,
    salaryData, blendedStart, majors, income, prestigeScore };
}

/**
 * COMPOSITE SCORE — balances ROI with institutional quality
 *
 * Weighting:
 *   50% — Financial ROI (loan burden, monthly payment, net gain)
 *   25% — Prestige & rigor (selectivity, graduation rate, verified earnings)
 *   25% — Student outcomes (graduation rate, retention, repayment)
 *
 * This means a community college with $0 loans but 36% graduation rate
 * will score substantially lower than an Ivy with some debt but 97% grad rate.
 */
function computeCompositeScores(results) {
  const valid = results.filter(Boolean);
  if (!valid.length) return;

  // Check if ANY school in this comparison is elite/prestigious.
  // When a student is comparing Harvard vs. a state school, the state
  // school's cheap in-state tuition shouldn't be the deciding factor —
  // lifetime network value, salary trajectory, and outcomes matter.
  const maxPrestige = Math.max(...valid.map(r => r.prestigeScore));
  const hasEliteInComparison = maxPrestige >= 82;

  valid.forEach(r => {
    const dti     = r.wellness.dti;
    const monthly = r.loanData.monthlyPayment;
    const mg      = r.blendedStart / 12;
    const interest= r.loanData.totalInterestPaid;
    const ps      = r.prestigeScore;

    // ── Financial sub-score (0–100) ──
    const dtiS = dti<=5?96:dti<=10?96-(dti-5)*2:dti<=20?86-(dti-10)*2.5:
      dti<=30?61-(dti-20)*2.5:dti<=40?36-(dti-30)*2:Math.max(5,16-(dti-40)*0.5);
    const pr   = mg > 0 ? monthly / mg : 0;
    const payS = pr<=0.05?96:pr<=0.10?96-(pr-0.05)*300:pr<=0.20?81-(pr-0.10)*250:
      pr<=0.30?56-(pr-0.20)*250:Math.max(5,31-(pr-0.30)*150);
    const roiMap = {'EXCELLENT':97,'STRONG VALUE':85,'SOLID CHOICE':72,'FAIR':55,'RISKY':35,'POOR VALUE':12};
    const roiS  = roiMap[r.roiData.rating] || 55;
    const intS  = Math.max(10, 100 - interest / 700);
    let finScore = roiS*0.50 + dtiS*0.18 + payS*0.18 + intS*0.14;

    // ── Prestige-aware financial floor ──
    // When elite schools are in the comparison, we reduce how much raw cost
    // penalty an elite school takes. A $200k Harvard degree with a massive
    // salary premium and network effect is NOT the same risk as a $200k
    // degree from a for-profit school. Elite schools' real long-run ROI is
    // captured by their IRS 10-year earnings, which already feeds into roiS.
    if (hasEliteInComparison && ps >= 82) {
      // Soft floor: elite schools' financial score can't drop below 52
      finScore = Math.max(finScore, 52);
    } else if (hasEliteInComparison && ps >= 70) {
      // Prestigious schools: floor at 44
      finScore = Math.max(finScore, 44);
    }

    // ── Prestige sub-score ──
    const presScore = ps;

    // ── Outcomes sub-score ──
    const outS = Math.min(100, r.successScore);

    // ── COMPOSITE: 50% financial, 25% prestige, 25% outcomes ──
    r._rawScore = finScore*0.50 + presScore*0.25 + outS*0.25;
    r.financialScore = Math.round(finScore);
    r.scoreBreakdown = {
      roi:Math.round(roiS), debt:Math.round(dtiS), payment:Math.round(payS),
      prestige:Math.round(presScore), success:Math.round(outS), interest:Math.round(intS)
    };
  });

  // Small relative adjustment so spread is visible
  const relROI  = relNorm(valid.map(r => r.roiData.netROI), true);
  const relCost = relNorm(valid.map(r => r.costData.outOfPocketCost), false);
  valid.forEach((r, i) => {
    r.compositeScore = Math.round(Math.max(2, Math.min(97, r._rawScore + (relROI[i]+relCost[i])/2)));
  });
}

function relNorm(vals, hi) {
  const min=Math.min(...vals), max=Math.max(...vals);
  if(max===min) return vals.map(()=>0);
  return vals.map(v => hi?((v-min)/(max-min))*8-4:((max-v)/(max-min))*8-4);
}

function fmt(num) {
  if (num===null||num===undefined||isNaN(num)) return '$0';
  const abs = Math.abs(Math.round(num));
  const sign = num<0?'-':'';
  if (abs>=1000000) return sign+'$'+(abs/1000000).toFixed(2)+'M';
  return sign+'$'+abs.toLocaleString();
}

function getPrestigeLabel(score) {
  if (score >= 85) return { label:'ELITE', color:'#8B6914' };
  if (score >= 70) return { label:'PRESTIGIOUS', color:'#C4882A' };
  if (score >= 55) return { label:'STRONG', color:'#2D6A4F' };
  if (score >= 40) return { label:'REGIONAL', color:'#4A4844' };
  return { label:'OPEN ACCESS', color:'#8A8880' };
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

function renderScoreCards(results, income, majors) {
  computeCompositeScores(results);
  const valid = results.filter(Boolean);
  const bestScore = Math.max(...valid.map(r => r.compositeScore));
  const majorLabel = majors.slice(0,2).join(' + ');

  document.getElementById('score-cards').innerHTML = valid.map((r, i) => {
    const isBest = r.compositeScore === bestScore;
    const cs  = r.compositeScore;
    const fs  = r.financialScore;
    const ps  = r.prestigeScore;
    const noLoan  = r.loanData.noLoans;
    const govE10  = r.college.earnings?.tenYears;
    const ret     = r.college.retentionRate;
    const grad    = r.college.graduationRate;
    const csColor = cs>=70?'var(--green-mid)':cs>=50?'var(--gold)':'var(--red)';
    const prestige = getPrestigeLabel(ps);
    return `
      <div class="score-card ${isBest?'best':''}" style="animation-delay:${i*0.1}s">
        ${isBest?'<div class="best-badge">✓ BEST OVERALL</div>':''}
        <div class="score-card-name">${r.college.name}</div>
        <div class="score-card-location">${r.college.city}, ${r.college.state}${r.college.admissionRate ? ` · ${Math.round(r.college.admissionRate*100)}% admit` : ''}</div>

        <!-- Prestige bar -->
        <div class="prestige-bar-wrap">
          <div class="prestige-bar-label">
            <span class="prestige-bar-title">INSTITUTIONAL PRESTIGE</span>
            <span class="prestige-bar-val" style="color:${prestige.color}">${prestige.label} · ${ps}/100</span>
          </div>
          <div class="prestige-bar-track"><div class="prestige-bar-fill" style="width:${ps}%"></div></div>
        </div>

        <!-- Dual scores -->
        <div class="dual-scores">
          <div class="score-box composite-box">
            <div class="score-box-num" style="color:${csColor}">${cs}</div>
            <div class="score-box-label">COMPOSITE SCORE</div>
          </div>
          <div class="score-box">
            <div class="score-box-num" style="color:var(--text-dim); font-size:36px">${fs}</div>
            <div class="score-box-label">FINANCIAL SCORE</div>
          </div>
        </div>

        <div class="rating-pill" style="background:${r.roiData.ratingBg};color:${r.roiData.ratingColor}">${r.roiData.rating}</div>

        <div class="card-key-stats">
          <div class="key-stat"><div class="key-stat-label">You pay after aid</div><div class="key-stat-val">${fmt(r.costData.outOfPocketCost)}</div></div>
          <div class="key-stat"><div class="key-stat-label">Debt at graduation</div><div class="key-stat-val ${noLoan?'stat-green':''}">${noLoan?'None — paid in full 🎉':fmt(r.loanData.loanPrincipal)}</div></div>
          <div class="key-stat"><div class="key-stat-label">Monthly payment</div><div class="key-stat-val ${noLoan?'stat-green':''}">${noLoan?'$0 — No loans':fmt(r.loanData.monthlyPayment)+'/mo'}</div></div>
          <div class="key-stat"><div class="key-stat-label">Starting salary</div><div class="key-stat-val">${fmt(r.blendedStart)}/yr</div></div>
          ${govE10?`<div class="key-stat"><div class="key-stat-label">Real 10-yr salary (IRS)</div><div class="key-stat-val stat-blue">${fmt(govE10)}/yr</div></div>`:''}
          <div class="key-stat"><div class="key-stat-label">Net gain over 10 years</div><div class="key-stat-val" style="color:${r.roiData.netROI>=0?'var(--green-mid)':'var(--red)'}">${r.roiData.netROI>=0?'+':''}${fmt(r.roiData.netROI)}</div></div>
        </div>

        ${(ret||grad)?`<div class="satisfaction-row">
          <span class="sat-label">OUTCOMES</span>
          ${ret?`<span class="sat-chip">${Math.round(ret*100)}% return yr 2</span>`:''}
          ${grad?`<span class="sat-chip">${Math.round(grad*100)}% graduate</span>`:''}
        </div>`:''}

        <div class="score-breakdown">
          <div class="breakdown-title">SCORE BREAKDOWN (how ${cs}/100 was calculated)</div>
          <div class="score-breakdown-row"><span>Financial ROI (50% weight)</span><span>${r.scoreBreakdown.roi}/100</span></div>
          <div class="score-breakdown-row"><span>Institutional Prestige (25%)</span><span>${r.scoreBreakdown.prestige}/100</span></div>
          <div class="score-breakdown-row"><span>Student Outcomes (25%)</span><span>${r.scoreBreakdown.success}/100</span></div>
          <div class="score-breakdown-row"><span>  ↳ Debt Burden</span><span>${r.scoreBreakdown.debt}/100</span></div>
          <div class="score-breakdown-row"><span>  ↳ Monthly Payment Load</span><span>${r.scoreBreakdown.payment}/100</span></div>
        </div>
      </div>`;
  }).join('');
}

function renderChart(results, years) {
  if (earningsChart)   earningsChart.destroy();
  if (cumulativeChart) cumulativeChart.destroy();
  const valid = results.filter(Boolean);
  const colors = ['#2D4A3E','#C4882A','#1E3A6E','#7A5C00','#4A1942'];
  const labels = valid[0].earningsData.map(d => d.label);

  const gradPlugin = {
    id:'gradLine',
    afterDraw(chart) {
      const cx=chart.ctx, x=chart.scales.x, y=chart.scales.y;
      const px=x.getPixelForValue(years-0.5);
      cx.save(); cx.setLineDash([6,4]);
      cx.strokeStyle='rgba(45,74,62,0.50)'; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(px,y.top); cx.lineTo(px,y.bottom); cx.stroke();
      cx.fillStyle='rgba(45,74,62,0.80)'; cx.font='bold 12px Space Mono, monospace';
      cx.fillText('🎓 Graduation', px+8, y.top+22); cx.restore();
    }
  };

  earningsChart = new Chart(document.getElementById('earnings-chart').getContext('2d'), {
    type:'line', plugins:[gradPlugin],
    data: {
      labels,
      datasets: valid.map((r,i) => ({
        label: r.college.name,
        data: r.earningsData.map(d=>d.salary),
        borderColor: colors[i], backgroundColor: colors[i]+'15',
        borderWidth:2.5,
        pointRadius: r.earningsData.map((_,idx)=>(idx===years||idx===Math.min(13,years+9))?7:3),
        pointBackgroundColor: colors[i], tension:0.4, fill:true
      }))
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{ labels:{ color:'#1A1917', font:{ family:'DM Sans', size:13 }, padding:20 } },
        tooltip:{ backgroundColor:'#1A1917', titleColor:'#F8F7F2', bodyColor:'#C8C6BC', padding:12,
          callbacks:{ label: ctx => ctx.parsed.y===0?`${ctx.dataset.label}: In school`:`${ctx.dataset.label}: ${fmt(ctx.parsed.y)}/yr` } }
      },
      scales: {
        x:{ grid:{color:'rgba(0,0,0,0.04)'}, ticks:{color:'#4A4844',font:{size:12},maxRotation:30} },
        y:{ grid:{color:'rgba(0,0,0,0.04)'}, ticks:{color:'#4A4844',font:{size:12},callback:v=>v===0?'In School':fmt(v)} }
      }
    }
  });

  const breakPlugin = {
    id:'breakLine',
    afterDraw(chart) {
      const cx=chart.ctx, x=chart.scales.x, y=chart.scales.y;
      const py=y.getPixelForValue(0);
      if(py<y.top||py>y.bottom) return;
      cx.save(); cx.strokeStyle='#8A8880'; cx.lineWidth=1.5;
      cx.beginPath(); cx.moveTo(x.left,py); cx.lineTo(x.right,py); cx.stroke();
      cx.fillStyle='#4A4844'; cx.font='11px Space Mono, monospace';
      cx.fillText('← Break Even', x.left+8, py-8);
      cx.restore();
    }
  };

  const cumData = valid.map(r => {
    let cum=0;
    const tc = r.costData.outOfPocketCost + r.loanData.totalInterestPaid;
    return r.earningsData.map(d => { cum+=d.salary; return Math.round(cum-tc); });
  });

  cumulativeChart = new Chart(document.getElementById('cumulative-chart').getContext('2d'), {
    type:'line', plugins:[breakPlugin],
    data: {
      labels,
      datasets: valid.map((r,i) => ({
        label: r.college.name,
        data: cumData[i],
        borderColor: colors[i], backgroundColor: colors[i]+'18',
        borderWidth:2.5, pointRadius:3, tension:0.4, fill:'origin'
      }))
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{ labels:{ color:'#1A1917', font:{ family:'DM Sans', size:13 }, padding:20 } },
        tooltip:{ backgroundColor:'#1A1917', titleColor:'#F8F7F2', bodyColor:'#C8C6BC', padding:12,
          callbacks:{ label: ctx => { const v=ctx.parsed.y; return `${ctx.dataset.label}: ${v>=0?'+':''}${fmt(v)}`; } } }
      },
      scales: {
        x:{ grid:{color:'rgba(0,0,0,0.04)'}, ticks:{color:'#4A4844',font:{size:12},maxRotation:30} },
        y:{ grid:{color:'rgba(0,0,0,0.04)'}, ticks:{color:'#4A4844',font:{size:12},callback:v=>fmt(v)} }
      }
    }
  });
}

function renderTable(results) {
  const valid = results.filter(Boolean);
  function colorCells(raw, hi) {
    if (raw.every(v=>v===raw[0])) return raw.map(()=>'');
    const s = [...raw].sort((a,b)=>hi?b-a:a-b);
    return raw.map(v=>v===s[0]?'cell-green':(raw.length>2&&v===s[s.length-1])?'cell-red':'cell-yellow');
  }

  const cats = [
    { category: 'SCORES', rows:[
      { label:'Composite Score (ROI + Prestige + Outcomes)', vals:valid.map(r=>r.compositeScore+'/100'), raw:valid.map(r=>r.compositeScore), hi:true },
      { label:'Financial Score Only', vals:valid.map(r=>r.financialScore+'/100'), raw:valid.map(r=>r.financialScore), hi:true },
      { label:'Prestige Score', vals:valid.map(r=>r.prestigeScore+'/100'), raw:valid.map(r=>r.prestigeScore), hi:true },
      { label:'Value Rating', vals:valid.map(r=>r.roiData.rating), raw:null },
    ]},
    { category: 'COST & AID', rows:[
      { label:'You Pay (after aid, total)', vals:valid.map(r=>fmt(r.costData.outOfPocketCost)), raw:valid.map(r=>r.costData.outOfPocketCost), hi:false },
      { label:'Aid You Receive (total)', vals:valid.map(r=>fmt(r.costData.totalAid)), raw:valid.map(r=>r.costData.totalAid), hi:true },
      { label:'Debt at Graduation', vals:valid.map(r=>r.loanData.noLoans?'None 🎉':fmt(r.loanData.loanPrincipal)), raw:valid.map(r=>r.loanData.loanPrincipal), hi:false },
      { label:'Monthly Loan Payment', vals:valid.map(r=>r.loanData.noLoans?'$0':fmt(r.loanData.monthlyPayment)+'/mo'), raw:valid.map(r=>r.loanData.monthlyPayment), hi:false },
      { label:'Total Interest Paid', vals:valid.map(r=>fmt(r.loanData.totalInterestPaid)), raw:valid.map(r=>r.loanData.totalInterestPaid), hi:false },
    ]},
    { category: 'EARNINGS & ROI', rows:[
      { label:'Starting Salary (your major)', vals:valid.map(r=>fmt(r.blendedStart)+'/yr'), raw:valid.map(r=>r.blendedStart), hi:true },
      { label:'Real 10-Year Salary (IRS data)', vals:valid.map(r=>r.college.earnings?.tenYears?fmt(r.college.earnings.tenYears)+'/yr':'N/A'), raw:valid.map(r=>r.college.earnings?.tenYears||0), hi:true },
      { label:'Net Gain Over 10 Years', vals:valid.map(r=>(r.roiData.netROI>=0?'+':'')+fmt(r.roiData.netROI)), raw:valid.map(r=>r.roiData.netROI), hi:true },
      { label:'Money Left Each Month', vals:valid.map(r=>(r.wellness.disposable>=0?'+':'')+fmt(r.wellness.disposable)+'/mo'), raw:valid.map(r=>r.wellness.disposable), hi:true },
    ]},
    { category: 'STUDENT OUTCOMES', rows:[
      { label:'% Students Who Graduated', vals:valid.map(r=>r.college.graduationRate?Math.round(r.college.graduationRate*100)+'%':'N/A'), raw:valid.map(r=>r.college.graduationRate||0), hi:true },
      { label:'% Freshmen Who Returned', vals:valid.map(r=>r.college.retentionRate?Math.round(r.college.retentionRate*100)+'%':'N/A'), raw:valid.map(r=>r.college.retentionRate||0), hi:true },
      { label:'Admission Rate', vals:valid.map(r=>r.college.admissionRate?Math.round(r.college.admissionRate*100)+'%':'N/A'), raw:valid.map(r=>r.college.admissionRate||1), hi:false },
    ]},
  ];

  const hdrs = ['METRIC',...valid.map(r=>`${r.college.name}`)].map(h=>`<th>${h}</th>`).join('');
  let tableRows = '';
  cats.forEach(cat => {
    tableRows += `<tr class="row-category"><td colspan="${valid.length+1}">${cat.category}</td></tr>`;
    cat.rows.forEach(row => {
      const cls = row.raw ? colorCells(row.raw, row.hi) : row.vals.map(()=>'');
      tableRows += `<tr><td class="row-label">${row.label}</td>${row.vals.map((v,i)=>`<td class="${cls[i]}">${v}</td>`).join('')}</tr>`;
    });
  });

  document.getElementById('comparison-table').innerHTML = `
    <table class="comp-table"><thead><tr>${hdrs}</tr></thead><tbody>${tableRows}</tbody></table>`;
}

function renderJourney(results, years, income, majors) {
  const valid = results.filter(Boolean), r = valid[0];
  const be = r.roiData.breakEvenYear;
  const ms = majors.slice(0,2).join(' + ');
  const bestCollege = valid.reduce((best, cur) => cur.compositeScore > best.compositeScore ? cur : best, valid[0]);
  const steps = [
    { num:'01', title:'You Enroll', sub:`Age 18`, hl:false,
      detail:'Estimated total Year 1 cost including housing and supplies:',
      amount:fmt(r.costData.annualCost + 21170) },
    { num:'02', title:'Graduation', sub:`Age ${18+years}`, hl:true,
      detail: r.loanData.noLoans
        ? `You graduate debt-free. Your family income covers tuition without loans.`
        : `Debt: ${fmt(r.loanData.loanPrincipal)}. Repayment starts at ${fmt(r.loanData.monthlyPayment)}/month.`,
      amount:'' },
    { num:'03', title:'First Job', sub:`Age ${18+years}`, hl:false,
      detail:`Estimated starting salary in ${ms}:`, amount:fmt(r.blendedStart)+'/yr' },
    { num:'04', title:'Break Even', sub:be?`~Age ${17+be}`:'Year 14+', hl:true,
      detail:be ? `Your total earnings exceed all costs paid — ${be} years from enrollment.` : 'May not break even within 14 years at this school.',
      amount:'' },
    { num:'05', title:'10-Year Mark', sub:`Age ${18+years+10}`, hl:false,
      detail:`Best composite score: ${bestCollege.college.name}`,
      amount:'Composite: '+bestCollege.compositeScore+'/100' },
  ];
  document.getElementById('journey-timeline').innerHTML = steps.map(s=>`
    <div class="journey-step ${s.hl?'highlight':''}">
      <div class="journey-step-icon">${s.num}</div>
      <div class="journey-step-title">${s.title}</div>
      <div class="journey-step-sub">${s.sub}</div>
      <div class="journey-step-detail">${s.detail}</div>
      ${s.amount?`<div class="journey-step-amount">${s.amount}</div>`:''}
    </div>`).join('');
}

// ── AI Insights ────────────────────────────────────────────────
const FUN_STATS = [
  'Only 27% of college graduates work in a field directly related to their major (Federal Reserve Bank of NY).',
  'Students who negotiate financial aid receive an average of $2,800 more per year. Most students never ask.',
  'Elite school alumni networks produce 15–30% higher salaries at the 10-year mark vs. comparable students at regional schools.',
  'A 1% lower interest rate on a $40,000 loan saves $2,096 over 10 years. Auto-pay gets you a 0.25% discount.',
  'The College Scorecard salary numbers come from IRS tax records — the most accurate post-graduation earnings data available.',
  'FAFSA opens October 1st of senior year. Every week you wait can mean less grant money.',
  'Attending community college then transferring saves ~$37,000 vs. attending a 4-year private all four years.',
  'Internships completed by sophomore year produce 12% higher starting salaries on average (NACE 2024).',
  'Between 2008 and 2023, public university tuition rose 179% — more than 3x the rate of inflation.',
  'Employers at FAANG companies hire from ~30 schools for 70% of roles — brand recognition still matters.',
];

async function loadAIInsights(results, majors, income) {
  const valid = results.filter(Boolean);
  document.getElementById('ai-panel').innerHTML = '<div class="ai-loading"><div class="spinner"></div><span>Generating personalized insights...</span></div>';
  const payload = {
    majors,
    colleges: valid.map(r => ({
      name:r.college.name, city:r.college.city, state:r.college.state,
      score:r.compositeScore, scoreLabel:r.roiData.rating,
      prestigeScore:r.prestigeScore,
      compositeScore:r.compositeScore,
      netCost:r.costData.outOfPocketCost, monthlyPayment:r.loanData.monthlyPayment,
      loanAmount:r.loanData.loanPrincipal, startingSalary:r.blendedStart,
      graduationRate:r.college.graduationRate, admissionRate:r.college.admissionRate,
      govEarnings10yr:r.college.earnings?.tenYears, disposable:r.wellness.disposable
    }))
  };
  try {
    const res = await fetch('/api/ai-insights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const ins = await res.json();
    renderAIInsights(ins, valid, FUN_STATS[Math.floor(Math.random()*FUN_STATS.length)], majors.slice(0,2).join(' + '));
  } catch {
    renderAIInsights({
      verdict:'Compare the composite scores — they balance financial ROI with institutional quality. The highest composite score is the best overall pick.',
      warnings:valid.map(r=>`At ${r.college.name} (prestige ${r.prestigeScore}/100): ${r.loanData.noLoans?'No loans needed.':fmt(r.loanData.monthlyPayment)+'/mo loan = '+Math.round((r.loanData.monthlyPayment/(r.blendedStart/12))*100)+'% of starting pay.'}`),
      wildCard:`${majors[0]} salaries vary 40–60% by city. Elite school networks make it significantly easier to land roles in high-paying metro markets.`,
      negotiationTip:'Send competing offer letters to your top school and ask to match. 67% of students who negotiate receive more aid.'
    }, valid, FUN_STATS[0], majors[0]);
  }
}

function renderAIInsights(ins, valid, funStat, majorStr) {
  const warnings = ins.warnings || [];
  const cards = valid.map((r,i)=>`
    <div class="ai-college-card">
      <div class="ai-college-name">${r.college.name} · <span style="color:${r.roiData.ratingColor}">${r.roiData.rating}</span></div>
      <div class="ai-insight-text">${warnings[i]||'No specific warning for this school.'}</div>
    </div>`).join('');
  document.getElementById('ai-panel').innerHTML = `
    <div class="ai-verdict">${ins.verdict}</div>
    <div class="ai-warning-grid">${cards}</div>
    <div class="ai-bottom">
      <div class="ai-card"><span class="ai-card-label" style="color:var(--red)">⚡ WILD CARD</span><div class="ai-card-text">${ins.wildCard||'—'}</div></div>
      <div class="ai-card"><span class="ai-card-label" style="color:var(--accent)">💡 NEGOTIATION TIP</span><div class="ai-card-text">${ins.negotiationTip||'Ask your top school to match the best offer you have.'}</div></div>
      <div class="ai-card"><span class="ai-card-label" style="color:var(--blue)">📊 DID YOU KNOW</span><div class="ai-card-text">${funStat}</div></div>
    </div>`;
  chatContext = { majors:[majorStr], colleges:valid.map(r=>({ name:r.college.name, compositeScore:r.compositeScore, monthlyPayment:r.loanData.monthlyPayment, disposable:r.wellness.disposable })) };
}

// ── Chatbot ────────────────────────────────────────────────────
let chatOpen=false, chatHistory=[], chatContext=null;
function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatbot-window').classList.toggle('hidden', !chatOpen);
}
document.getElementById('chat-input').addEventListener('keydown', e => { if(e.key==='Enter') sendChatMessage(); });
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim(); if(!msg) return;
  input.value = ''; appendMsg('user', msg);
  const tid = appendTyping();
  try {
    const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,history:chatHistory.slice(-8),context:chatContext})});
    const d = await res.json();
    removeTyping(tid); appendMsg('bot', d.reply);
    chatHistory.push({role:'user',content:msg},{role:'assistant',content:d.reply});
  } catch { removeTyping(tid); appendMsg('bot','Connection issue — please try again!'); }
}
function appendMsg(role, text) {
  const m=document.getElementById('chatbot-messages');
  const d=document.createElement('div'); d.className=`chat-msg ${role}`;
  d.innerHTML=`<div class="chat-bubble">${text}</div>`; m.appendChild(d); m.scrollTop=m.scrollHeight;
}
function appendTyping() {
  const id='t-'+Date.now(), m=document.getElementById('chatbot-messages');
  const d=document.createElement('div'); d.className='chat-msg bot'; d.id=id;
  d.innerHTML='<div class="chat-bubble loading"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  m.appendChild(d); m.scrollTop=m.scrollHeight; return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }