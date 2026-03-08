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
      inState:    school['latest.cost.tuition.in_state']    || 12000,
      outOfState: school['latest.cost.tuition.out_of_state'] || 28000,
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
    graduationRate: school['latest.completion.rate_suppressed.overall']             || null,
    retentionRate:  school['latest.student.retention_rate.four_year.full_time']     || null,
    repaymentRate:  school['latest.repayment.3_yr_repayment.overall']               || null,
    admissionRate:  school['latest.admissions.admission_rate.overall']              || null,
    studentSize:    school['latest.student.size']                                   || null,
    medianStudentIncome: school['latest.student.demographics.median_hh_income']     || null,
  };
}

app.get('/api/search-college', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Need a name' });
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.name=${encodeURIComponent(name)}&fields=${SCORECARD_FIELDS}&per_page=5&api_key=${process.env.COLLEGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results?.length) return res.json([]);
    res.json(data.results.map(mapSchool));
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/college/:id', async (req, res) => {
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?id=${req.params.id}&fields=${SCORECARD_FIELDS}&api_key=${process.env.COLLEGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results?.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapSchool(data.results[0]));
  } catch (err) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

app.post('/api/ai-insights', async (req, res) => {
  const { colleges, majors } = req.body;
  const majorStr = Array.isArray(majors) ? majors.join(' & ') : majors;

  const collegeDescriptions = colleges.map((c) =>
    `${c.name} (${c.city}, ${c.state}):
    - Prestige Score: ${c.prestigeScore}/100
    - Financial Score: ${c.score}/100 (${c.scoreLabel})
    - COMPOSITE Score: ${c.compositeScore}/100
    - Net cost after aid: $${c.netCost.toLocaleString()} total
    - Monthly loan payment: $${c.monthlyPayment.toLocaleString()}/month (${c.loanAmount === 0 ? 'NO LOANS NEEDED' : '$' + c.loanAmount.toLocaleString() + ' borrowed'})
    - Starting salary (${majorStr}): $${c.startingSalary.toLocaleString()}/year
    - Graduation rate: ${c.graduationRate ? Math.round(c.graduationRate * 100) + '%' : 'N/A'}
    - Admission rate: ${c.admissionRate ? Math.round(c.admissionRate * 100) + '%' : 'N/A'}
    - Government-verified 10-yr earnings: ${c.govEarnings10yr ? '$' + c.govEarnings10yr.toLocaleString() : 'N/A'}
    - Money left over per month: $${c.disposable.toLocaleString()}`
  ).join('\n\n');

  const prompt = `You are a direct, honest college financial advisor. A student is comparing colleges for ${majorStr}.

DATA:
${collegeDescriptions}

NOTE: The composite score balances BOTH financial ROI AND prestige/rigor. A community college won't score highest even with great ROI because prestige, network, and graduation rates matter for career outcomes.

Give SPECIFIC advice using ACTUAL numbers and ACTUAL college names. Be direct — this is a teenager making a major life decision.

Return ONLY raw JSON (no backticks):
{
  "verdict": "2-3 direct sentences comparing these colleges by name. Reference composite scores and key financial differences. Explain WHY a higher-prestige school might justify higher cost for this major.",
  "warnings": [${colleges.map(c => `"specific insight for ${c.name}: mention salary trajectory, network value, or financial risk with real numbers"`).join(', ')}],
  "wildCard": "one surprising career factor about ${majorStr} that most students don't consider when picking schools",
  "negotiationTip": "one specific financial aid negotiation tactic relevant to these schools"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.8,
      max_tokens: 1000
    });
    let text = completion.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('AI error:', err);
    res.json({
      verdict: `The composite score balances financial ROI and institutional quality. Higher-scoring schools offer better career networks and salary trajectories for ${majorStr} beyond what raw ROI shows.`,
      warnings: colleges.map(c => `${c.name}: monthly payment of $${c.monthlyPayment.toLocaleString()} represents ${Math.round((c.monthlyPayment / (c.startingSalary / 12)) * 100)}% of starting monthly income in ${majorStr}.`),
      wildCard: `${majorStr} salaries vary 40-60% by city — NYC, SF, and Seattle pay far above national averages, and elite school networks open those doors faster.`,
      negotiationTip: 'Send competing offer letters to your top school and ask them directly to match. 67% of students who negotiate receive more aid.'
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, history, context } = req.body;
  let ctx = '';
  if (context?.colleges?.length) {
    ctx = `\nStudent comparing ${context.majors?.join(' & ')} at:\n` +
      context.colleges.map(c => `- ${c.name}: Composite ${c.compositeScore}/100, loan $${c.monthlyPayment.toLocaleString()}/mo, disposable $${c.disposable.toLocaleString()}/mo after bills`).join('\n') + '\n';
  }
  const systemPrompt = `You are a friendly college financial advisor for ClearPath. Be direct, specific, conversational. 2-4 sentences max unless asked for more. Use real numbers from context when available.${ctx}`;
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history || []).slice(-8),
        { role: 'user', content: message }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 400
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    res.json({ reply: "Connection issue — try again in a moment!" });
  }
});

app.get('/api/salary/:major', (req, res) => {
  const key = decodeURIComponent(req.params.major);
  const data = salaries[key];
  if (!data) {
    const lower = key.toLowerCase();
    const found = Object.entries(salaries).find(([k]) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
    if (found) return res.json(found[1]);
    return res.status(404).json({ error: 'Major not found', fallback: { starting: 55000, growthRate: 0.045 } });
  }
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`ClearPath → http://localhost:${PORT}`);
  console.log(` Scorecard API: ${process.env.COLLEGE_API_KEY ? 'RUNNING' : 'MISSING'}`);
  console.log(` Groq API:      ${process.env.GROQ_API_KEY ? 'RUNNING' : 'MISSING'}`);
});