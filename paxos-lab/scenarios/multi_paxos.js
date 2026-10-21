
const Proposer = require("../proposer");
const Acceptor = require("../acceptor");
const Learner = require("../learner");
const Simulator = require("../simulator");

console.log("\n====================");
console.log("SCENARIO: MULTI-PAXOS");
console.log("====================");

const proposer = new Proposer("P1");

const acceptors = [
    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")
];

const learners = [
    new Learner("L1")
];

const simulator = new Simulator(proposer,acceptors,learners);

console.log("\nRound 1");

simulator.run("instances=10");

console.log("\nRound 2");

simulator.run("instances=20");

console.log("\nRound 3");

simulator.run("instances=30");

console.log("\nRound 4");

simulator.run("instances=40");

console.log("\nObservation:");

console.log("P1 successfully coordinated every round.");

console.log("Proposal numbers increased:");

console.log("101 -> 102 -> 103 -> 104");

console.log("\nIn Basic Paxos, leaders are not elected.");

console.log("Because P1 repeatedly succeeds,");

console.log("the system naturally converges on P1 as a stable proposer.");

console.log("\nThis behaviour is the intuition behind Multi-Paxos.");