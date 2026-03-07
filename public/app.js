// ============================================
// app.js — CollegeROI Frontend Logic
// ============================================

// ---- ABBREVIATION MAP ----
const ABBR = {
  'MIT': 'Massachusetts Institute of Technology',
  'UCLA': 'University of California Los Angeles',
  'USC': 'University of Southern California',
  'NYU': 'New York University',
  'CMU': 'Carnegie Mellon University',
  'UVA': 'University of Virginia',
  'UNC': 'University of North Carolina',
  'UIUC': 'University of Illinois Urbana-Champaign',
  'UMD': 'University of Maryland',
  'GT': 'Georgia Tech',
  'GATECH': 'Georgia Institute of Technology',
  'OSU': 'Ohio State University',
  'PSU': 'Pennsylvania State University',
  'UT': 'University of Texas Austin',
  'TAMU': 'Texas A&M University',
  'UF': 'University of Florida',
  'UGA': 'University of Georgia',
  'UW': 'University of Washington',
  'UMICH': 'University of Michigan',
  'BU': 'Boston University',
  'BC': 'Boston College',
  'GWU': 'George Washington University',
  'GMU': 'George Mason University',
  'VT': 'Virginia Tech',
  'JHU': 'Johns Hopkins University',
  'UPENN': 'University of Pennsylvania',
  'UCSD': 'University of California San Diego',
  'UCB': 'UC Berkeley',
  'UCI': 'University of California Irvine',
  'UCSB': 'University of California Santa Barbara',
  'ASU': 'Arizona State University',
  'MSU': 'Michigan State University',
  'ISU': 'Iowa State University',
  'PURDUE': 'Purdue University',
  'ND': 'University of Notre Dame',
  'WASHU': 'Washington University St Louis',
  'LSU': 'Louisiana State University',
  'PITT': 'University of Pittsburgh',
  'RUTGERS': 'Rutgers University',
  'NJIT': 'New Jersey Institute of Technology',
  'RPI': 'Rensselaer Polytechnic Institute',
  'WPI': 'Worcester Polytechnic Institute',
  'CORNELL': 'Cornell University',
  'COLUMBIA': 'Columbia University',
  'YALE': 'Yale University',
  'HARVARD': 'Harvard University',
  'PRINCETON': 'Princeton University',
  'BROWN': 'Brown University',
  'DARTMOUTH': 'Dartmouth College',
  'STANFORD': 'Stanford University',
  'CALTECH': 'California Institute of Technology',
  'NOVA': 'Northern Virginia Community College',
  'NVCC': 'Northern Virginia Community College',
};

const DEGREE_YEARS = {
  associates: 2,
  bachelors: 4,
  bachelors5: 5,
  masters: 6
};

// ---- STATE ----
const selectedColleges = [null, null, null];
let earningsChart = null;

// ============================================
// INFO TABS
// ============================================
document.querySelectorAll('.info-tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const panelId = 'panel-' + this.dataset.panel;
    const panel = document.getElementById(panelId);
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.info-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.info-tab-btn').forEach(b => b.classList.remove('active'));
    if (!isOpen) {
      panel.classList.add('open');
      this.classList.add('active');
    }
  });
});

document.querySelectorAll('.panel-close').forEach(btn => {
  btn.addEventListener('click', function () {
    this.closest('.info-panel').classList.remove('open');
    document.querySelectorAll('.info-tab-btn').forEach(b => b.classList.remove('active'));
  });
});

// ============================================
// COLLEGE SEARCH WITH ABBREVIATION SUPPORT
// ============================================
document.querySelectorAll('.college-search').forEach(input => {
  let debounceTimer;
  input.addEventListener('input', function () {
    const index = this.dataset.index;
    const raw = this.value.trim();
    if (raw.length < 2) { closeDropdown(index); return; }
    // Expand abbreviation if found (case-insensitive)
    const query = ABBR[raw.toUpperCase()] || raw;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchCollege(query, index), 300);
  });
});

