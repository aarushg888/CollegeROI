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

// ============================================
// ROUTE 1: Search colleges
// ============================================
app.get('/api/search-college', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Please provide a college name' });
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.name=${encodeURIComponent(name)}&fields=id,school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.cost.attendance.academic_year,latest.aid.median_debt.completers.overall,latest.earnings.6_yrs_after_entry.median,latest.earnings.10_yrs_after_entry.median,latest.admissions.admission_rate.overall,latest.student.size&per_page=5&api_key=${process.env.COLLEGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) return res.json([]);
    const colleges = data.results.map(school => ({
      id: school.id,
      name: school['school.name'],
      city: school['school.city'],
      state: school['school.state'],
      tuition: {
        inState: school['latest.cost.tuition.in_state'] || 15000,
        outOfState: school['latest.cost.tuition.out_of_state'] || 30000,
        totalAttendance: school['latest.cost.attendance.academic_year'] || 25000
      },
      medianDebt: school['latest.aid.median_debt.completers.overall'] || 25000,
      earnings: {
        sixYears: school['latest.earnings.6_yrs_after_entry.median'] || 40000,
        tenYears: school['latest.earnings.10_yrs_after_entry.median'] || 50000
      },
      admissionRate: school['latest.admissions.admission_rate.overall'] || null,
      studentSize: school['latest.student.size'] || null
    }));
    res.json(colleges);
  } catch (error) {
    console.error('College search error:', error);
    res.status(500).json({ error: 'Failed to search colleges' });
  }
});

// ============================================
// ROUTE 2: Get one college by ID
// ============================================
app.get('/api/college/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?id=${id}&fields=id,school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.cost.attendance.academic_year,latest.aid.median_debt.completers.overall,latest.earnings.6_yrs_after_entry.median,latest.earnings.10_yrs_after_entry.median,latest.admissions.admission_rate.overall,latest.student.size&api_key=${process.env.COLLEGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.results || data.results.length === 0) return res.status(404).json({ error: 'College not found' });
    const school = data.results[0];
    res.json({
      id: school.id,
      name: school['school.name'],
      city: school['school.city'],
      state: school['school.state'],
      tuition: {
        inState: school['latest.cost.tuition.in_state'] || 15000,
        outOfState: school['latest.cost.tuition.out_of_state'] || 30000,
        totalAttendance: school['latest.cost.attendance.academic_year'] || 25000
      },
      medianDebt: school['latest.aid.median_debt.completers.overall'] || 25000,
      earnings: {
        sixYears: school['latest.earnings.6_yrs_after_entry.median'] || 40000,
        tenYears: school['latest.earnings.10_yrs_after_entry.median'] || 50000
      },
      admissionRate: school['latest.admissions.admission_rate.overall'] || null,
      studentSize: school['latest.student.size'] || null
    });
  } catch (error) {
    console.error('College fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch college' });
  }
});

