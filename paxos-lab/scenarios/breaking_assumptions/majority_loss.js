
const Proposer = require("../../proposer");
const Acceptor = require("../../acceptor");
const Learner = require("../../learner");

const Simulator = require("../../simulator");

const proposer =new Proposer("P1");

const acceptors = [
    new Acceptor("A1"),
    new Acceptor("A2"),
    new Acceptor("A3")
];

const learners = [
    new Learner("L1")
];

/*
 * Break the majority
 */

acceptors[1].fail();
acceptors[2].fail();

const simulator = new Simulator(proposer,acceptors,learners);
console.log("\n====================");
console.log("SCENARIO: LOSS OF MAJORITY");
console.log("====================");
simulator.run("instances=10");