// Close dropdowns when clicking anywhere else
document.addEventListener('click', function (e) {
  if (!e.target.classList.contains('college-search')) {
    document.querySelectorAll('.search-dropdown').forEach(d => d.classList.remove('open'));
  }
});

async function searchCollege(query, index) {
  try {
    const res = await fetch(`/api/search-college?name=${encodeURIComponent(query)}`);
    const colleges = await res.json();
    showDropdown(colleges, index);
  } catch (err) {
    console.error('Search error:', err);
  }
}

function showDropdown(colleges, index) {
  const dropdown = document.getElementById(`dropdown-${index}`);
  if (!colleges.length) {
    dropdown.innerHTML = '<div class="dropdown-item"><div class="dropdown-school">No results found</div></div>';
    dropdown.classList.add('open');
    return;
  }
  dropdown.innerHTML = colleges.map(c => `
    <div class="dropdown-item" onclick="selectCollege(${index}, ${JSON.stringify(c).replace(/"/g, '&quot;')})">
      <div class="dropdown-school">${c.name}</div>
      <div class="dropdown-location">${c.city}, ${c.state}</div>
    </div>`).join('');
  dropdown.classList.add('open');
}

function closeDropdown(index) {
  document.getElementById(`dropdown-${index}`).classList.remove('open');
}

function selectCollege(index, college) {
  selectedColleges[index] = college;
  const slot = document.getElementById(`slot-${index}`);
  slot.querySelector('.college-search').value = '';
  slot.querySelector('.selected-college').classList.remove('hidden');
  slot.querySelector('.selected-name').textContent = college.name;
  closeDropdown(index);
}

document.querySelectorAll('.clear-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const index = this.dataset.index;
    selectedColleges[index] = null;
    document.getElementById(`slot-${index}`).querySelector('.selected-college').classList.add('hidden');
  });
});

// ============================================
// CALCULATE BUTTON
// ============================================
document.getElementById('calculate-btn').addEventListener('click', async function () {
  const filledColleges = selectedColleges.filter(c => c !== null);
  if (filledColleges.length < 2) {
    document.getElementById('error-msg').classList.remove('hidden');
    return;
  }
  document.getElementById('error-msg').classList.add('hidden');

  const major = document.getElementById('major-select').value;
  const income = document.getElementById('income-select').value;
  const years = DEGREE_YEARS[document.getElementById('degree-select').value];

  // Fetch salary data for the chosen major
  const salaryRes = await fetch(`/api/salary/${encodeURIComponent(major)}`);
  const salaryData = await salaryRes.json();

  // Run all calculations for each selected college
  const results = selectedColleges.map((college, i) => {
    if (!college) return null;
    const isOutOfState = document.querySelector(`.state-toggle[data-index="${i}"]`).checked;
    return calculateAll(college, major, salaryData, income, years, isOutOfState);
  });

  // Switch to results page
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('results-page').classList.remove('hidden');
  window.scrollTo(0, 0);

  // Render all sections
  renderScoreCards(results);
  renderWellnessCards(results);
  renderChart(results, years);
  renderHiddenFees(results, years);
  renderTable(results);
  renderJourney(results, years);
  renderOpportunityCost(results);
  loadAIInsights(results, major);
});

// Back button
document.getElementById('back-btn').addEventListener('click', function () {
  document.getElementById('results-page').classList.add('hidden');
  document.getElementById('landing-page').classList.remove('hidden');
  window.scrollTo(0, 0);
});

// ============================================
// CALCULATION ENGINE
// ============================================

