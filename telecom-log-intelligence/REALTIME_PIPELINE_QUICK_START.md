# 🚀 Realtime Pipeline - Quick Start Guide

## 🔴 Current Issue

The realtime pipeline is falling back to **polling mode** (change streams unavailable), but **logs that were already inserted won't be detected** because the polling mechanism only catches NEW inserts that happen AFTER it starts listening.

```
Timeline:
  T0:00 - Simulator starts → Inserts 1000 logs  ✗ BEFORE listening
  T0:05 - Pipeline starts → Looks for NEW logs  ✗ None found (all inserted before)
```

## ✅ Fix: Correct Startup Order

### **Step 1: START the realtime pipeline FIRST**
```bash
# Terminal 1: Start the pipeline (it waits for logs)
python -m pipeline.realtime_pipeline

# Output:
# Starting Realtime Pipeline...
# Watching collection: telecom_logs.logs
# Buffered orchestration via RealtimeProcessor: 20 anomalies per run or 5s max wait
# Listening MongoDB Change Stream...
# Change streams unavailable on this MongoDB instance.
# Falling back to polling mode for new inserts...
# [ready to detect logs as they arrive]
```

### **Step 2: THEN run the simulator**
```bash
# Terminal 2: Run the simulator (streams logs into MongoDB)
python -m realtime.log_stream_simulator

# Output:
# ============================================================
#   TelecomAI — Multi-Platform Realtime Simulation
#   ...
# [SMPPC] ▶ Streaming 200 logs from 'smppc_logs'...
# [SMPPC]    1/200 logs streamed
# ...
```

### **Step 3: Watch the pipeline DETECT logs in real-time**
```bash
# Terminal 1 (pipeline) shows:
# [SMSC] Log ObjectId(...): score=0.82, anomaly=False
# [SMSC] Log ObjectId(...): score=1.45, anomaly=True
#   ✓ ANOMALY BUFFERED (1/20) - ID: ObjectId(...)
# [MMG] Log ObjectId(...): score=0.92, anomaly=False
# [MMG] Log ObjectId(...): score=2.10, anomaly=True
#   ✓ ANOMALY BUFFERED (2/20) - ID: ObjectId(...)
# ...
# [SMPPC] Log ObjectId(...): score=1.98, anomaly=True
#   ✓ ANOMALY BUFFERED (20/20) - ID: ObjectId(...)
#   📦 BUFFER FULL FLUSH TRIGGERED (20/20)
#
# ============================================================
# 🔄 FLUSHING BUFFER: 20 anomalies through orchestrator...
# ============================================================
#   ▶ Calling run_orchestrator() with 20 logs...
#   [... orchestrator output ...]
#   ✓ Orchestrator created 5 alert(s)
#     ✓ Updated anomaly ObjectId(...) → incident_id=ObjectId(...), severity=CRITICAL
#     ✓ Updated anomaly ObjectId(...) → incident_id=ObjectId(...), severity=MEDIUM
#     ...
# ✓ Buffer cleared and ready for new anomalies
```

---

## 📊 Expected Flow

### With Correct Order (Pipeline First, Then Simulator)
```
Pipeline listening
  ↓
Simulator starts inserting
  ↓
Polling catches NEW inserts → Sends to processor
  ↓
Processor detects anomalies
  ↓
Anomalies buffered
  ↓
Orchestration triggered
  ↓
Incidents created
  ↓
Anomalies linked to incidents ✓
```

### With Wrong Order (Simulator First, Then Pipeline)
```
Simulator inserts 1000 logs
  ↓
Pipeline starts
  ↓
Polling gets latest ID (log #1000)
  ↓
Looks for logs with _id > #1000 → NONE! ✗
  ↓
Pipeline detects nothing ✗
```

---

## 🔍 Debugging Tips

### Check What's Being Detected
The new verbose output shows for each log:
```
[PLATFORM] Log ObjectId(...): score=X.XX, anomaly=True/False
```

- **score > 1.0** = likely anomaly
- **score with anomaly=True** = detected as anomaly ✓
- **score with anomaly=False** = normal operation ✓

### Check Buffer Status
```
✓ ANOMALY BUFFERED (5/20) - ID: ObjectId(...)
  Means: 5 anomalies in buffer, capacity is 20
  
📦 BUFFER FULL FLUSH TRIGGERED (20/20)
  Means: Buffer is full, orchestration will run
  
⏱️ TIMEOUT FLUSH TRIGGERED (5.2s > 5s), 8 anomalies
  Means: 5 seconds passed with 8 anomalies, flushing anyway
```

### Check Orchestration Results
```
30 seconds of orchestration processing...
✓ Orchestrator created 5 alert(s)
  ✓ Updated anomaly ... → incident_id=..., severity=CRITICAL
  ✓ Updated anomaly ... → incident_id=..., severity=MEDIUM
✓ Buffer cleared and ready for new anomalies
```

