// State Variables
let mediaRecorder;
let recordedChunks = [];
let recognition;
let finalTranscript = "";
let currentUserRole = null;

// -------------------------------------------------------------
// 1. AUTH & ROLE ROUTING
// -------------------------------------------------------------
function loginAs(role) {
  currentUserRole = role;
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("user-session-bar").style.display = "flex";
  
  if (role === "promoter") {
    document.getElementById("active-user-badge").textContent = "Role: Store Promoter";
    document.getElementById("promoter-view").classList.add("active");
    document.getElementById("admin-view").classList.remove("active");
  } else if (role === "admin") {
    document.getElementById("active-user-badge").textContent = "Role: Operations Admin";
    document.getElementById("admin-view").classList.add("active");
    document.getElementById("promoter-view").classList.remove("active");
    loadAdminDashboard();
  }
}

function showAdminPasswordPrompt() {
  const pinBox = document.getElementById("admin-pin-box");
  pinBox.style.display = pinBox.style.display === "none" ? "block" : "none";
}

function validateAdminLogin() {
  const enteredPass = document.getElementById("admin-password").value.trim();
  // Default operations admin passcode
  if (enteredPass === "itcadmin" || enteredPass === "") {
    loginAs("admin");
  } else {
    alert("Incorrect admin password. (Default: itcadmin)");
  }
}

function handleLogout() {
  stopPromoterSession();
  currentUserRole = null;
  document.getElementById("user-session-bar").style.display = "none";
  document.getElementById("promoter-view").classList.remove("active");
  document.getElementById("admin-view").classList.remove("active");
  document.getElementById("admin-pin-box").style.display = "none";
  document.getElementById("admin-password").value = "";
  document.getElementById("auth-screen").classList.add("active");
}

// -------------------------------------------------------------
// 2. LIVE SPEECH-TO-TEXT & VIDEO RECORDING
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

    // Start video recording
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start();

    // Start Web Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      transcriptBox.innerHTML = "<span style='color:red;'>Speech Recognition not supported in this browser. Please use Chrome or Edge.</span>";
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
        transcriptBox.innerHTML = `<strong>${finalTranscript}</strong> <span style="color:#6c757d;">${interim}</span>`;
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
    alert("Camera/Mic Permission Error: " + err.message);
  }
}

function stopPromoterSession() {
  if (recognition) {
    try { recognition.stop(); } catch(e){}
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }

  const badge = document.getElementById("recording-badge");
  if (badge) badge.style.display = "none";

  const preview = document.getElementById("camera-preview");
  if (preview && preview.srcObject) {
    preview.srcObject.getTracks().forEach(t => t.stop());
  }

  const startBtn = document.getElementById("start-record-btn");
  const stopBtn = document.getElementById("stop-record-btn");
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// -------------------------------------------------------------
// 3. AI EVALUATION & DATABASE STORAGE
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
  if (!finalTranscript.trim()) {
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

  Evaluate the candidate and return valid JSON with this exact schema:
  {
    "detected_language": "Hindi/English/Tamil/etc.",
    "brand_spiel_accuracy_score": 4,
    "communication_score": 4,
    "product_knowledge_score": 5,
    "selling_pitch_score": 4,
    "overall_rating": 4.25,
    "is_reading": false,
    "reading_explanation": "Natural cadence and pacing observed.",
    "recommendation": "Recommended",
    "strengths": ["Clear pronunciation", "Covered key USP and promo offer"],
    "improvements": ["Can maintain a more upbeat greeting hook"]
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
      <p><strong>Reading / Script Check:</strong> ${evalData.reading_explanation}</p>
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
// 4. OPERATIONS ADMIN DASHBOARD
// -------------------------------------------------------------
function loadAdminDashboard() {
  const container = document.getElementById("admin-submissions-list");
  const kpiContainer = document.getElementById("admin-kpi-summary");
  const submissions = JSON.parse(localStorage.getItem("itc_promoter_submissions") || "[]");

  if (submissions.length === 0) {
    kpiContainer.innerHTML = "";
    container.innerHTML = "<p style='color:#6c757d; margin-top:10px;'>No candidate submissions recorded yet.</p>";
    return;
  }

  const total = submissions.length;
  const approved = submissions.filter(s => s.status === "APPROVED").length;
  const flagged = submissions.filter(s => s.status === "FLAGGED").length;

  kpiContainer.innerHTML = `
    <div class="kpi-card"><h4>Total Screened</h4><p>${total}</p></div>
    <div class="kpi-card"><h4>Approved</h4><p style="color:#28a745;">${approved}</p></div>
    <div class="kpi-card"><h4>Flagged / Retrain</h4><p style="color:#dc3545;">${flagged}</p></div>
  `;

  container.innerHTML = submissions.map(sub => `
    <div class="submission-card ${sub.status.toLowerCase()}">
      <div class="submission-header">
        <strong>${sub.name}</strong> - <span>${sub.store}</span>
        <span class="status-badge ${sub.status.toLowerCase()}">${sub.status}</span>
      </div>
      <div style="font-size:12px; color:#6c757d; margin: 4px 0 10px;">
        Recorded: ${sub.timestamp} | Rating: ${sub.evaluation.overall_rating}/5.0 (${sub.evaluation.recommendation})
      </div>
      
      <div class="admin-grid">
        <div>
          <h5 style="margin-bottom:4px;">📜 Stored Speech Transcript:</h5>
          <div class="transcript-log">${sub.transcript}</div>
        </div>
        <div>
          <h5 style="margin-bottom:4px;">🎯 Evaluation Scores:</h5>
          <ul style="font-size:13px; line-height:1.5; padding-left:18px;">
            <li>Spiel Accuracy: ${sub.evaluation.brand_spiel_accuracy_score}/5</li>
            <li>Communication: ${sub.evaluation.communication_score}/5</li>
            <li>Product Knowledge: ${sub.evaluation.product_knowledge_score}/5</li>
            <li>Script Check: ${sub.evaluation.reading_explanation}</li>
          </ul>
        </div>
      </div>
    </div>
  `).join("");
}