function calculateAll(college, major, salaryData, incomeBracket, yearsToGraduate, isOutOfState) {
  const costData = calculateTotalCost(college, yearsToGraduate, isOutOfState, incomeBracket);
  const loanData = calculateLoanRepayment(costData.outOfPocketCost);
  const earningsData = projectEarnings(salaryData, college, yearsToGraduate);
  const oppCost = calculateOpportunityCost(costData.outOfPocketCost);
  const roiData = calculateROIScore(earningsData, costData, loanData);
  const wellness = calculateFinancialWellness(roiData, loanData, salaryData);
  return { college, costData, loanData, earningsData, oppCost, roiData, wellness, major, salaryData };
}

// STEP 1 — Total Cost with financial aid estimate
function calculateTotalCost(college, yearsToGraduate, isOutOfState, incomeBracket) {
  const annualCost = isOutOfState ? college.tuition.outOfState : college.tuition.inState;
  const totalSticker = annualCost * yearsToGraduate;
  const aidRates = {
    under_30k: 0.70,
    '30k_to_60k': 0.50,
    '60k_to_110k': 0.25,
    over_110k: 0.08
  };
  const aidRate = aidRates[incomeBracket] || 0.25;
  const totalAid = totalSticker * aidRate;
  return {
    totalSticker,
    totalAid,
    outOfPocketCost: totalSticker - totalAid,
    annualCost
  };
}

// STEP 2 — Loan repayment at federal 6.5% rate over 10 years
// Formula: M = P[r(1+r)^n] / [(1+r)^n - 1]  Source: Federal Direct Loan 2023-24
function calculateLoanRepayment(loanAmount) {
  const r = 0.065 / 12;
  const n = 120;
  const monthly = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const total = monthly * n;
  return {
    monthlyPayment: Math.round(monthly),
    totalRepaid: Math.round(total),
    totalInterestPaid: Math.round(total - loanAmount)
  };
}

// STEP 3 — Project earnings blending college outcome data + major salary data
function projectEarnings(salaryData, college, yearsToGraduate) {
  // 60% weight on major BLS data, 40% on college scorecard earnings outcome
  const blendedStart = (salaryData.starting * 0.6) + ((college.earnings.sixYears || salaryData.starting) * 0.4);
  const data = [];
  for (let year = 1; year <= 14; year++) {
    if (year <= yearsToGraduate) {
      data.push({ year, salary: 0, label: `Yr ${year}` });
    } else {
      const yearsWorked = year - yearsToGraduate;
      const salary = blendedStart * Math.pow(1 + salaryData.growthRate, yearsWorked - 1);
      data.push({ year, salary: Math.round(salary), label: `Yr ${year}` });
    }
  }
  return data;
}

// STEP 4 — Opportunity cost: what tuition would be worth if invested at 7% S&P avg
function calculateOpportunityCost(outOfPocketCost) {
  const future = outOfPocketCost * Math.pow(1.07, 10);
  return {
    whatYouCouldHaveHad: Math.round(future),
    gainFromInvesting: Math.round(future - outOfPocketCost),
    principal: Math.round(outOfPocketCost)
  };
}

// STEP 5 — ROI Score and Grade
function calculateROIScore(earningsData, costData, loanData) {
  const totalEarnings = earningsData.reduce((s, d) => s + d.salary, 0);
  const totalCosts = costData.outOfPocketCost + loanData.totalInterestPaid;
  const netROI = totalEarnings - totalCosts;
  const pct = totalCosts > 0 ? (netROI / totalCosts) * 100 : 0;
  const grade =
    pct > 300 ? 'A+' :
    pct > 200 ? 'A'  :
    pct > 150 ? 'B+' :
    pct > 100 ? 'B'  :
    pct > 50  ? 'C'  :
    pct > 0   ? 'D'  : 'F';
  let breakEvenMonth = null, running = 0;
  earningsData.forEach((d, i) => {
    running += d.salary;
    if (running >= totalCosts && !breakEvenMonth) breakEvenMonth = (i + 1) * 12;
  });
  return {
    netROI: Math.round(netROI),
    roiPercentage: Math.round(pct),
    grade,
    breakEvenMonth,
    totalEarnings: Math.round(totalEarnings),
    totalCosts: Math.round(totalCosts)
  };
}

