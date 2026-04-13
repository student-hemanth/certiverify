/**
 * deploy.js
 * ─────────
 * Compiles CertificateStore.sol with solc and deploys it to Ganache.
 *
 * Run:  node deploy.js
 * Prereq: Ganache must be running on http://127.0.0.1:7545
 */

const { Web3 } = require("web3");
const solc     = require("solc");
const fs       = require("fs");
const path     = require("path");

const GANACHE_URL = "http://127.0.0.1:7545";

// ─── Read source ──────────────────────────────────────────────────
const contractPath = path.join(__dirname, "contracts", "CertificateStore.sol");
const source       = fs.readFileSync(contractPath, "utf8");

// ─── Compile ──────────────────────────────────────────────────────
console.log("🔧 Compiling CertificateStore.sol ...");

const input = {
  language: "Solidity",
  sources: { "CertificateStore.sol": { content: source } },
  settings: {
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    optimizer: { enabled: true, runs: 200 },
  },
};

const compiled = JSON.parse(solc.compile(JSON.stringify(input)));

if (compiled.errors) {
  const errs = compiled.errors.filter((e) => e.severity === "error");
  if (errs.length) {
    errs.forEach((e) => console.error("❌", e.formattedMessage));
    process.exit(1);
  }
}

const contract  = compiled.contracts["CertificateStore.sol"]["CertificateStore"];
const abi       = contract.abi;
const bytecode  = "0x" + contract.evm.bytecode.object;

console.log("✅ Compiled successfully");

// ─── Deploy ───────────────────────────────────────────────────────
async function deploy() {
  const web3     = new Web3(GANACHE_URL);
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];

  console.log(`\n🚀 Deploying from account: ${deployer}`);

  const deployContract = new web3.eth.Contract(abi);
  const deployTx       = deployContract.deploy({ data: bytecode });

  const gas      = await deployTx.estimateGas({ from: deployer });
  const gasPrice = await web3.eth.getGasPrice();

  const deployed = await deployTx.send({
    from: deployer,
    gas:  Math.ceil(Number(gas) * 1.2).toString(),
    gasPrice: gasPrice.toString(),
  });

  const address = deployed.options.address;
  console.log(`✅ Contract deployed at: ${address}`);

  // ─── Save ABI + address for backend & frontend ─────────────────
  const info = { address, abi, deployedBy: deployer, network: GANACHE_URL, deployedAt: new Date().toISOString() };

  fs.writeFileSync(path.join(__dirname, "backend", "contract.json"),  JSON.stringify(info, null, 2));
  fs.writeFileSync(path.join(__dirname, "frontend", "src", "contract.json"), JSON.stringify({ address, abi }, null, 2));

  console.log("\n📄 ABI + address saved to:");
  console.log("   backend/contract.json");
  console.log("   frontend/src/contract.json");
  console.log("\n🎉 Deployment complete!");
  console.log("   Next → cd backend && npm run dev");
  console.log("         cd frontend && npm start");
}

deploy().catch((err) => {
  console.error("❌ Deployment failed:", err.message);
  console.error("   → Is Ganache running on port 7545?");
  process.exit(1);
});
