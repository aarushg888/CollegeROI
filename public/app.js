// ============================================
// app.js — CollegeROI Frontend Logic
// Handles search, calculations, and display
// ============================================

// ---- STATE ----
// This stores the 3 selected colleges
const selectedColleges = [null, null, null];
let earningsChart = null;

// ---- COLLEGE SEARCH ----
// Each search input calls the backend as you type
document.querySelectorAll('.college-search').forEach(input => {
  let debounceTimer;

  input.addEventListener('input', function() {
    const index = this.dataset.index;
    const query = this.value.trim();

    // Wait 300ms after typing stops before searching
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      closeDropdown(index);
      return;
    }

    debounceTimer = setTimeout(() => searchCollege(query, index), 300);
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('college-search')) {
      document.querySelectorAll('.search-dropdown').forEach(d => {
        d.classList.remove('open');
      });
    }
  });
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
    </div>
  `).join('');

  dropdown.classList.add('open');
}

function closeDropdown(index) {
  document.getElementById(`dropdown-${index}`).classList.remove('open');
}

function selectCollege(index, college) {
  selectedColleges[index] = college;

  // Hide search input, show selected display
  const slot = document.getElementById(`slot-${index}`);
  slot.querySelector('.college-search').value = '';
  slot.querySelector('.selected-college').classList.remove('hidden');
  slot.querySelector('.selected-name').textContent = college.name;
  closeDropdown(index);
}

// Clear button removes selected college
document.querySelectorAll('.clear-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const index = this.dataset.index;
    selectedColleges[index] = null;
    document.getElementById(`slot-${index}`)
      .querySelector('.selected-college').classList.add('hidden');
  });
});


// ---- CALCULATE BUTTON ----
document.getElementById('calculate-btn').addEventListener('click', async function() {
  const filledColleges = selectedColleges.filter(c => c !== null);

  // Need at least 2 colleges
  if (filledColleges.length < 2) {
    document.getElementById('error-msg').classList.remove('hidden');
    return;
  }
  document.getElementById('error-msg').classList.add('hidden');

  const major = document.getElementById('major-select').value;
  const income = document.getElementById('income-select').value;
  const years = parseInt(document.getElementById('years-select').value);

  // Get salary data for selected major
  const salaryRes = await fetch(`/api/salary/${encodeURIComponent(major)}`);
  const salaryData = await salaryRes.json();

  // Run calculations for each college
  const results = selectedColleges.map((college, i) => {
    if (!college) return null;
    const isOutOfState = document.querySelector(`.state-toggle[data-index="${i}"]`).checked;
    return calculateAll(college, major, salaryData, income, years, isOutOfState);
  });

  // Show results page
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('results-page').classList.remove('hidden');
  window.scrollTo(0, 0);

  // Render everything
  renderScoreCards(results, selectedColleges);
  renderChart(results, selectedColleges, years);
  renderTable(results, selectedColleges);
  renderOpportunityCost(results, selectedColleges);

  // Load AI insights (async, shows spinner while loading)
  loadAIInsights(results, selectedColleges, major);
});

// Back button
document.getElementById('back-btn').addEventListener('click', function() {
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

  return { college, costData, loanData, earningsData, oppCost, roiData, major, salaryData };
}

// STEP 1 — Total Cost
function calculateTotalCost(college, yearsToGraduate, isOutOfState, incomeBracket) {
  const annualCost = isOutOfState
    ? college.tuition.outOfState
    : college.tuition.inState;

  const totalSticker = annualCost * yearsToGraduate;

  const aidRates = {
    under_30k: 0.70,
    '30k_to_60k': 0.50,
    '60k_to_110k': 0.25,
    over_110k: 0.08
  };
  const aidRate = aidRates[incomeBracket] || 0.25;
  const totalAid = totalSticker * aidRate;
  const outOfPocketCost = totalSticker - totalAid;

  return { totalSticker, totalAid, outOfPocketCost, annualCost };
}

// STEP 2 — Loan Repayment
function calculateLoanRepayment(loanAmount) {
  const annualRate = 0.065;
  const monthlyRate = annualRate / 12;
  const n = 120; // 10 years

  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))
    / (Math.pow(1 + monthlyRate, n) - 1);

  const totalRepaid = monthlyPayment * n;
  const totalInterestPaid = totalRepaid - loanAmount;

  return {
    monthlyPayment: Math.round(monthlyPayment),
    totalRepaid: Math.round(totalRepaid),
    totalInterestPaid: Math.round(totalInterestPaid)
  };
}

// STEP 3 — Project Earnings
function projectEarnings(salaryData, college, yearsToGraduate) {
  const blendedStart = (salaryData.starting * 0.6) + ((college.earnings.sixYears || salaryData.starting) * 0.4);
  const growthRate = salaryData.growthRate;
  const data = [];
  let cumulative = 0;

  for (let year = 1; year <= 14; year++) {
    if (year <= yearsToGraduate) {
      data.push({ year, salary: 0, cumulative: 0, label: `Year ${year}` });
    } else {
      const yearsWorked = year - yearsToGraduate;
      const salary = blendedStart * Math.pow(1 + growthRate, yearsWorked - 1);
      cumulative += salary;
      data.push({ year, salary: Math.round(salary), cumulative: Math.round(cumulative), label: `Year ${year}` });
    }
  }
  return data;
}

// STEP 4 — Opportunity Cost
function calculateOpportunityCost(outOfPocketCost) {
  const years = 10;
  const rate = 0.07;
  const whatYouCouldHaveHad = outOfPocketCost * Math.pow(1 + rate, years);
  const gainFromInvesting = whatYouCouldHaveHad - outOfPocketCost;
  return {
    whatYouCouldHaveHad: Math.round(whatYouCouldHaveHad),
    gainFromInvesting: Math.round(gainFromInvesting),
    principal: Math.round(outOfPocketCost)
  };
}

// STEP 5 — ROI Score
function calculateROIScore(earningsData, costData, loanData) {
  const totalEarnings = earningsData.reduce((sum, d) => sum + d.salary, 0);
  const totalCosts = costData.outOfPocketCost + loanData.totalInterestPaid;
  const netROI = totalEarnings - totalCosts;
  const roiPercentage = totalCosts > 0 ? (netROI / totalCosts) * 100 : 0;

  let grade;
  if (roiPercentage > 300) grade = 'A+';
  else if (roiPercentage > 200) grade = 'A';
  else if (roiPercentage > 150) grade = 'B+';
  else if (roiPercentage > 100) grade = 'B';
  else if (roiPercentage > 50) grade = 'C';
  else if (roiPercentage > 0) grade = 'D';
  else grade = 'F';

  // Find break-even month
  let breakEvenMonth = null;
  let runningTotal = 0;
  for (let i = 0; i < earningsData.length; i++) {
    runningTotal += earningsData[i].salary;
    if (runningTotal >= totalCosts && !breakEvenMonth) {
      breakEvenMonth = (i + 1) * 12;
    }
  }

  return {
    netROI: Math.round(netROI),
    roiPercentage: Math.round(roiPercentage),
    grade,
    breakEvenMonth,
    totalEarnings: Math.round(totalEarnings),
    totalCosts: Math.round(totalCosts)
  };
}


// ============================================
// RENDER FUNCTIONS
// ============================================

// Format money nicely
function fmt(num) {
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K';
  return '$' + num.toLocaleString();
}

// Score Cards
function renderScoreCards(results, colleges) {
  const container = document.getElementById('score-cards');

  // Find best ROI to highlight it
  const validResults = results.filter(r => r !== null);
  const bestROI = Math.max(...validResults.map(r => r.roiData.netROI));

  container.innerHTML = validResults.map((r, i) => {
    const isBest = r.roiData.netROI === bestROI;
    const gradeClass = 'grade-' + r.roiData.grade.replace('+', '-plus');
    const roiColor = r.roiData.netROI >= 0 ? 'color: var(--green)' : 'color: var(--red)';

    return `
      <div class="score-card ${isBest ? 'best' : ''}" style="animation-delay: ${i * 0.1}s">
        <div class="score-card-name">${r.college.name}</div>
        <div class="score-card-location">${r.college.city}, ${r.college.state}</div>
        <div class="grade-display ${gradeClass}">${r.roiData.grade}</div>
        <div class="score-card-roi" style="${roiColor}">
          ${r.roiData.netROI >= 0 ? '+' : ''}${fmt(r.roiData.netROI)}
        </div>
        <div class="score-card-label">NET 10-YEAR GAIN</div>
        <div class="score-card-payment">
          Monthly loan payment: <span>${fmt(r.loanData.monthlyPayment)}/mo</span>
        </div>
        ${isBest ? '<div class="best-badge">BEST ROI</div>' : ''}
      </div>
    `;
  }).join('');
}

// Chart
function renderChart(results, colleges, yearsToGraduate) {
  if (earningsChart) earningsChart.destroy();

  const colors = ['#f0b429', '#58a6ff', '#3fb950'];
  const validResults = results.filter(r => r !== null);
  const labels = validResults[0].earningsData.map(d => `Yr ${d.year}`);

  const datasets = validResults.map((r, i) => ({
    label: r.college.name.length > 25 ? r.college.name.substring(0, 25) + '...' : r.college.name,
    data: r.earningsData.map(d => d.salary),
    borderColor: colors[i],
    backgroundColor: colors[i] + '15',
    borderWidth: 2.5,
    pointRadius: 3,
    tension: 0.4,
    fill: true
  }));

  const ctx = document.getElementById('earnings-chart').getContext('2d');
  earningsChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#7d8590', font: { family: 'DM Sans', size: 12 } }
        },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}/yr`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#7d8590', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#7d8590', font: { size: 11 },
            callback: v => fmt(v)
          }
        }
      }
    }
  });
}

