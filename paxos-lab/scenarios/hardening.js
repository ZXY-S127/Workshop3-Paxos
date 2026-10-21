
const Proposer = require("../proposer");
const Acceptor = require("../acceptor");
const Learner = require("../learner");
const Simulator = require("../simulator");

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
    if (acceptor.highestPromised === 0) {
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
    101,
    102,
    103,
    104,
    105
];

console.log("Proposal activity:");

console.log(proposalHistory);
console.log("Potential proposer churn detected");
console.log("Recommend Multi-Paxos leader stabilisation"
);

/*
 * HARDENING #5
 * Safe deployment example
 */

console.log("\n[Hardening #5]");
console.log("Deploying protected Paxos cluster...");

const proposer = new Proposer("P1");

const safeAcceptors = [
    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")

];

const learners = [
    new Learner("L1")
];

const simulator = new Simulator(proposer,safeAcceptors,learners);
simulator.run("instances=20");
console.log("\nHARDENING COMPLETE");