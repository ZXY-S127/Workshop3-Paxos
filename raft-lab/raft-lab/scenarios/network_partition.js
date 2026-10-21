const Network = require("../network");

const network = new Network();

console.log("\n====================");
console.log("NETWORK PARTITION");
console.log("====================");
console.log("\nLeader communicating normally");

network.send("AppendEntries(term=1)");

console.log("\nPartition occurs");

network.partition();

network.send("AppendEntries(term=1)");
network.send("AppendEntries(instances=10)");

console.log("\nPartition repaired");

network.repair();

network.send("AppendEntries(term=1)");
console.log("\nLESSON:");
console.log("Communication failure affects availability.");
