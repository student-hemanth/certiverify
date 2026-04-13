/**
 * CertVerify — server.js
 * ──────────────────────
 * Express + Web3.js + Tesseract.js OCR
 * No MetaMask — all transactions signed server-side via Ganache accounts.
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const { Web3 }  = require("web3");
const fs        = require("fs");
const path      = require("path");
const multer    = require("multer");
const Tesseract = require("tesseract.js");
const { v4: uuidv4 } = require("uuid");

// ─── App Init ─────────────────────────────────────────────────────
const app         = express();
const PORT        = process.env.PORT || 5000;
const GANACHE_URL = process.env.GANACHE_URL || "http://127.0.0.1:7545";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Multer ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF / PNG / JPEG allowed"));
  },
});

// ─── OCR Helper ───────────────────────────────────────────────────
/**
 * extractFromText()
 * Given raw OCR text, attempt to detect Student Name and Course Name
 * using common certificate label patterns.
 */
function extractFromText(rawText) {
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let studentName = "";
  let courseName  = "";

  // Patterns to search for (case-insensitive)
  const namePatterns   = [/student\s*name[:\s]+(.+)/i, /awarded\s+to[:\s]+(.+)/i, /presented\s+to[:\s]+(.+)/i, /this\s+is\s+to\s+certify\s+that\s+(.+)/i, /name[:\s]+(.+)/i];
  const coursePatterns = [/course[:\s]+(.+)/i, /program(?:me)?[:\s]+(.+)/i, /completed[:\s]+(.+)/i, /in[:\s]+(.+)/i, /subject[:\s]+(.+)/i, /for[:\s]+(.+)/i];

  for (const line of lines) {
    if (!studentName) {
      for (const pattern of namePatterns) {
        const m = line.match(pattern);
        if (m && m[1].trim().length > 1) {
          studentName = m[1].trim().replace(/[^a-zA-Z\s.'-]/g, "").trim();
          break;
        }
      }
    }
    if (!courseName) {
      for (const pattern of coursePatterns) {
        const m = line.match(pattern);
        if (m && m[1].trim().length > 2) {
          courseName = m[1].trim().replace(/[^a-zA-Z0-9\s.,'&()-]/g, "").trim();
          break;
        }
      }
    }
    if (studentName && courseName) break;
  }

  return { studentName, courseName, rawText };
}

// ─── Blockchain Init ──────────────────────────────────────────────
let web3, contractInstance, accounts;

async function initBlockchain() {
  console.log(`\n🔗 Connecting to Ganache at ${GANACHE_URL} ...`);
  web3 = new Web3(new Web3.providers.HttpProvider(GANACHE_URL));

  const blockNumber = await web3.eth.getBlockNumber();
  console.log(`✅ Connected. Current block: ${blockNumber}`);

  accounts = await web3.eth.getAccounts();
  console.log(`👛 Accounts loaded: ${accounts.length}`);
  console.log(`   Issuer: ${accounts[0]}`);

  const contractFile = path.join(__dirname, "contract.json");
  if (!fs.existsSync(contractFile)) {
    console.error("❌ contract.json not found — run: node deploy.js");
    process.exit(1);
  }

  const { abi, address } = JSON.parse(fs.readFileSync(contractFile, "utf8"));
  contractInstance = new web3.eth.Contract(abi, address);
  console.log(`📜 Contract loaded at: ${address}\n`);
}

async function getGasParams(method, from) {
  const gasPrice = await web3.eth.getGasPrice();
  const gas      = await method.estimateGas({ from });
  return {
    gas:      Math.ceil(Number(gas) * 1.3).toString(),
    gasPrice: gasPrice.toString(),
  };
}

// ─── Routes ───────────────────────────────────────────────────────

/**
 * GET /health
 */
app.get("/health", async (req, res) => {
  try {
    const block = await web3.eth.getBlockNumber();
    const total = await contractInstance.methods.totalCertificates().call();
    res.json({
      status:            "ok",
      ganache:           GANACHE_URL,
      currentBlock:      Number(block),
      totalCertificates: Number(total),
      issuerAccount:     accounts[0],
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

/**
 * POST /ocr
 * Accepts a file upload and returns extracted name + course via Tesseract OCR.
 * Does NOT issue to blockchain — preview step only.
 */
app.post("/ocr", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  console.log(`\n🔬 Running OCR on: ${req.file.originalname}`);

  try {
    // Tesseract can handle PNG/JPG directly. For PDFs it uses the first page.
    const { data } = await Tesseract.recognize(filePath, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          process.stdout.write(`   OCR progress: ${Math.round(m.progress * 100)}%\r`);
        }
      },
    });

    console.log("\n   OCR complete.");

    const { studentName, courseName, rawText } = extractFromText(data.text);

    console.log(`   Detected name:   "${studentName || "(not found)"}"`);
    console.log(`   Detected course: "${courseName  || "(not found)"}"`);

    // Generate cert ID preview
    const shortId = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
    const certId  = `CERT-${shortId}`;

    res.json({
      success:     true,
      certId,
      studentName: studentName || "",
      courseName:  courseName  || "",
      rawTextPreview: rawText.substring(0, 400),
      filename:    req.file.filename,
      originalName: req.file.originalname,
    });
  } catch (err) {
    console.error("❌ OCR error:", err.message);
    // Clean up temp file on error
    try { fs.unlinkSync(filePath); } catch (_) {}
    res.status(500).json({ error: `OCR failed: ${err.message}` });
  }
});

/**
 * POST /issue
 * Issues certificate to blockchain.
 * Body (multipart/form-data):
 *   certId      — pre-generated (from /ocr) or auto-generated here
 *   studentName — required
 *   courseName  — required
 *   filename    — optional filename reference from prior /ocr call
 */
app.post("/issue", upload.single("file"), async (req, res) => {
  try {
    let { certId, studentName, courseName, filename } = req.body;

    if (!studentName || !courseName) {
      return res.status(400).json({ error: "studentName and courseName are required" });
    }

    // Auto-generate cert ID if not provided
    if (!certId || !certId.startsWith("CERT-")) {
      const shortId = uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase();
      certId = `CERT-${shortId}`;
    }

    // If a new file was uploaded here (not via /ocr), store it
    if (req.file) {
      filename = req.file.filename;
    }

    const issuer = accounts[0];
    const method = contractInstance.methods.issueCertificate(
      certId,
      studentName.trim(),
      courseName.trim()
    );

    console.log(`\n📝 Issuing certificate...`);
    console.log(`   Cert ID: ${certId}`);
    console.log(`   Student: ${studentName}`);
    console.log(`   Course:  ${courseName}`);
    console.log(`   From:    ${issuer}`);

    const { gas, gasPrice } = await getGasParams(method, issuer);
    const tx = await method.send({ from: issuer, gas, gasPrice });

    console.log(`✅ TX confirmed: ${tx.transactionHash}`);

    res.status(201).json({
      success:         true,
      certId,
      studentName:     studentName.trim(),
      courseName:      courseName.trim(),
      filename:        filename || null,
      fileUrl:         filename ? `/uploads/${filename}` : null,
      transactionHash: tx.transactionHash,
      blockNumber:     Number(tx.blockNumber),
      gasUsed:         Number(tx.gasUsed),
      issuedBy:        issuer,
      issuedAt:        new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Issue error:", err.message);
    // Friendly duplicate error
    if (err.message.includes("certId already exists")) {
      return res.status(409).json({ error: "A certificate with this ID already exists on the blockchain." });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /verify/:id
 * Read certificate from blockchain — no gas.
 */
app.get("/verify/:id", async (req, res) => {
  try {
    const certId = req.params.id.trim();
    console.log(`\n🔍 Verifying: ${certId}`);

    const result = await contractInstance.methods.getCertificate(certId).call();

    if (!result.exists) {
      return res.status(404).json({
        valid: false,
        error: `Certificate "${certId}" not found on blockchain`,
      });
    }

    console.log(`✅ Found: ${result.studentName} / ${result.courseName}`);

    res.json({
      valid:       true,
      certId:      result.certId,
      studentName: result.studentName,
      courseName:  result.courseName,
      issuedBy:    result.issuedBy,
      issuedAt:    new Date(Number(result.issuedAt) * 1000).toISOString(),
    });
  } catch (err) {
    console.error("❌ Verify error:", err.message);
    res.status(500).json({ valid: false, error: err.message });
  }
});

/**
 * GET /certificates?offset=0&limit=20
 */
app.get("/certificates", async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit  = parseInt(req.query.limit)  || 20;
    const total  = await contractInstance.methods.totalCertificates().call();
    const ids    = await contractInstance.methods.getCertIds(offset, limit).call();
    res.json({ total: Number(total), offset, limit, ids: [...ids] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /accounts  (debug)
 */
app.get("/accounts", async (req, res) => {
  try {
    const balances = await Promise.all(
      accounts.slice(0, 5).map(async (acc) => {
        const bal = await web3.eth.getBalance(acc);
        return { address: acc, balance: parseFloat(web3.utils.fromWei(bal, "ether")).toFixed(4) + " ETH" };
      })
    );
    res.json({ accounts: balances });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Error handlers ───────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, _next) => {
  console.error("💥", err.message);
  res.status(500).json({ error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────
initBlockchain()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 CertVerify API running at http://localhost:${PORT}`);
      console.log(`   POST /ocr        ← upload file, get OCR results`);
      console.log(`   POST /issue      ← store certId+name+course on blockchain`);
      console.log(`   GET  /verify/:id ← read certificate from blockchain`);
      console.log(`   GET  /health     ← status check`);
    });
  })
  .catch((err) => {
    console.error("❌ Init failed:", err.message);
    process.exit(1);
  });