### Verify in MongoDB
```javascript
// Check anomalies were created with incident_id
db.anomalies.find().limit(1)

{
  "_id": ObjectId("..."),
  "incident_id": ObjectId("..."),  // ✓ Should be set
  "severity": "CRITICAL",           // ✓ Should be set
  "status": "open",
  "created_at": ISODate("...")
}
```

### Check Dashboard
```bash
curl http://localhost:8000/dashboard/anomalies | jq '.[] | {incident_id,severity,impact}' | head -20
```

Should return:
```json
{
  "incident_id": "ObjectId(...)",
  "severity": "CRITICAL",
  "impact": "HIGH"
}
```

---

## 🛠️ Full Terminal Setup (Recommended)

```bash
# Terminal 1: MongoDB (if running locally)
mongod

# Terminal 2: Ollama (LLM backend)
ollama serve

# Terminal 3: Dashboard API
python -m dashboard.dashboard_api

# Terminal 4: REALTIME PIPELINE (START FIRST!)
python -m pipeline.realtime_pipeline

# Terminal 5: Log Simulator (START SECOND!)
python -m realtime.log_stream_simulator

# Terminal 6: Monitor dashboard
# Keep this open to query the API in real-time
# curl http://localhost:8000/dashboard/anomalies | jq
```

---

## 📈 What Happens During Simulation

### Phase 1: Streaming (First 10-20 seconds)
```bash
[SMSC] ▶  Streaming 200 logs from 'smsc_logs'...
[SMSC]    100/200 logs streamed
[SMSC]    200/200 logs streamed
[SMSC] ✓  Done — 200 logs inserted.
```

### Phase 2: Anomaly Detection (Real-time)
```bash
[SMSC] Log ...: score=0.45, anomaly=False
[SMSC] Log ...: score=1.65, anomaly=True
  ✓ ANOMALY BUFFERED (1/20)
[MMG] Log ...: score=2.10, anomaly=True
  ✓ ANOMALY BUFFERED (2/20)
...
[SMPPC] Log ...: score=1.98, anomaly=True
  ✓ ANOMALY BUFFERED (20/20)
  📦 BUFFER FULL FLUSH TRIGGERED
```

### Phase 3: Orchestration (20-50 seconds)
```bash
============================================================
🔄 FLUSHING BUFFER: 20 anomalies through orchestrator...
============================================================
  ▶ Calling run_orchestrator() with 20 logs...
  [Orchestrator processes logs, creates incidents...]
  ✓ Orchestrator created 5 alert(s)
    ✓ Updated anomaly ... → incident_id=..., severity=CRITICAL
    ✓ Updated anomaly ... → incident_id=..., severity=MEDIUM
    ✓ Updated anomaly ... → incident_id=..., severity=HIGH
    ✓ Updated anomaly ... → incident_id=..., severity=MEDIUM
    ✓ Updated anomaly ... → incident_id=..., severity=CRITICAL
✓ Buffer cleared and ready for new anomalies
```

### Phase 4: Continue Processing
```bash
[DMC] Log ...: score=1.55, anomaly=True
  ✓ ANOMALY BUFFERED (1/20)
[SMPPS] Log ...: score=0.88, anomaly=False
[SMPPS] Log ...: score=1.75, anomaly=True
  ✓ ANOMALY BUFFERED (2/20)
...
```

---

## ✅ Verification Checklist

After running simulator with pipeline listening:

- [ ] Pipeline prints logs being received
- [ ] Anomalies are detected (score > 1.0)
- [ ] Anomalies are buffered
- [ ] Buffer fills to 20
- [ ] Orchestration is triggered
- [ ] Incidents are created
- [ ] Anomalies are updated with incident_id
- [ ] MongoDB anomalies collection has incident_id values
- [ ] Dashboard API returns incident-specific data

---

## 🔧 Configuration

Edit `.env` to customize:

```bash
# Realtime processor settings
REALTIME_BUFFER_SIZE=20                    # Anomalies before orchestration
REALTIME_BUFFER_MAX_WAIT_SECONDS=5         # Timeout before flushing

# MongoDB
MONGO_URI=mongodb://localhost:27017/
DATABASE_NAME=telecom_logs
REALTIME_COLLECTION=logs
```

---

## ⚠️ Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Pipeline detects nothing | Started after simulator | Restart: Pipeline first, then simulator |
| All logs show `anomaly=False` | Model threshold too high | Check AnomalyService threshold settings |
| Buffer never fills | Anomaly rate too low | Check if data has enough anomalies |
| Orchestrator hangs | LLM not ready | Ensure `ollama serve` is running |
| No incidents created | Anomalies below alert threshold | Check alert policy in AlertService |

---

## 📞 Summary

**The Key**: Start pipeline before simulator to catch logs as they're inserted!

```bash
# Correct order:
terminal1$ python -m pipeline.realtime_pipeline
terminal2$ python -m realtime.log_stream_simulator

# Watch Terminal 1 for real-time detection, buffering, and orchestration
```

