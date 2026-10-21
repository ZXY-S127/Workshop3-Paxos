const Proposer = require("../proposer");

const Acceptor = require("../acceptor");

const Learner = require("../learner");

const Simulator = require("../simulator");

console.log("\n====================");

console.log("SCENARIO: PARTIAL ACCEPTANCE");

console.log("====================");

const proposer =new Proposer("P2");

const acceptors = [

    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")

];

const learners = [
    new Learner("L1")
];

/*
 * Simulate:
 *
 * P1 partially succeeded.
 *
 * A1 accepted:
 * (101, instances=10)
 *
 * No majority was reached.
 */

acceptors[0].acceptedProposal = {
    number: 101,
    value: "instances=10"

};

acceptors[0].highestPromised =
    101;

console.log("\nA1 reports:");

console.log("(101, instances=10)");

console.log("\nP2 wants:");

console.log("instances=20");

const simulator = new Simulator(proposer,acceptors,learners);
simulator.run("instances=20");

// console.log("\nLESSON:");
// console.log("A higher-numbered proposer may replace a proposer.");
// console.log("A higher-numbered proposer may not replace a previously accepted value.");