
const Acceptor = require("../../acceptor");

console.log("\n====================");
console.log("SCENARIO: STATE LOSS");
console.log("====================");

const a1 = new Acceptor("A1");

/*
 * Accepted value
 */

a1.acceptedProposal = {
    number: 101,
    value:"instances=10"
};

a1.highestPromised = 101;

console.log("\nBefore Loss:");
console.log(a1);

/*
 * Simulate disk loss
 */

a1.acceptedProposal =null;
a1.highestPromised = 0;

console.log("\nAfter Loss:");
console.log(a1);
console.log("\nWARNING:");
console.log("Acceptor forgot previous history.");
console.log("Paxos safety assumption violated.");