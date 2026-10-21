const Network = require("../network");

const network = new Network();

console.log("\n====================");
console.log("SCENARIO: NETWORK PARTITION");
console.log("====================");

network.send("Prepare(101)");

network.partition();

network.send("Prepare(102)");

network.send("Accept(102, instances=10)");

network.repair();

network.send("Prepare(103)");