const Node = require("../node");
const Cluster = require("../cluster");

const Simulator = require("../simulator");

const Network = require("../network");

const nodes = [
    new Node("A"),
    new Node("B"),
    new Node("C")
];

const cluster = new Cluster(nodes);

const simulator = new Simulator(cluster, new Network());

console.log("\nSCENARIO: LEADER ELECTION");

simulator.electLeader( nodes[1]);