// Comparison Table
function renderTable(results, colleges) {
  const validResults = results.filter(r => r !== null);
  const container = document.getElementById('comparison-table');

  // Helper to color-code cells (green = best, red = worst)
  function colorCells(values, higherIsBetter = false) {
    const sorted = [...values].sort((a, b) => higherIsBetter ? b - a : a - b);
    return values.map(v => {
      if (v === sorted[0]) return 'cell-green';
      if (values.length > 2 && v === sorted[sorted.length - 1]) return 'cell-red';
      return 'cell-yellow';
    });
  }

  const rows = [
    {
      label: 'TOTAL STICKER COST',
      values: validResults.map(r => fmt(r.costData.totalSticker)),
      raw: validResults.map(r => r.costData.totalSticker),
      higherIsBetter: false
    },
    {
      label: 'FINANCIAL AID',
      values: validResults.map(r => fmt(r.costData.totalAid)),
      raw: validResults.map(r => r.costData.totalAid),
      higherIsBetter: true
    },
    {
      label: 'OUT OF POCKET',
      values: validResults.map(r => fmt(r.costData.outOfPocketCost)),
      raw: validResults.map(r => r.costData.outOfPocketCost),
      higherIsBetter: false
    },
    {
      label: 'STARTING SALARY',
      values: validResults.map(r => fmt(r.salaryData.starting)),
      raw: validResults.map(r => r.salaryData.starting),
      higherIsBetter: true
    },
    {
      label: 'MONTHLY LOAN PAYMENT',
      values: validResults.map(r => fmt(r.loanData.monthlyPayment) + '/mo'),
      raw: validResults.map(r => r.loanData.monthlyPayment),
      higherIsBetter: false
    },
    {
      label: 'TOTAL INTEREST PAID',
      values: validResults.map(r => fmt(r.loanData.totalInterestPaid)),
      raw: validResults.map(r => r.loanData.totalInterestPaid),
      higherIsBetter: false
    },
    {
      label: 'NET 10-YEAR ROI',
      values: validResults.map(r => (r.roiData.netROI >= 0 ? '+' : '') + fmt(r.roiData.netROI)),
      raw: validResults.map(r => r.roiData.netROI),
      higherIsBetter: true
    },
    {
      label: 'ROI GRADE',
      values: validResults.map(r => r.roiData.grade),
      raw: null
    }
  ];

  const headers = ['METRIC', ...validResults.map(r =>
    r.college.name.length > 20 ? r.college.name.substring(0, 20) + '...' : r.college.name
  )].map(h => `<th>${h}</th>`).join('');

  const tableRows = rows.map(row => {
    const classes = row.raw ? colorCells(row.raw, row.higherIsBetter) : row.values.map(() => '');
    const cells = row.values.map((v, i) => `<td class="${classes[i]}">${v}</td>`).join('');
    return `<tr><td class="row-label">${row.label}</td>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <table class="comp-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

// Opportunity Cost
function renderOpportunityCost(results, colleges) {
  const container = document.getElementById('opportunity-cards');
  const validResults = results.filter(r => r !== null);

  container.innerHTML = validResults.map((r, i) => `
    <div class="opp-card" style="animation-delay: ${i * 0.1}s">
      <div class="opp-card-name">${r.college.name}</div>
      <div class="opp-amount">${fmt(r.oppCost.whatYouCouldHaveHad)}</div>
      <div class="opp-label">
        If you invested ${fmt(r.oppCost.principal)} instead of tuition,<br/>
        it would be worth this in 10 years at 7% S&P return.<br/>
        <span class="opp-gain">Gain: +${fmt(r.oppCost.gainFromInvesting)}</span>
      </div>
    </div>
  `).join('');
}

// AI Insights
async function loadAIInsights(results, colleges, major) {
  const validResults = results.filter(r => r !== null);

  const payload = {
    major,
    colleges: validResults.map(r => ({
      name: r.college.name,
      totalCost: r.costData.outOfPocketCost,
      startingSalary: r.salaryData.starting,
      netROI: r.roiData.netROI,
      grade: r.roiData.grade,
      monthlyPayment: r.loanData.monthlyPayment,
      breakEvenMonth: r.roiData.breakEvenMonth
    }))
  };

  try {
    const res = await fetch('/api/ai-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const insights = await res.json();
    renderAIInsights(insights, validResults);
  } catch (err) {
    console.error('AI error:', err);
    document.getElementById('ai-panel').innerHTML =
      '<p style="color: var(--text-dim)">AI insights unavailable. Check your Groq API key.</p>';
  }
}

function renderAIInsights(insights, results) {
  const warnings = insights.warnings || [];
  // Pad warnings array to match number of colleges
  while (warnings.length < results.length) warnings.push('No specific warning available.');

  const warningCards = results.map((r, i) => `
    <div class="ai-card">
      <div class="ai-card-label">⚠ ${r.college.name.substring(0, 20)}</div>
      <div class="ai-card-text">${warnings[i] || 'No specific warning.'}</div>
    </div>
  `).join('');

  document.getElementById('ai-panel').innerHTML = `
    <div class="ai-verdict">${insights.verdict}</div>
    <div class="ai-grid">${warningCards}</div>
    <div class="ai-bottom">
      <div class="ai-wildcard">
        <div class="ai-card-label" style="color: var(--red)">🃏 WILD CARD</div>
        <div class="ai-card-text">${insights.wildCard}</div>
      </div>
      <div class="ai-funstat">
        <div class="ai-card-label" style="color: var(--accent2)">📊 FUN STAT</div>
        <div class="ai-card-text">${insights.funStat}</div>
      </div>
    </div>
  `;
}