// ============================================
// ROUTE 3: AI Insights
// ============================================
app.post('/api/ai-insights', async (req, res) => {
  const { colleges, major, householdIncome } = req.body;

  const collegeDescriptions = colleges.map((c, i) => `
College ${i + 1}: ${c.name} (${c.city}, ${c.state})
  - Sticker Cost: $${c.stickerCost?.toLocaleString() || 'N/A'} | Est. Aid: $${c.estimatedAid?.toLocaleString() || 'N/A'} | Out-of-Pocket: $${c.totalCost.toLocaleString()}
  - Starting Salary (${major}): $${c.startingSalary.toLocaleString()} | Net 10-yr ROI: $${c.netROI.toLocaleString()} | Grade: ${c.grade}
  - Monthly Loan: $${c.monthlyPayment}/mo | Total Interest: $${c.totalInterestPaid?.toLocaleString() || 'N/A'}
  - Debt-to-Income: ${c.debtToIncome}% | Disposable After Bills: $${c.disposableIncome}/mo | Wellness: ${c.wellnessScore}/100
  - Admission Rate: ${c.admissionRate ? (c.admissionRate * 100).toFixed(1) + '%' : 'N/A'} | School Size: ${c.studentSize?.toLocaleString() || 'N/A'} students
  - Median Graduate Earnings 6yr: $${c.earningsSixYears?.toLocaleString() || 'N/A'} | 10yr: $${c.earningsTenYears?.toLocaleString() || 'N/A'}
`).join('');

  const funStatSeeds = [
    'Compare the total cost to buying a brand new car or making a down payment on a house',
    'Calculate how many hours at minimum wage it would take to pay off the full debt',
    'Show how compound interest causes the debt to grow over time',
    'Compare the monthly loan payment to everyday subscriptions like Netflix, Spotify, and coffee',
    'Compare the total interest paid to an entire year of starting salary',
    'Calculate how many full work weeks at starting salary are needed just to pay off the debt',
  ];
  const funStatSeed = funStatSeeds[Math.floor(Math.random() * funStatSeeds.length)];

  const prompt = `You are a brutally honest college financial advisor. A student with household income $${householdIncome?.toLocaleString() || 'unknown'} is comparing colleges for ${major}.

${collegeDescriptions}

Rules:
1. Reference each college by its EXACT name and use the ACTUAL numbers given.
2. Every college card must have COMPLETELY DIFFERENT text — no copy-pasting between colleges.
3. ${funStatSeed}

Return ONLY valid raw JSON, no markdown, no backticks:
{"verdict":"3-4 sentences naming specific colleges and numbers explaining the best financial choice","collegeInsights":[{"warning":"2-3 sentences with specific cost/debt numbers for THIS college","hiddenRisk":"2 sentences about a specific risk for THIS college based on location or size","negotiationTip":"2 sentences of actionable advice specific to THIS college","careerNote":"2 sentences using THIS college earnings data for ${major}"}],"wildCard":"3 sentences about a surprising factor that could change the comparison","funStat":"2-3 sentences with a shocking comparison using the actual dollar amounts"}

collegeInsights must have exactly ${colleges.length} objects.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.85,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    let text = completion.choices[0].message.content;
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    const insights = JSON.parse(jsonMatch[0]);
    res.json(insights);
  } catch (error) {
    console.error('AI insights error:', error);
    res.json({
      verdict: `For ${major}, the college with the lowest debt-to-income ratio gives you the most financial breathing room on Day 1 of your career.`,
      collegeInsights: colleges.map(c => ({
        warning: `At ${c.name}, your out-of-pocket cost is $${c.totalCost.toLocaleString()}, leading to $${c.monthlyPayment}/mo in loan payments. Your debt-to-income ratio of ${c.debtToIncome}% is ${c.debtToIncome > 20 ? 'above the recommended 20% — a financial stress risk' : 'within healthy range'}.`,
        hiddenRisk: `${c.name} is in ${c.city}, ${c.state}. Research local rent and living costs — off-campus expenses can silently add $12,000–$18,000 per year on top of tuition.`,
        negotiationTip: `Call ${c.name}'s financial aid office directly and ask for a Professional Judgment Review. If you have competing offers, submit them — schools regularly match or beat rival packages.`,
        careerNote: `${c.name} graduates earn $${c.earningsSixYears?.toLocaleString() || 'N/A'} at the 6-year mark. Check their ${major} alumni network on LinkedIn to verify actual job placement rates.`
      })),
      wildCard: `Location is invisible infrastructure too — a campus near a ${major} industry hub can unlock internships and full-time offers that never appear in ROI calculators but are worth tens of thousands in career acceleration.`,
      funStat: `The total interest on these loans — up to $${Math.max(...colleges.map(c => c.totalInterestPaid || 0)).toLocaleString()} — is pure cost with zero educational value. That money buys nothing except the privilege of borrowing.`
    });
  }
});

