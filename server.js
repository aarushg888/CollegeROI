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

  // Build a description of each college for the AI
  const collegeDescriptions = colleges.map((c, i) =>
    `College ${i + 1}: ${c.name}
    - Total Cost: $${c.totalCost.toLocaleString()}
    - Starting Salary for ${major}: $${c.startingSalary.toLocaleString()}
    - Net ROI after 10 years: $${c.netROI.toLocaleString()}
    - ROI Grade: ${c.grade}
    - Monthly Loan Payment: $${c.monthlyPayment.toLocaleString()}
    - Break Even Month: ${c.breakEvenMonth}`
  ).join('\n\n');

  const prompt = `You are a brutally honest college financial advisor helping a high school student understand the hidden financial infrastructure behind their college decision.

Here is the ROI data for the colleges they are comparing, for a student studying ${major}:

${collegeDescriptions}

Respond with ONLY a valid JSON object (no extra text, no markdown, no backticks) in this exact format:
{
  "verdict": "2 sentence overall comparison of which college is the best financial choice and why",
  "warnings": ["hidden cost warning specific to college 1", "hidden cost warning specific to college 2", "hidden cost warning specific to college 3"],
  "wildCard": "one surprising factor that could completely change this analysis",
  "funStat": "one shocking fun comparison stat that puts these numbers in perspective"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 1000
    });

    // Get the text response from Groq
    const text = completion.choices[0].message.content;

    // Parse it as JSON
    const insights = JSON.parse(text);
    res.json(insights);

  } catch (error) {
    console.error('AI insights error:', error);
    // If AI fails, send backup response so app still works
    res.json({
      verdict: "Based on the ROI data, focus on the college with the highest net return relative to its cost. Consider your earning potential in " + major + " carefully.",
      warnings: [
        "Watch out for hidden fees like room and board, books, and transportation on top of tuition.",
        "Student loan interest compounds — your actual repayment total will be higher than the loan amount.",
        "Starting salary data is an average — your individual outcome depends heavily on internships and networking."
      ],
      wildCard: "Scholarship opportunities not reflected in sticker price could completely change this comparison — always apply for FAFSA and outside scholarships.",
      funStat: "The average student spends $3,000+ per year on textbooks and supplies — that's $12,000 over 4 years not included in tuition costs!"
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