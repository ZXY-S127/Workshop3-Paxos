
const Proposer = require("../proposer");
const Acceptor = require("../acceptor");
const Learner = require("../learner");
const Quorum = require("../quorum");

console.log("\n====================================");
console.log("PART 8: HARDENING PAXOS");
console.log("====================================");

/*
 * HARDENING #1
 * Validate quorum configuration
 */

console.log("\n[Hardening #1]");
console.log("Validating quorum configuration...");

function validateQuorum(totalNodes,quorumSize) {

    const minimum = Math.floor(totalNodes / 2) + 1;

    if (quorumSize < minimum) {
        throw new Error(`Unsafe quorum size: ${quorumSize}`);
    }

    return true;
}

try {
    validateQuorum(5,2);
}
catch (error) {
    console.log("BLOCKED:",error.message);
}

/*
 * HARDENING #2
 * Detect acceptor state loss
 */

console.log("\n[Hardening #2]");
console.log("Checking persistent state...");

const a1 = new Acceptor("A1");

a1.highestPromised = 101;
a1.acceptedProposal = {
    number: 101,
    value: "instances=10"
};

/*
 * Simulate corruption
 */

a1.highestPromised = 0;
a1.acceptedProposal = null;

function checkState(acceptor) {
    if (acceptor.highestPromised === 0 && acceptor.acceptedProposal === null) {
        console.log(`${acceptor.id}: STATE LOSS DETECTED`);
    }
}

checkState(a1);

/*
 * HARDENING #3
 * Majority health check
 */

console.log("\n[Hardening #3]");

const acceptors = [
    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")

];

acceptors[1].fail();
acceptors[2].fail();

function majorityAvailable(acceptors) {

    const online = acceptors.filter(a => a.online).length;
    const quorum =Math.floor(acceptors.length / 2) + 1;

    return online >= quorum;
}

if (!majorityAvailable(acceptors)) {
    console.log("MAJORITY LOST");
    console.log("New proposals disabled");
}

/*
 * HARDENING #4
 * Stable proposer monitoring
 */

console.log("\n[Hardening #4]");

const proposalHistory = [
    { proposer: "P1", number: 101 },
    { proposer: "P2", number: 102 },
    { proposer: "P1", number: 103 },
    { proposer: "P2", number: 104 },
    { proposer: "P1", number: 105 }
];

function detectChurn(history) {
    const distinct = new Set(history.map(entry => entry.proposer));
    return distinct.size > 1;
}

console.log("Proposal activity:");

console.log(proposalHistory);

if (detectChurn(proposalHistory)) {
    console.log("Potential proposer churn detected");
    console.log("Recommend Multi-Paxos leader stabilisation");
}

/*
 * HARDENING #5
 * Audit logging
 */

console.log("\n[Hardening #5]");
console.log("Recording audit log...");

const auditLog = [];
const audit = (event, detail) => auditLog.push({ event, ...detail });

const proposer = new Proposer("P1");

const safeAcceptors = [
    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")
];

const learners = [
    new Learner("L1")
];

const quorum = new Quorum(safeAcceptors.length);

const proposal = proposer.nextProposal("instances=20");
audit("PROPOSAL", { number: proposal.number, value: proposal.value });

const promises = [];
for (const acceptor of safeAcceptors) {
    const response = acceptor.prepare(proposal.number);
    if (response) {
        promises.push(response);
        audit("PROMISE", { acceptor: acceptor.id, number: proposal.number, accepted: response.accepted });
    }
}
audit("QUORUM", { phase: "prepare", count: promises.length, required: quorum.majority() });

const accepted = [];
for (const acceptor of safeAcceptors) {
    const response = acceptor.accept(proposal);
    if (response) {
        accepted.push(response);
        audit("ACCEPTED", { acceptor: acceptor.id, number: proposal.number, value: proposal.value });
    }
}
audit("QUORUM", { phase: "accept", count: accepted.length, required: quorum.majority() });

audit("CHOSEN", { number: proposal.number, value: proposal.value });
for (const learner of learners) {
    learner.learn(proposal.value);
}

console.log("Audit log:");
for (const { event, ...rest } of auditLog) {
    console.log(`  ${event}`, rest);
}

console.log("\nHARDENING COMPLETE");