// Global State
let mediaRecorder;
let recordedChunks = [];
let recognition;
let finalTranscript = "";
let recordedVideoBlob = null;

// Switch Between Promoter Room & Admin Dashboard
function switchView(view) {
  document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tabs button').forEach(el => el.classList.remove('active'));

  if (view === 'promoter') {
    document.getElementById('promoter-view').classList.add('active');
    document.getElementById('tab-promoter-btn').classList.add('active');
  } else {
    document.getElementById('admin-view').classList.add('active');
    document.getElementById('tab-admin-btn').classList.add('active');
    loadAdminDashboard();
  }
}

// -------------------------------------------------------------
// 1. LIVE SPEECH-TO-TEXT & VIDEO RECORDING
// -------------------------------------------------------------
async function startPromoterSession() {
  finalTranscript = "";
  recordedChunks = [];
  const transcriptBox = document.getElementById("live-transcript-box");
  const selectedLang = document.getElementById("stt-language").value;
  transcriptBox.innerHTML = "<em>Listening... Speak your brand pitch now.</em>";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("camera-preview").srcObject = stream;
    document.getElementById("recording-badge").style.display = "block";

    // MediaRecorder for Video Capture
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      recordedVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
    };
    mediaRecorder.start();

    // Web Speech API for Real-Time Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      transcriptBox.innerHTML = "<span style='color:red;'>Real-time STT requires Chrome or Edge browser.</span>";
    } else {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        transcriptBox.innerHTML = `<strong>${finalTranscript}</strong> <span style="color:#777;">${interim}</span>`;
        transcriptBox.scrollTop = transcriptBox.scrollHeight;
      };

      recognition.onerror = (err) => {
        console.warn("STT Error:", err);
      };

      recognition.start();
    }

    document.getElementById("start-record-btn").disabled = true;
    document.getElementById("stop-record-btn").disabled = false;

  } catch (err) {
    alert("Camera/Microphone Permission Error: " + err.message);
  }
}

function stopPromoterSession() {
  if (recognition) recognition.stop();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();

  document.getElementById("recording-badge").style.display = "none";
  const stream = document.getElementById("camera-preview").srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());

  document.getElementById("start-record-btn").disabled = false;
  document.getElementById("stop-record-btn").disabled = true;
}

// -------------------------------------------------------------
// 2. AI EVALUATION & DATABASE STORAGE
// -------------------------------------------------------------
async function submitForAssessment() {
  const apiKey = document.getElementById("gemini-api-key").value.trim();
  const name = document.getElementById("candidate-name").value.trim();
  const store = document.getElementById("store-name").value.trim();
  const masterSpiel = document.getElementById("master-spiel").value.trim();

  if (!apiKey) {
    alert("Please enter a Gemini API Key.");
    return;
  }
  if (!finalTranscript) {
    alert("No speech transcript recorded. Please record your pitch first.");
    return;
  }

  const evalCard = document.getElementById("evaluation-card");
  const evalContent = document.getElementById("eval-content");
  evalCard.style.display = "block";
  evalContent.innerHTML = "<p>⏳ AI evaluating pitch transcript, spiel accuracy, and competencies...</p>";

  const prompt = `
  You are an operations talent assessor evaluating a retail promoter pitch.
  Candidate Name: ${name}
  Target Master Spiel: "${masterSpiel}"
  Candidate Delivered Transcript: "${finalTranscript}"

  Evaluate the candidate and return valid JSON with this exact structure:
  {
    "detected_language": "Hindi/English/etc.",
    "brand_spiel_accuracy_score": 4,
    "communication_score": 4,
    "product_knowledge_score": 5,
    "selling_pitch_score": 4,
    "overall_rating": 4.25,
    "is_reading": false,
    "reading_explanation": "Natural cadence and delivery.",
    "recommendation": "Recommended",
    "strengths": ["Clear pronunciation", "Covered key USP"],
    "improvements": ["Can emphasize the price offer more strongly"]
  }
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const evalData = JSON.parse(data.candidates[0].content.parts[0].text);

    // Render result card
    evalContent.innerHTML = `
      <h4>Overall Verdict: <strong>${evalData.recommendation}</strong> (${evalData.overall_rating} / 5.0)</h4>
      <p><strong>Spiel Accuracy:</strong> ${evalData.brand_spiel_accuracy_score}/5 | <strong>Communication:</strong> ${evalData.communication_score}/5 | <strong>Product Knowledge:</strong> ${evalData.product_knowledge_score}/5</p>
      <p><strong>Anti-Cheating / Gaze Check:</strong> ${evalData.reading_explanation}</p>
    `;

    // Persist to LocalStorage for Admin Dashboard
    const submissionRecord = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      name,
      store,
      transcript: finalTranscript,
      evaluation: evalData,
      status: evalData.recommendation === "Recommended" ? "APPROVED" : "FLAGGED"
    };

    const existing = JSON.parse(localStorage.getItem("itc_promoter_submissions") || "[]");
    existing.unshift(submissionRecord);
    localStorage.setItem("itc_promoter_submissions", JSON.stringify(existing));

    alert("✅ Assessment saved to Operations Admin Dashboard!");

  } catch (err) {
    evalContent.innerHTML = `<span style="color:red;">Evaluation Error: ${err.message}</span>`;
  }
}

// -------------------------------------------------------------
// 3. OPERATIONS ADMIN DASHBOARD
// -------------------------------------------------------------
function loadAdminDashboard() {
  const container = document.getElementById("admin-submissions-list");
  const kpiContainer = document.getElementById("admin-kpi-summary");
  const submissions = JSON.parse(localStorage.getItem("itc_promoter_submissions") || "[]");

  if (submissions.length === 0) {
    kpiContainer.innerHTML = "";
    container.innerHTML = "<p>No promoter submissions found yet. Complete a pitch recording first.</p>";
    return;
  }

  // KPIs
  const total = submissions.length;
  const approved = submissions.filter(s => s.status === "APPROVED").length;
  const flagged = submissions.filter(s => s.status === "FLAGGED").length;

  kpiContainer.innerHTML = `
    <div class="kpi-card"><h4>Total Screened</h4><p>${total}</p></div>
    <div class="kpi-card"><h4>Approved</h4><p style="color:#28a745;">${approved}</p></div>
    <div class="kpi-card"><h4>Flagged for Review</h4><p style="color:#dc3545;">${flagged}</p></div>
  `;

  // Submission Cards
  container.innerHTML = submissions.map(sub => `
    <div class="submission-card ${sub.status.toLowerCase()}">
      <div class="submission-title">
        <strong>${sub.name}</strong> - <span>${sub.store}</span>
        <span class="status-pill ${sub.status.toLowerCase()}">${sub.status}</span>
      </div>
      <div class="sub-meta">Recorded: ${sub.timestamp} | Rating: ${sub.evaluation.overall_rating}/5.0 (${sub.evaluation.recommendation})</div>
      
      <div class="admin-grid-2">
        <div>
          <h5>📜 Stored Real-Time Transcript:</h5>
          <div class="transcript-box-admin">${sub.transcript}</div>
        </div>
        <div>
          <h5>🎯 Competency Breakdown:</h5>
          <ul>
            <li>Brand Spiel Accuracy: ${sub.evaluation.brand_spiel_accuracy_score}/5</li>
            <li>Communication: ${sub.evaluation.communication_score}/5</li>
            <li>Product Knowledge: ${sub.evaluation.product_knowledge_score}/5</li>
            <li>Anti-Reading Check: ${sub.evaluation.reading_explanation}</li>
          </ul>
        </div>
      </div>
    </div>
  `).join("");
}
