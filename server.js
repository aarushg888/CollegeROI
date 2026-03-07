// ============================================
// server.js — The brain of CollegeROI
// Handles all API routes and external calls
// ============================================

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const Groq = require('groq-sdk');
const path = require('path');
const salaries = require('./data/salaries.json');

const app = express();
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// This lets our server read JSON from requests
app.use(express.json());

// This serves everything in the /public folder automatically
// So index.html, style.css, and app.js are all available
app.use(express.static(path.join(__dirname, 'public')));


// ============================================
// ROUTE 1: Search for colleges by name
// Example: /api/search-college?name=Harvard
// ============================================
app.get('/api/search-college', async (req, res) => {
  const name = req.query.name;

  // If no name was provided, send an error
  if (!name) {
    return res.status(400).json({ error: 'Please provide a college name' });
  }

  try {
    // Call the College Scorecard API
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?school.name=${encodeURIComponent(name)}&fields=id,school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.cost.attendance.academic_year,latest.aid.median_debt.completers.overall,latest.earnings.6_yrs_after_entry.median,latest.earnings.10_yrs_after_entry.median,latest.admissions.admission_rate.overall,latest.student.size&per_page=5&api_key=${process.env.COLLEGE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    // If no results found
    if (!data.results || data.results.length === 0) {
      return res.json([]);
    }

    // Clean up the data into a nice format
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
// ROUTE 2: Get one specific college by ID
// Example: /api/college/110635
// ============================================
app.get('/api/college/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?id=${id}&fields=id,school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.cost.attendance.academic_year,latest.aid.median_debt.completers.overall,latest.earnings.6_yrs_after_entry.median,latest.earnings.10_yrs_after_entry.median,latest.admissions.admission_rate.overall,latest.student.size&api_key=${process.env.COLLEGE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }

    const school = data.results[0];
    const college = {
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
    };

    res.json(college);

  } catch (error) {
    console.error('College fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch college' });
  }
});


// ============================================
// ROUTE 3: Get AI insights using Groq
// This receives ROI data and returns smart analysis
// ============================================
app.post('/api/ai-insights', async (req, res) => {
  const { colleges, major } = req.body;
  const collegeDescriptions = colleges.map((c, i) =>
    `College ${i + 1}: ${c.name}
    - Total Out-of-Pocket Cost: $${c.totalCost.toLocaleString()}
    - Starting Salary for ${major}: $${c.startingSalary.toLocaleString()}
    - Net ROI after 10 years: $${c.netROI.toLocaleString()}
    - ROI Grade: ${c.grade}
    - Monthly Loan Payment: $${c.monthlyPayment.toLocaleString()}
    - Debt-to-Income Ratio: ${c.debtToIncome}%
    - Monthly Disposable After Loans + Living: $${c.disposableIncome}`
  ).join('\n\n');

  const prompt = `You are a brutally honest college financial advisor. A high school student is comparing colleges for ${major}.

${collegeDescriptions}

Return ONLY a raw JSON object. No markdown, no backticks, no explanation. Exactly this format:
{"verdict":"2 sentence comparison of which is best financially and why","warnings":["specific hidden cost warning for college 1","specific hidden cost warning for college 2","specific hidden cost warning for college 3"],"wildCard":"one factor not in the data that could change everything","funStat":"one shocking real-world comparison that puts these numbers in perspective"}

Make warnings specific to each college name. Keep all values as strings.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 1000
    });
    let text = completion.choices[0].message.content;
    // Strip markdown code blocks if Groq added them
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Extract just the JSON object if there's extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    const insights = JSON.parse(jsonMatch[0]);
    res.json(insights);
  } catch (error) {
    console.error('AI insights error:', error);
    res.json({
      verdict: `For ${major}, compare the debt-to-income ratio carefully — this determines your financial stress level for the entire first decade of your career.`,
      warnings: colleges.map(c => `At ${c.name}, watch for hidden costs like mandatory fees, room & board, and textbooks adding $15,000–$20,000/year beyond tuition.`),
      wildCard: "Scholarship opportunities and employer tuition reimbursement programs could completely change this comparison — always negotiate your financial aid package.",
      funStat: "The average student spends $1,240/year on textbooks alone — publishers release new editions every 3 years specifically to prevent resale of older copies."
    });
  }
});


// ============================================
// ROUTE 4: Get salary data for a major
// Example: /api/salary/Computer Science
// ============================================
app.get('/api/salary/:major', (req, res) => {
  const major = req.params.major;
  const salaryData = salaries[major];

  if (!salaryData) {
    return res.status(404).json({ error: 'Major not found' });
  }

  res.json(salaryData);
});


// ============================================
// Start the server
// ============================================
app.listen(PORT, () => {
  console.log(`✅ CollegeROI server running at http://localhost:${PORT}`);
  console.log(`📊 College Scorecard API: ${process.env.COLLEGE_API_KEY ? 'Connected' : 'MISSING KEY'}`);
  console.log(`🤖 Groq AI API: ${process.env.GROQ_API_KEY ? 'Connected' : 'MISSING KEY'}`);
});