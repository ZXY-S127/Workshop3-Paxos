
const Proposer = require("../proposer");
const Acceptor = require("../acceptor");
const Learner = require("../learner");
const Simulator = require("../simulator");

console.log("\n====================");
console.log("SCENARIO: ACCEPTOR FAILURE");
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

/*
 * Simulate node failure
 */
acceptors[2].fail();
console.log("\nA3 has failed.");

const simulator = new Simulator(proposer,acceptors,learners);
simulator.run("instances=10");

// console.log("\nLESSON:");
// console.log("Consensus requires a majority, not unanimity.");