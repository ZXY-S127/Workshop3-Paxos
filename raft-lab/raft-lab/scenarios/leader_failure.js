const Node = require("../node");
const Cluster = require("../cluster");
const Simulator = require("../simulator");
const Network = require("../network");

const a = new Node("A");
const b = new Node("B");
const c = new Node("C");

b.becomeLeader();

const cluster = new Cluster([a, b, c]);

const simulator = new Simulator(cluster, new Network());
console.log("\n====================");
console.log("LEADER FAILURE");
console.log("====================");
console.log("\nLeader B fails");

b.fail();

console.log("\nElection timeout");
simulator.electLeader(a);