// STEP 6 — Financial Wellness indicators
function calculateFinancialWellness(roiData, loanData, salaryData) {
  const monthlyGross = salaryData.starting / 12;
  const monthlyNet = monthlyGross * 0.72; // ~28% effective tax rate
  const debtToIncome = (loanData.monthlyPayment / monthlyGross) * 100;
  // National average basics: rent $1,500 + food $400 + transport $300 = $2,200
  const disposable = monthlyNet - loanData.monthlyPayment - 2200;
  let score = 100;
  if (debtToIncome > 20) score -= 30; else if (debtToIncome > 10) score -= 15;
  if (disposable < 0) score -= 40; else if (disposable < 300) score -= 20;
  if (roiData.grade === 'F') score -= 20; else if (roiData.grade === 'D') score -= 10;
  return {
    debtToIncome: Math.round(debtToIncome),
    disposable: Math.round(disposable),
    monthlyNet: Math.round(monthlyNet),
    score: Math.max(0, Math.min(100, score))
  };
}

// ============================================
// RENDER FUNCTIONS
// ============================================

// Format money nicely: $1.2M / $87K / $450
function fmt(num) {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return sign + '$' + Math.round(abs / 1000) + 'K';
  return sign + '$' + abs.toLocaleString();
}

// ---- Score Cards ----
function renderScoreCards(results) {
  const valid = results.filter(r => r !== null);
  const bestROI = Math.max(...valid.map(r => r.roiData.netROI));
  document.getElementById('score-cards').innerHTML = valid.map((r, i) => {
    const isBest = r.roiData.netROI === bestROI;
    const gradeClass = 'grade-' + r.roiData.grade.replace('+', '-plus');
    const roiColor = r.roiData.netROI >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    return `
      <div class="score-card ${isBest ? 'best' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="score-card-name">${r.college.name}</div>
        <div class="score-card-location">${r.college.city}, ${r.college.state}</div>
        <div class="grade-display ${gradeClass}">${r.roiData.grade}</div>
        <div class="score-card-roi" style="${roiColor}">${r.roiData.netROI >= 0 ? '+' : ''}${fmt(r.roiData.netROI)}</div>
        <div class="score-card-label">NET 10-YEAR GAIN</div>
        <div class="score-card-payment">Monthly loan: <span>${fmt(r.loanData.monthlyPayment)}/mo</span></div>
        ${isBest ? '<div class="best-badge">✓ BEST ROI</div>' : ''}
      </div>`;
  }).join('');
}

