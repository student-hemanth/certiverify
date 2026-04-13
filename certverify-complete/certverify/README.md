# ◈ CertVerify — Blockchain Certificate Verification System

> **OCR-powered. Blockchain-backed. No MetaMask required.**
> Upload a certificate → Tesseract.js extracts name + course → stored on Ganache via Web3.js.

---

## Architecture

```
Browser (React)
   │
   │  POST /ocr      → Tesseract OCR → extract name + course
   │  POST /issue    → store on blockchain
   │  GET  /verify   → read from blockchain
   ▼
Express Backend (Node.js)
   │
   │  Web3.js HTTP provider
   │  accounts[0] signs all transactions (no MetaMask)
   ▼
Ganache (local Ethereum blockchain)
   └── CertificateStore.sol smart contract
```

---

## Folder Structure

```
certverify/
├── contracts/
│   └── CertificateStore.sol    ← Solidity smart contract
├── deploy.js                   ← Compile + deploy (run once)
├── package.json                ← Root deps: solc, web3
│
├── backend/
│   ├── server.js               ← Express + Tesseract OCR + Web3
│   ├── package.json            ← deps: tesseract.js, uuid, web3, multer
│   ├── .env                    ← PORT, GANACHE_URL
│   ├── contract.json           ← Auto-generated after deploy.js
│   └── uploads/                ← Uploaded certificate files
│
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.jsx             ← Router
    │   ├── index.js / index.css
    │   ├── pages/
    │   │   ├── IssuePage.jsx   ← 3-step: Upload → OCR review → Issue
    │   │   ├── VerifyPage.jsx  ← Certificate lookup by ID
    │   │   └── RecordsPage.jsx ← All issued certificates
    │   ├── components/
    │   │   ├── Navbar.jsx      ← Live blockchain status
    │   │   └── UI.jsx          ← Shared components
    │   └── utils/api.js        ← Axios client
    ├── tailwind.config.js
    └── package.json
```

---

## Prerequisites

- **Node.js v18+** — check with `node --version`
- **npm v9+** — check with `npm --version`
- **Ganache** — one of:
  - [Ganache Desktop](https://trufflesuite.com/ganache/) ← recommended for beginners
  - `npm install -g ganache` then `ganache --port 7545`

---

## Step-by-Step Setup

### 1. Start Ganache

**Desktop:** Open → Quickstart Ethereum → confirm port is **7545**

**CLI:**
```bash
ganache --port 7545 --networkId 5777
```

You'll see 10 accounts each with 100 ETH test funds.

---

### 2. Install Root Dependencies + Deploy Contract

```bash
# From the certverify/ root:
npm install

# Compile CertificateStore.sol and deploy to Ganache
node deploy.js
```

Expected output:
```
🔧 Compiling CertificateStore.sol ...
✅ Compiled successfully
🚀 Deploying from account: 0xABC123...
✅ Contract deployed at: 0xDEF456...
📄 ABI + address saved to:
   backend/contract.json
   frontend/src/contract.json
🎉 Deployment complete!
```

---

### 3. Start the Backend

```bash
cd backend
npm install
npm run dev      # nodemon (auto-restart on changes)
# or
npm start        # plain node
```

Expected:
```
🔗 Connecting to Ganache at http://127.0.0.1:7545 ...
✅ Connected. Current block: 1
📜 Contract loaded at: 0xDEF456...
🚀 CertVerify API running at http://localhost:5000
```

---

### 4. Start the Frontend

```bash
# In a NEW terminal:
cd frontend
npm install
npm start
```

Opens at **http://localhost:3000**

---

## How to Use

### Issue a Certificate (3 Steps)

1. Go to **http://localhost:3000** (Issue page)
2. **Step 1 — Upload:** drag & drop a certificate PDF or image
3. Click **"Extract Text with OCR"** — Tesseract reads the file
4. **Step 2 — Review:** see extracted Student Name + Course Name, edit if needed. The `CERT-XXXXXXXX` ID is auto-generated.
5. Click **"Issue to Blockchain"** — transaction is signed by `accounts[0]`
6. **Step 3 — Done:** copy the Certificate ID to verify later

### Verify a Certificate

1. Go to **http://localhost:3000/verify**
2. Paste the Certificate ID (e.g. `CERT-A1B2C3D4`)
3. Click **"Verify Certificate"** — reads directly from smart contract
4. See name, course, and issue date

### View All Records

Go to **http://localhost:3000/records** — lists every certificate ever issued.

---

## API Reference

All routes on `http://localhost:5000`

### `POST /ocr`
Upload a file, get OCR-extracted fields back. Does NOT write to blockchain.

```bash
curl -X POST http://localhost:5000/ocr -F "file=@certificate.png"
```
Response:
```json
{
  "certId": "CERT-A1B2C3D4",
  "studentName": "Alice Sharma",
  "courseName": "Bachelor of Computer Science",
  "rawTextPreview": "..."
}
```

### `POST /issue`
Store certId + name + course on blockchain.

```bash
curl -X POST http://localhost:5000/issue \
  -F "certId=CERT-A1B2C3D4" \
  -F "studentName=Alice Sharma" \
  -F "courseName=Bachelor of Computer Science"
```
Response:
```json
{
  "success": true,
  "certId": "CERT-A1B2C3D4",
  "studentName": "Alice Sharma",
  "courseName": "Bachelor of Computer Science",
  "transactionHash": "0x1234...",
  "blockNumber": 3,
  "issuedBy": "0xABC..."
}
```

### `GET /verify/:id`
Read certificate from blockchain (free, no gas).

```bash
curl http://localhost:5000/verify/CERT-A1B2C3D4
```
Response (found):
```json
{
  "valid": true,
  "certId": "CERT-A1B2C3D4",
  "studentName": "Alice Sharma",
  "courseName": "Bachelor of Computer Science",
  "issuedBy": "0xABC...",
  "issuedAt": "2024-01-01T12:00:00.000Z"
}
```

### `GET /health`
```json
{ "status": "ok", "currentBlock": 4, "totalCertificates": 2 }
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `deploy.js` connection error | Start Ganache first on port 7545 |
| `contract.json not found` | Run `node deploy.js` from root |
| Frontend shows "Backend offline" | Start backend: `cd backend && npm run dev` |
| OCR result is empty / wrong | Edit the fields manually in Step 2 — OCR works best on clean text-based PDFs |
| Tesseract takes 30+ seconds | Normal for first run — it downloads language data. Subsequent runs are faster. |
| Ganache reset (blockchain cleared) | Re-run `node deploy.js` to redeploy contract |

---

## Smart Contract

```solidity
// Issue (costs gas — mined by Ganache)
function issueCertificate(string certId, string studentName, string courseName) external

// Read (free, no gas)
function getCertificate(string certId) external view returns (...)

// Total count
function totalCertificates() external view returns (uint256)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity ^0.8.19 |
| Compiler | solc (npm) |
| Blockchain | Ganache (local) |
| Web3 | Web3.js v4 |
| OCR | Tesseract.js v5 |
| Backend | Node.js + Express |
| File Upload | Multer |
| Cert ID | UUID v4 (`CERT-XXXXXXXX`) |
| Frontend | React 18 + React Router v6 |
| Styling | Tailwind CSS v3 |
| HTTP Client | Axios |

---

MIT License — Portfolio-ready, beginner-friendly.
