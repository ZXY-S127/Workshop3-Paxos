const Proposer = require("../proposer");
const Acceptor = require("../acceptor");
const Learner = require("../learner");
const Simulator = require("../simulator");

console.log("\n====================");
console.log("SCENARIO: HAPPY PATH");
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

const simulator =
    new Simulator(
        proposer,
        acceptors,
        learners
    );

simulator.run(
    "instances=10"
);