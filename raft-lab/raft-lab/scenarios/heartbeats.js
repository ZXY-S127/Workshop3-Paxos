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

console.log("\nSCENARIO: HEARTBEATS");

simulator.electLeader(nodes[1]);

for (let round = 1; round <= 3; round++) {
    console.log(`\nHeartbeat round ${round}`);
    simulator.heartbeat();
}
