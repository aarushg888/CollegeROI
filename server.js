require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const Groq = require('groq-sdk');
const path = require('path');
const salaries = require('./data/salaries.json');

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Full field list the frontend scoring engine needs ──────────────────────
const SCORECARD_FIELDS = [
  'id','school.name','school.city','school.state',
  'latest.cost.tuition.in_state','latest.cost.tuition.out_of_state',
  'latest.cost.attendance.academic_year',
  'latest.aid.median_debt.completers.overall',
  'latest.aid.pell_grant_rate','latest.aid.federal_loan_rate',
  'latest.earnings.6_yrs_after_entry.median',
  'latest.earnings.8_yrs_after_entry.median_earnings',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.completion.rate_suppressed.overall',
  'latest.student.retention_rate.four_year.full_time',
  'latest.repayment.3_yr_repayment.overall',
  'latest.admissions.admission_rate.overall',
  'latest.student.size',
  'latest.student.demographics.median_hh_income',
].join(',');

function mapSchool(school) {
  return {
    id: school.id,
    name: school['school.name'],
    city: school['school.city'],
    state: school['school.state'],
    tuition: {
      inState:         school['latest.cost.tuition.in_state']    || 12000,
      outOfState:      school['latest.cost.tuition.out_of_state'] || 28000,
      totalAttendance: school['latest.cost.attendance.academic_year'] || 22000,
    },
    medianDebt:      school['latest.aid.median_debt.completers.overall'] || 25000,
    pellGrantRate:   school['latest.aid.pell_grant_rate']   || null,
    federalLoanRate: school['latest.aid.federal_loan_rate'] || null,
    earnings: {
      sixYears:   school['latest.earnings.6_yrs_after_entry.median']          || null,
      eightYears: school['latest.earnings.8_yrs_after_entry.median_earnings'] || null,
      tenYears:   school['latest.earnings.10_yrs_after_entry.median']         || null,
    },
    graduationRate: school['latest.completion.rate_suppressed.overall']          || null,
    retentionRate:  school['latest.student.retention_rate.four_year.full_time']  || null,
    repaymentRate:  school['latest.repayment.3_yr_repayment.overall']            || null,
    admissionRate:  school['latest.admissions.admission_rate.overall']           || null,
    studentSize:    school['latest.student.size']                                || null,
    medianStudentIncome: school['latest.student.demographics.median_hh_income'] || null,
  };
}

// ============================================
// ROUTE 1: Search colleges
// ============================================
app.get('/api/search-college', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Please provide a college name' });
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.name=${encodeURIComponent(name)}&fields=${SCORECARD_FIELDS}&per_page=5&api_key=${process.env.COLLEGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) return res.json([]);
    res.json(data.results.map(mapSchool));
  } catch (error) {
    console.error('College search error:', error);
    res.status(500).json({ error: 'Failed to search colleges' });
  }
});

// ============================================
// ROUTE 2: Get one college by ID
// ============================================
app.get('/api/college/:id', async (req, res) => {
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?id=${req.params.id}&fields=${SCORECARD_FIELDS}&api_key=${process.env.COLLEGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) return res.status(404).json({ error: 'College not found' });
    res.json(mapSchool(data.results[0]));
  } catch (error) {
    console.error('College fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch college' });
  }
});

