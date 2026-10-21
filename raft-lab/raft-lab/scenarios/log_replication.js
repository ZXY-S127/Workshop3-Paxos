const Node = require("../node");
const Cluster = require("../cluster");
const Simulator = require("../simulator");
const Network = require("../network");

const a = new Node("A");
const b = new Node("B");
const c = new Node("C");

b.becomeLeader();

const simulator = new Simulator(new Cluster([a,b,c]),new Network());

console.log("\nSCENARIO: LOG REPLICATION");

simulator.replicate("instances=10");