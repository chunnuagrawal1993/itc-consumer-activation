# Promoter Pulse prototype

This is a working front-end prototype for the daily promoter assessment and operations dashboard. It uses browser `localStorage`, the browser camera/microphone and simulated scoring; it does not send WhatsApp messages, retain video on a server, or perform production AI scoring.

The prototype uses ITC branding and logo. Demo login: username `itcadmin`, password `ITC@2026`. Authentication is browser-session only and is not suitable for production.

Before the daily recording, the promoter selects an ITC brand and one of 10 languages: Hindi, English, Marathi, Telugu, Tamil, Kannada, Gujarati, Odia, Bengali or Assamese. The five questions are localized and dynamically use the selected brand name.

## Recording and score basis

After submission, the prototype shows the recorded video back to the promoter. When browser speech recognition is available, it captures a transcript and produces a transparent score out of 100:

- Brand spiel delivery: 30 points — brand mention, relevant product keywords and sufficient spiel content
- Product knowledge: 25 points — matches against the selected brand's product rubric
- Selling/pitching: 20 points — customer, benefit, value, price and recommendation language, plus an objection response
- Communication: 15 points — recognised word count as a basic fluency/completeness proxy
- Completion: 10 points — all five questions in one continuous take

The on-screen scorecard displays the evidence behind every component. Browser speech recognition differs by device and language; when no transcript is captured, the prototype awards only completion and explicitly flags the recording for human review. Production scoring needs secure storage, multilingual transcription, an ITC-approved answer key, and calibration against human recruiters.

## Run locally

From this folder, run:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Use the **Daily check-in** tab for the promoter flow and **Operations admin** for the monitoring and replacement workflow. Camera/mic recording requires `localhost`/HTTPS and browser permission.

The configured default window is 10:00–21:00. Change it in Operations admin if testing outside that time. The **Reset demo data** action restores the sample records.

## Production work still required

- Authenticated WhatsApp delivery and personal signed links
- Secure backend, encrypted object storage and consent/retention controls
- Real-time/queued video upload and resume handling
- Speech-to-text, multilingual question presenter, answer-key evaluation and human review dashboard
- Liveness/anti-fraud controls, audit trails and role-based access