// ============================================
// ROUTE 4: AI Chatbot
// ============================================
app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;

  const systemPrompt = `You are a friendly college financial advisor in the ClearPath app. Help high school students understand college costs, ROI, financial aid, student loans, and career salaries. Be conversational and specific. Keep answers to 2-4 sentences. Use dollar amounts when helpful.

${context ? `USER CONTEXT:\n${context}\nUse this to give personalized answers.` : 'The user has not run a comparison yet.'}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
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
  const major = req.params.major;
  const salaryData = salaries[major];
  if (!salaryData) return res.status(404).json({ error: 'Major not found' });
  res.json(salaryData);
});

// ============================================
// ROUTE 6: AI Recommend (NEW)
// ============================================
app.post('/api/recommend', async (req, res) => {
  const { colleges, major, householdIncome, aidPct, profile } = req.body;

  if (!colleges || colleges.length === 0) {
    return res.status(400).json({ error: 'No colleges provided' });
  }

  // Build a ranked summary for the AI
  const sorted = [...colleges].sort((a, b) => b.compositeScore - a.compositeScore);
  const best = sorted[0];

  const collegeList = colleges.map((c, i) =>
    `${i + 1}. ${c.name} (${c.city}, ${c.state}) — Score: ${c.compositeScore}/100, ROI: $${c.netROI.toLocaleString()}, Grade: ${c.grade}, Monthly Loan: $${c.monthlyPayment}/mo, DTI: ${c.debtToIncome}%, Disposable: $${c.disposable}/mo, Salary-to-Debt: ${c.salaryDebtRatio}x, Starting Salary: $${c.startingSalary?.toLocaleString()}, Aid Eligible: ${aidPct}%`
  ).join('\n');

  const profileStr = profile ? `Student: GPA ${profile.gpa || 'N/A'}, ${profile.sat || 'N/A'} test score, from ${profile.state || 'unknown state'}${profile.firstGen ? ', first-generation student' : ''}` : '';

  const prompt = `You are a college financial advisor. A student is comparing colleges for ${major} with household income $${householdIncome?.toLocaleString() || 'unknown'}. ${profileStr}

Here are their options ranked by composite financial score:
${collegeList}

Based on the data, ${best.name} has the highest score. Write a personalized recommendation.

Return ONLY valid raw JSON, no markdown, no backticks:
{
  "recommendedName": "EXACT college name from the list",
  "headline": "1-2 punchy sentences explaining why this is the top pick using specific numbers",
  "whyFinancially": "2-3 sentences with specific dollar figures on costs, ROI, and monthly payments",
  "whyPersonally": "2 sentences connecting this choice to their major (${major}) and income situation",
  "incomeInsight": "2 sentences about how their $${householdIncome?.toLocaleString() || 'household income'} income and ${aidPct}% estimated aid rate affects this choice specifically",
  "watchOut": "2 sentences about the single biggest financial risk or caveat with this recommendation"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.75,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });
    let text = completion.choices[0].message.content;
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const result = JSON.parse(jsonMatch[0]);
    // Validate the recommendedName is actually in the list
    const nameValid = colleges.some(c => c.name === result.recommendedName);
    if (!nameValid) result.recommendedName = best.name;
    res.json(result);
  } catch (error) {
    console.error('Recommend error:', error);
    // Graceful fallback
    res.json({
      recommendedName: best.name,
      headline: `${best.name} scores highest overall — the strongest balance of manageable debt, salary prospects, and long-term ROI in your comparison.`,
      whyFinancially: `With an overall score of ${best.compositeScore}/100, a net 10-year ROI of $${best.netROI.toLocaleString()}, and monthly loan payments of $${best.monthlyPayment}/mo, this delivers the best financial outcome. Total interest paid is lower than your other options, saving you money over the repayment period.`,
      whyPersonally: `For a ${major} student, the salary-to-debt ratio of ${best.salaryDebtRatio}x means your starting salary provides solid coverage for your loan obligations. The debt-to-income ratio of ${best.debtToIncome}% keeps financial stress below the critical 20% threshold.`,
      incomeInsight: `At $${householdIncome?.toLocaleString() || 'your'} household income, your estimated ${aidPct}% aid rate meaningfully reduces what you'll actually pay out of pocket. This makes the sticker price less alarming than it first appears — the net cost is what matters.`,
      watchOut: `These figures are estimates based on federal averages — your actual aid package may differ once you receive official award letters. Always compare real offer letters side-by-side before making a final decision.`
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ ClearPath server running at http://localhost:${PORT}`);
  console.log(`📊 College Scorecard API: ${process.env.COLLEGE_API_KEY ? 'Connected' : '⚠ MISSING KEY'}`);
  console.log(`🤖 Groq API: ${process.env.GROQ_API_KEY ? 'Connected' : '⚠ MISSING KEY'}`);
});