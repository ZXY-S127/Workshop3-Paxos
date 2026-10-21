
const Quorum = require("../../quorum");

console.log("\n====================");
console.log("SCENARIO: QUORUM MISCONFIGURATION");
console.log("====================");

const quorum = new Quorum(5);

console.log("\nCorrect Majority:");

console.log(quorum.majority());

/*
 * Unsafe change
 */
quorum.majority = () => 2;
console.log("\nModified Majority:");
console.log(quorum.majority());
console.log("\nPossible Quorums:");
console.log("Value A => A1 A2");
console.log("Value B => A4 A5");
console.log("\nWARNING:");
console.log("Quorum intersection removed.");
console.log("Different values could be chosen.");