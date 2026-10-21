
const Proposer =require("../proposer");
const Acceptor =require("../acceptor");
const Learner =require("../learner");
const Simulator =require("../simulator");

console.log("\n====================");
console.log("SCENARIO: PRESERVING A CHOSEN VALUE");
console.log("====================");

const proposer = new Proposer("P2");

const acceptors = [
    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")

];

const learners = [
    new Learner("L1")
];

/*
 * Earlier consensus round.
 *
 * A majority already accepted:
 *
 * (90, instances=12)
 */

acceptors[0].acceptedProposal = {
    number: 90,
    value: "instances=12"

};

acceptors[1].acceptedProposal = {
    number: 90,
    value: "instances=12"

};

acceptors[2].acceptedProposal = {
    number: 90,
    value: "instances=12"

};

acceptors[0].highestPromised = 90;
acceptors[1].highestPromised = 90;
acceptors[2].highestPromised = 90;

console.log("\nPreviously chosen value:");
console.log("(90, instances=12)");
console.log("\nNew proposer wants:");

console.log("instances=20");

const simulator = new Simulator(proposer,acceptors,learners);
simulator.run("instances=20");

// console.log("\nLESSON:");
// console.log("Previously chosen values must be preserved.");