// ---- Financial Wellness Cards ----
function renderWellnessCards(results) {
  const valid = results.filter(r => r !== null);
  document.getElementById('wellness-cards').innerHTML = valid.map((r, i) => {
    const w = r.wellness;
    const sc = w.score >= 70 ? 'var(--green)' : w.score >= 40 ? 'var(--yellow)' : 'var(--red)';
    const dc = w.debtToIncome <= 10 ? 'var(--green)' : w.debtToIncome <= 20 ? 'var(--yellow)' : 'var(--red)';
    const dispPos = w.disposable >= 0;
    return `
      <div class="wellness-card" style="animation-delay:${i * 0.1}s">
        <div class="wellness-card-name">${r.college.name}</div>
        <div class="wellness-metric">
          <div class="wellness-metric-label">WELLNESS SCORE</div>
          <div class="wellness-metric-value" style="color:${sc}">${w.score}/100</div>
        </div>
        <div class="wellness-bar-wrap">
          <div class="wellness-bar" style="width:${w.score}%;background:${sc}"></div>
        </div>
        <div class="wellness-metric">
          <div class="wellness-metric-label">DEBT-TO-INCOME</div>
          <div class="wellness-metric-value" style="color:${dc}">
            ${w.debtToIncome}% &nbsp; ${w.debtToIncome <= 10 ? '✓ Healthy' : w.debtToIncome <= 20 ? '⚠ Moderate' : '⚠ High'}
          </div>
        </div>
        <div class="wellness-metric">
          <div class="wellness-metric-label">MONTHLY TAKE-HOME</div>
          <div class="wellness-metric-value">${fmt(w.monthlyNet)}/mo</div>
        </div>
        <div class="wellness-metric">
          <div class="wellness-metric-label">LEFT AFTER LOAN + BASICS</div>
          <div class="wellness-metric-value" style="color:${dispPos ? 'var(--green)' : 'var(--red)'}">
            ${dispPos ? '+' : ''}${fmt(w.disposable)}/mo ${dispPos ? '' : '⚠'}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ---- Earnings Chart ----
function renderChart(results, yearsToGraduate) {
  if (earningsChart) earningsChart.destroy();
  const colors = ['#B8892A', '#1B4FBD', '#166534'];
  const valid = results.filter(r => r !== null);
  const ctx = document.getElementById('earnings-chart').getContext('2d');
  earningsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: valid[0].earningsData.map(d => d.label),
      datasets: valid.map((r, i) => ({
        label: r.college.name,
        data: r.earningsData.map(d => d.salary),
        borderColor: colors[i],
        backgroundColor: colors[i] + '18',
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.4,
        fill: true
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#6B7280', font: { family: 'DM Sans', size: 12 } } },
        tooltip: {
          backgroundColor: '#fff', borderColor: '#D8D2C6', borderWidth: 1,
          titleColor: '#1C2232', bodyColor: '#6B7280',
          callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}/yr` }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#6B7280', font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: '#6B7280', font: { size: 11 }, callback: v => fmt(v) }
        }
      }
    }
  });
}

// ---- Hidden Fees Section ----
function renderHiddenFees(results, yearsToGraduate) {
  const valid = results.filter(r => r !== null);
  // Source: College Board 2023 Trends in College Pricing
  const fees = [
    { label: 'Room & Board',              annual: 12990 },
    { label: 'Books & Supplies',          annual: 1240  },
    { label: 'Personal Expenses',         annual: 2120  },
    { label: 'Transportation',            annual: 1320  },
    { label: 'Technology & Mandatory Fees', annual: 800 },
  ];
  const totalHiddenAnnual = fees.reduce((s, f) => s + f.annual, 0);
  const totalHidden = totalHiddenAnnual * yearsToGraduate;
  document.getElementById('hidden-fees').innerHTML = valid.map(r => `
    <div class="hidden-fees-card">
      <div class="hidden-fees-card-name">${r.college.name}</div>
      <div class="hidden-fees-subtitle">Tuition paid: ${fmt(r.costData.outOfPocketCost)} · Plus these national-average hidden costs (College Board 2023):</div>
      ${fees.map(f => `
        <div class="fee-row">
          <span class="fee-row-label">${f.label}</span>
          <span class="fee-row-value">${fmt(f.annual)}/yr &nbsp;·&nbsp; ${fmt(f.annual * yearsToGraduate)} total</span>
        </div>`).join('')}
      <div class="fee-total-row">
        <span>TRUE TOTAL COST OF ATTENDANCE</span>
        <span class="fee-row-value">${fmt(r.costData.outOfPocketCost + totalHidden)}</span>
      </div>
    </div>`).join('');
}

