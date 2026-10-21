const Node = require("../node");
const Cluster = require("../cluster");

const a = new Node("A");
const b = new Node("B");
const c = new Node("C");
const d = new Node("D");
const e = new Node("E");

a.becomeLeader();

c.fail();
d.fail();
e.fail();

const cluster =
    new Cluster([
        a,
        b,
        c,
        d,
        e
    ]);

console.log("\n====================");
console.log("MAJORITY LOST");
console.log("====================");
console.log(`Majority Needed: ${cluster.majority()}`);
console.log(`Online Nodes: ${cluster.onlineNodes().length}`);

if (!cluster.hasMajority()) {
    console.log("\nNO MAJORITY AVAILABLE");
    console.log("Cannot elect leader");
    console.log("Cannot commit entries");
}

console.log("\nLESSON:");
console.log("Safety is preserved by sacrificing availability.");