// ============================================
// ROUTE 3: AI Insights
// ============================================
app.post('/api/ai-insights', async (req, res) => {
  const { colleges, majors, householdIncome } = req.body;
  const majorStr = Array.isArray(majors) ? majors.join(' & ') : (majors || 'your major');

  const collegeDescriptions = colleges.map((c, i) => `
College ${i + 1}: ${c.name} (${c.city}, ${c.state})
  - Prestige Score: ${c.prestigeScore}/100 | Composite Score: ${c.compositeScore}/100 | Grade: ${c.scoreLabel}
  - Out-of-Pocket: $${c.netCost?.toLocaleString() || 'N/A'} total
  - Starting Salary (${majorStr}): $${c.startingSalary?.toLocaleString() || 'N/A'}/yr
  - Monthly Loan Payment: $${c.monthlyPayment?.toLocaleString() || '0'}/mo (${c.loanAmount === 0 ? 'NO LOANS NEEDED' : '$' + c.loanAmount?.toLocaleString() + ' borrowed'})
  - Net 10-yr ROI: $${c.netROI?.toLocaleString() || 'N/A'}
  - Disposable After Bills: $${c.disposable?.toLocaleString() || 'N/A'}/mo
  - Graduation Rate: ${c.graduationRate ? Math.round(c.graduationRate * 100) + '%' : 'N/A'}
  - Admission Rate: ${c.admissionRate ? Math.round(c.admissionRate * 100) + '%' : 'N/A'}
  - IRS-Verified 10yr Earnings: ${c.govEarnings10yr ? '$' + c.govEarnings10yr.toLocaleString() : 'N/A'}
`).join('');

  const prompt = `You are a brutally honest college financial advisor. A student with household income $${householdIncome?.toLocaleString() || 'unknown'} is comparing colleges for ${majorStr}.

${collegeDescriptions}

NOTE: The composite score balances financial ROI (50%), prestige/rigor (25%), and student outcomes (25%). A community college won't score highest even with great ROI because prestige, network, and graduation rates matter for career outcomes.

Rules:
1. Reference each college by EXACT name and use the ACTUAL numbers given.
2. Every college insight must be completely different — no copy-pasting between colleges.
3. Be direct — this is a teenager making a major life decision.

Return ONLY valid raw JSON, no markdown, no backticks:
{"verdict":"2-3 direct sentences naming specific colleges and numbers explaining the best overall choice","warnings":["specific insight for college 1 with real numbers","specific insight for college 2 with real numbers"],"wildCard":"one surprising career factor about ${majorStr} that most students don't consider","negotiationTip":"one specific financial aid negotiation tactic relevant to these schools"}

warnings array must have exactly ${colleges.length} strings.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });
    let text = completion.choices[0].message.content;
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    res.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error('AI insights error:', error);
    res.json({
      verdict: `Compare the composite scores — they balance financial ROI with institutional quality. The highest composite score is the best overall pick for ${majorStr}.`,
      warnings: colleges.map(c =>
        `${c.name}: monthly payment of $${c.monthlyPayment?.toLocaleString() || 0} = ${c.startingSalary ? Math.round((c.monthlyPayment / (c.startingSalary / 12)) * 100) : '?'}% of starting monthly income in ${majorStr}.`
      ),
      wildCard: `${majorStr} salaries vary 40–60% by city — NYC, SF, and Seattle pay far above national averages, and elite school networks open those doors faster.`,
      negotiationTip: 'Send competing offer letters to your top school and ask them directly to match. 67% of students who negotiate receive more aid.',
    });
  }
});

// ============================================
// ROUTE 4: AI Chatbot
// ============================================
app.post('/api/chat', async (req, res) => {
  const { message, history, context } = req.body;

  let ctx = '';
  if (context?.colleges?.length) {
    ctx = `\nStudent comparing ${context.majors?.join(' & ')} at:\n` +
      context.colleges.map(c =>
        `- ${c.name}: Composite ${c.compositeScore}/100, loan $${c.monthlyPayment?.toLocaleString() || 0}/mo, disposable $${c.disposable?.toLocaleString() || 0}/mo after bills`
      ).join('\n') + '\n';
  }

  const systemPrompt = `You are a friendly college financial advisor for ClearPath. Be direct, specific, and conversational. Keep answers to 2-4 sentences unless asked for more. Use dollar amounts when helpful.${ctx}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history || []).slice(-8),
        { role: 'user', content: message },
      ],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ reply: 'Having trouble connecting. Try again in a moment.' });
  }
});

