// Video file preview handler
const videoInput = document.getElementById('video-input');
const videoPlayer = document.getElementById('video-player');
const videoPlaceholder = document.getElementById('video-placeholder');

let selectedVideoBase64 = null;
let selectedVideoType = null;

videoInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    selectedVideoType = file.type || 'video/mp4';
    const fileURL = URL.createObjectURL(file);
    videoPlayer.src = fileURL;
    videoPlayer.style.display = 'block';
    videoPlaceholder.style.display = 'none';

    // Convert to base64 for Gemini API submission
    const reader = new FileReader();
    reader.onload = function(evt) {
      selectedVideoBase64 = evt.target.result.split(',')[1];
    };
    reader.readAsDataURL(file);
  } else {
    videoPlayer.style.display = 'none';
    videoPlaceholder.style.display = 'block';
    selectedVideoBase64 = null;
  }
});

// Run AI Screening Pipeline
async function runAIScreening() {
  const apiKey = document.getElementById('gemini-api-key').value.trim();
  const name = document.getElementById('candidate-name').value.trim();
  const store = document.getElementById('store-location').value.trim();
  const masterSpiel = document.getElementById('master-spiel').value.trim();
  const questions = document.getElementById('interview-questions').value.trim();

  if (!apiKey) {
    alert('Please enter your Gemini API Key.');
    return;
  }
  if (!selectedVideoBase64) {
    alert('Please select and upload a video recording first.');
    return;
  }

  const resultCard = document.getElementById('result-card');
  const resultBody = document.getElementById('result-body');
  const verdictPill = document.getElementById('verdict-pill');

  resultCard.style.display = 'block';
  verdictPill.textContent = 'Evaluating...';
  verdictPill.className = 'badge-verdict';
  resultBody.innerHTML = '<p style="color:#64748b; text-align:center; padding: 20px;">⏳ Analyzing candidate video, brand spiel delivery, eye-gaze posture, and competency scores...</p>';

  const prompt = `
  You are an expert operations talent assessor evaluating a retail promoter candidate for modern trade stores in India (Reliance, Lulu, etc.).

  Promoter Name: ${name}
  Store Location: ${store}
  Master Brand Spiel Reference: "${masterSpiel}"
  Pre-defined Questions to Check: "${questions}"

  Evaluate the video submission across:
  1. Candidate Profile: Extract Age, Years of Experience, Past Brands.
  2. Anti-Cheating / Gaze Check: Detect if promoter is reading from a paper/screen or delivering naturally from memory.
  3. Brand Spiel Delivery: Check accuracy against master spiel across regional languages (Hindi, Tamil, Telugu, English, etc.).
  4. Product Knowledge & Pitching: Rate on a 1 to 5 scale.

  Return ONLY valid JSON matching this schema:
  {
    "candidate": {
      "name": "${name}",
      "age": "Age or approximate",
      "experience": "Years of experience",
      "past_brands": ["brand1", "brand2"]
    },
    "detected_language": "Hindi / English / etc.",
    "brand_spiel_accuracy_score": 4,
    "communication_score": 4,
    "product_knowledge_score": 5,
    "selling_pitch_score": 4,
    "overall_rating": 4.25,
    "is_reading": false,
    "reading_explanation": "Natural eye contact maintained.",
    "recommendation": "Recommended",
    "strengths": ["Clear voice", "Accurate promo recall"],
    "areas_of_improvement": ["Can improve greeting confidence"],
    "summary": "Brief summary of performance"
  }
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: selectedVideoType,
                  data: selectedVideoBase64
                }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const evalData = JSON.parse(data.candidates[0].content.parts[0].text);

    // Update Verdict Pill
    const rec = evalData.recommendation || 'Recommended';
    verdictPill.textContent = `${rec} (${evalData.overall_rating}/5.0)`;
    if (rec.toLowerCase().includes('recommend')) {
      verdictPill.className = 'badge-verdict recommended';
    } else if (rec.toLowerCase().includes('retrain')) {
      verdictPill.className = 'badge-verdict retrain';
    } else {
      verdictPill.className = 'badge-verdict rejected';
    }

    // Render Clean Assessment Dashboard
    resultBody.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-stat">
          <span>Brand Spiel Accuracy</span>
          <strong>${evalData.brand_spiel_accuracy_score} / 5</strong>
        </div>
        <div class="kpi-stat">
          <span>Communication</span>
          <strong>${evalData.communication_score} / 5</strong>
        </div>
        <div class="kpi-stat">
          <span>Product Knowledge</span>
          <strong>${evalData.product_knowledge_score} / 5</strong>
        </div>
        <div class="kpi-stat">
          <span>Selling Pitch</span>
          <strong>${evalData.selling_pitch_score} / 5</strong>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <h4 style="font-size:13px; color:#002e6e; margin-bottom:6px;">Candidate Profile</h4>
          <p style="font-size:13px; line-height:1.6;">
            <strong>Language:</strong> ${evalData.detected_language}<br>
            <strong>Experience:</strong> ${evalData.candidate.experience || 'N/A'}<br>
            <strong>Past Brands:</strong> ${(evalData.candidate.past_brands || []).join(', ') || 'N/A'}
          </p>

          <h4 style="font-size:13px; color:#002e6e; margin:10px 0 4px;">Anti-Cheating / Gaze Verification</h4>
          <p style="font-size:13px; color:${evalData.is_reading ? '#dc2626' : '#16a34a'};">
            ${evalData.is_reading ? '⚠️ Flagged for reading off screen/notes' : '✅ Natural memory delivery'}: ${evalData.reading_explanation}
          </p>
        </div>

        <div>
          <h4 style="font-size:13px; color:#002e6e; margin-bottom:6px;">Strengths</h4>
          <ul style="font-size:13px; padding-left:18px; line-height:1.5;">
            ${(evalData.strengths || []).map(s => `<li>${s}</li>`).join('')}
          </ul>

          <h4 style="font-size:13px; color:#002e6e; margin:10px 0 4px;">Areas for Improvement</h4>
          <ul style="font-size:13px; padding-left:18px; line-height:1.5;">
            ${(evalData.areas_of_improvement || []).map(i => `<li>${i}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

  } catch (err) {
    resultBody.innerHTML = `<p style="color:#dc2626; padding:10px;">Evaluation Error: ${err.message}</p>`;
  }
}