// ---- Comparison Table ----
function renderTable(results) {
  const valid = results.filter(r => r !== null);

  function colorCells(raw, higherIsBetter) {
    const sorted = [...raw].sort((a, b) => higherIsBetter ? b - a : a - b);
    return raw.map(v =>
      v === sorted[0] ? 'cell-green' :
      (raw.length > 2 && v === sorted[raw.length - 1]) ? 'cell-red' :
      'cell-yellow'
    );
  }

  const rows = [
    { label: 'TOTAL STICKER COST',    vals: valid.map(r => fmt(r.costData.totalSticker)),           raw: valid.map(r => r.costData.totalSticker),        higher: false },
    { label: 'FINANCIAL AID EST.',    vals: valid.map(r => fmt(r.costData.totalAid)),                raw: valid.map(r => r.costData.totalAid),             higher: true  },
    { label: 'OUT OF POCKET',         vals: valid.map(r => fmt(r.costData.outOfPocketCost)),         raw: valid.map(r => r.costData.outOfPocketCost),      higher: false },
    { label: 'STARTING SALARY',       vals: valid.map(r => fmt(r.salaryData.starting) + '/yr'),      raw: valid.map(r => r.salaryData.starting),           higher: true  },
    { label: 'MONTHLY LOAN PMT',      vals: valid.map(r => fmt(r.loanData.monthlyPayment) + '/mo'),  raw: valid.map(r => r.loanData.monthlyPayment),       higher: false },
    { label: 'TOTAL INTEREST PAID',   vals: valid.map(r => fmt(r.loanData.totalInterestPaid)),       raw: valid.map(r => r.loanData.totalInterestPaid),    higher: false },
    { label: 'DEBT-TO-INCOME',        vals: valid.map(r => r.wellness.debtToIncome + '%'),           raw: valid.map(r => r.wellness.debtToIncome),         higher: false },
    { label: 'LEFT AFTER BILLS',      vals: valid.map(r => (r.wellness.disposable >= 0 ? '+' : '') + fmt(r.wellness.disposable) + '/mo'), raw: valid.map(r => r.wellness.disposable), higher: true },
    { label: 'NET 10-YEAR ROI',       vals: valid.map(r => (r.roiData.netROI >= 0 ? '+' : '') + fmt(r.roiData.netROI)), raw: valid.map(r => r.roiData.netROI), higher: true },
    { label: 'ROI GRADE',             vals: valid.map(r => r.roiData.grade),                         raw: null },
    { label: 'WELLNESS SCORE',        vals: valid.map(r => r.wellness.score + '/100'),               raw: valid.map(r => r.wellness.score),                higher: true  }
  ];

  // Full college names in header — no truncation
  const headers = ['METRIC', ...valid.map(r => r.college.name)].map(h => `<th>${h}</th>`).join('');
  const tableRows = rows.map(row => {
    const cls = row.raw ? colorCells(row.raw, row.higher) : row.vals.map(() => '');
    return `<tr><td class="row-label">${row.label}</td>${row.vals.map((v, i) => `<td class="${cls[i]}">${v}</td>`).join('')}</tr>`;
  }).join('');

  document.getElementById('comparison-table').innerHTML = `
    <table class="comp-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// ---- College Journey Timeline ----
function renderJourney(results, yearsToGraduate) {
  const valid = results.filter(r => r !== null);
  const r = valid[0];
  const breakEvenYearsAfterGrad = r.roiData.breakEvenMonth ? Math.ceil(r.roiData.breakEvenMonth / 12) : '?';
  const steps = [
    {
      icon: '🎓', title: 'Enroll', sub: 'Year 1', highlight: false,
      detail: 'Tuition + hidden fees begin. Estimated true Year 1 cost:',
      amount: fmt(r.costData.annualCost + 18470)
    },
    {
      icon: '📚', title: 'Graduate', sub: `Year ${yearsToGraduate}`, highlight: true,
      detail: 'Total out-of-pocket paid. Loan repayment begins at:',
      amount: fmt(r.loanData.monthlyPayment) + '/mo'
    },
    {
      icon: '💼', title: 'First Job', sub: `Year ${yearsToGraduate}+`, highlight: false,
      detail: `Starting salary in ${r.major}:`,
      amount: fmt(r.salaryData.starting) + '/yr'
    },
    {
      icon: '⚖️', title: 'Break Even', sub: `~Year ${yearsToGraduate + breakEvenYearsAfterGrad}`, highlight: true,
      detail: 'Cumulative earnings exceed total costs paid. Loans fully repaid.',
      amount: ''
    },
    {
      icon: '📈', title: '10-Year Mark', sub: `Year ${yearsToGraduate + 10}`, highlight: false,
      detail: 'Best net gain across all colleges compared:',
      amount: fmt(Math.max(...valid.map(v => v.roiData.netROI)))
    }
  ];

  document.getElementById('journey-timeline').innerHTML = steps.map(s => `
    <div class="journey-step ${s.highlight ? 'highlight' : ''}">
      <div class="journey-step-icon">${s.icon}</div>
      <div class="journey-step-title">${s.title}</div>
      <div class="journey-step-sub">${s.sub}</div>
      <div class="journey-step-detail">${s.detail}</div>
      ${s.amount ? `<div class="journey-step-amount">${s.amount}</div>` : ''}
    </div>`).join('');
}

// ---- Opportunity Cost ----
function renderOpportunityCost(results) {
  const valid = results.filter(r => r !== null);
  document.getElementById('opportunity-cards').innerHTML = valid.map((r, i) => `
    <div class="opp-card" style="animation-delay:${i * 0.1}s">
      <div class="opp-card-name">${r.college.name}</div>
      <div class="opp-amount">${fmt(r.oppCost.whatYouCouldHaveHad)}</div>
      <div class="opp-label">
        If you invested ${fmt(r.oppCost.principal)} (tuition) instead,<br/>
        it would grow to this in 10 years at 7% S&amp;P return.<br/>
        <span class="opp-gain">Investment gain: +${fmt(r.oppCost.gainFromInvesting)}</span>
      </div>
    </div>`).join('');
}

// ---- AI Insights ----
async function loadAIInsights(results, major) {
  const valid = results.filter(r => r !== null);
  const payload = {
    major,
    colleges: valid.map(r => ({
      name: r.college.name,
      totalCost: r.costData.outOfPocketCost,
      startingSalary: r.salaryData.starting,
      netROI: r.roiData.netROI,
      grade: r.roiData.grade,
      monthlyPayment: r.loanData.monthlyPayment,
      breakEvenMonth: r.roiData.breakEvenMonth,
      debtToIncome: r.wellness.debtToIncome,
      disposableIncome: r.wellness.disposable
    }))
  };
  try {
    const res = await fetch('/api/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const insights = await res.json();
    renderAIInsights(insights, valid);
  } catch (err) {
    console.error('AI error:', err);
    document.getElementById('ai-panel').innerHTML =
      '<p style="color:var(--text-dim);font-size:14px">AI insights unavailable — check your Groq API key in .env</p>';
  }
}

function renderAIInsights(insights, results) {
  const warnings = insights.warnings || [];
  // Pad warnings to match college count
  while (warnings.length < results.length) {
    warnings.push('Always negotiate your financial aid package — most colleges have flexibility not reflected in the sticker price.');
  }
  const warningCards = results.map((r, i) => `
    <div class="ai-card">
      <span class="ai-card-label">⚠ ${r.college.name}</span>
      <div class="ai-card-text">${warnings[i]}</div>
    </div>`).join('');

  document.getElementById('ai-panel').innerHTML = `
    <div class="ai-verdict">${insights.verdict}</div>
    <div class="ai-grid">${warningCards}</div>
    <div class="ai-bottom">
      <div class="ai-wildcard">
        <span class="ai-card-label" style="color:var(--red)">🃏 WILD CARD</span>
        <div class="ai-card-text">${insights.wildCard}</div>
      </div>
      <div class="ai-funstat">
        <span class="ai-card-label" style="color:var(--blue)">📊 FUN STAT</span>
        <div class="ai-card-text">${insights.funStat}</div>
      </div>
    </div>`;
}