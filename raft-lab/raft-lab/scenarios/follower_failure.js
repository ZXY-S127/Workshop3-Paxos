const Node = require("../node");
const Cluster = require("../cluster");
const Simulator = require("../simulator");
const Network = require("../network");

const a = new Node("A");
const b = new Node("B");
const c = new Node("C");

a.becomeLeader();
c.fail();

const simulator = new Simulator(new Cluster([a, b, c]), new Network());

console.log("\n====================");
console.log("FOLLOWER FAILURE");
console.log("====================");
console.log("\nC is offline");

simulator.replicate("instances=10");
console.log("\nLESSON:");

console.log("Raft tolerates minority failures.");