// ============================================
// ROUTE 5: Salary data
// ============================================
app.get('/api/salary/:major', (req, res) => {
  const key = decodeURIComponent(req.params.major);
  const data = salaries[key];
  if (!data) {
    // fuzzy match
    const lower = key.toLowerCase();
    const found = Object.entries(salaries).find(
      ([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())
    );
    if (found) return res.json(found[1]);
    return res.status(404).json({ error: 'Major not found', fallback: { starting: 55000, growthRate: 0.045 } });
  }
  res.json(data);
});

// ============================================
// ROUTE 6: AI Recommend
// ============================================
app.post('/api/recommend', async (req, res) => {
  const { colleges, major, householdIncome, aidPct, profile } = req.body;

  if (!colleges || colleges.length === 0) {
    return res.status(400).json({ error: 'No colleges provided' });
  }

  const sorted = [...colleges].sort((a, b) => b.compositeScore - a.compositeScore);
  const best = sorted[0];

  const collegeList = colleges.map((c, i) =>
    `${i + 1}. ${c.name} (${c.city}, ${c.state}) — Score: ${c.compositeScore}/100, Prestige: ${c.prestigeScore}/100, ROI: $${c.netROI?.toLocaleString()}, Grade: ${c.grade}, Monthly Loan: $${c.monthlyPayment}/mo, DTI: ${c.debtToIncome}%, Disposable: $${c.disposable}/mo, Starting Salary: $${c.startingSalary?.toLocaleString()}, Aid: ${aidPct}%`
  ).join('\n');

  const profileStr = profile
    ? `Student: GPA ${profile.gpa || 'N/A'}, from ${profile.state || 'unknown state'}${profile.firstGen ? ', first-generation student' : ''}`
    : '';

  const prompt = `You are a college financial advisor. A student is comparing colleges for ${major} with household income $${householdIncome?.toLocaleString() || 'unknown'}. ${profileStr}

Options ranked by composite score:
${collegeList}

${best.name} has the highest score. Write a personalized recommendation.

Return ONLY valid raw JSON, no markdown, no backticks:
{"recommendedName":"EXACT college name","headline":"1-2 punchy sentences with specific numbers","whyFinancially":"2-3 sentences with dollar figures on costs, ROI, and monthly payments","whyPersonally":"2 sentences connecting to their major (${major}) and income","incomeInsight":"2 sentences about how their $${householdIncome?.toLocaleString() || 'household'} income and ${aidPct}% aid affects this choice","watchOut":"2 sentences about the biggest financial risk with this recommendation"}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.75,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    let text = completion.choices[0].message.content;
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const result = JSON.parse(jsonMatch[0]);
    if (!colleges.some(c => c.name === result.recommendedName)) result.recommendedName = best.name;
    res.json(result);
  } catch (error) {
    console.error('Recommend error:', error);
    res.json({
      recommendedName: best.name,
      headline: `${best.name} scores highest overall at ${best.compositeScore}/100 — the strongest balance of debt, salary prospects, and long-term ROI.`,
      whyFinancially: `Net 10-year ROI of $${best.netROI?.toLocaleString()}, monthly loan payments of $${best.monthlyPayment}/mo, and a composite score of ${best.compositeScore}/100 make this the best financial outcome in your comparison.`,
      whyPersonally: `For a ${major} student, the salary-to-debt ratio means your starting salary provides solid coverage for your loan obligations.`,
      incomeInsight: `At $${householdIncome?.toLocaleString() || 'your'} household income with an estimated ${aidPct}% aid rate, the net cost is meaningfully lower than the sticker price — compare real award letters before deciding.`,
      watchOut: `These are estimates based on federal averages — your actual aid package may differ. Always compare official offer letters side-by-side.`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ ClearPath server running at http://localhost:${PORT}`);
  console.log(`📊 College Scorecard API: ${process.env.COLLEGE_API_KEY ? 'Connected' : '⚠  MISSING KEY'}`);
  console.log(`🤖 Groq API:             ${process.env.GROQ_API_KEY ? 'Connected' : '⚠  MISSING KEY'}`);
});