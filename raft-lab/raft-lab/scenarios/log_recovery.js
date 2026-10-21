const Node = require("../node");

const LogEntry =require("../logEntry");

console.log("\n====================");

console.log("LOG RECOVERY");

console.log("====================");

const leader = new Node("Leader");

leader.role = "LEADER";

leader.log.push(new LogEntry(1, 1, "A"));
leader.log.push(new LogEntry(2, 1, "B"));
leader.log.push(new LogEntry(3, 1, "C"));
leader.log.push(new LogEntry(4, 1, "D"));
leader.log.push(new LogEntry(5, 1, "E"));

const follower = new Node("Follower");

follower.log.push(new LogEntry(1, 1, "A"));
follower.log.push(new LogEntry(2, 1, "B"));
follower.log.push(new LogEntry(3, 1, "C"));

console.log("\nLeader Log Length:",leader.log.length);
console.log("Follower Log Length:",follower.log.length);
console.log("\nRecovering Missing Entries...");

for (let i = follower.log.length; i < leader.log.length;i++) {
    follower.log.push(leader.log[i]);
    console.log(`Recovered Entry ${leader.log[i].index}`);
}

console.log("\nFollower Log Length:", follower.log.length);
console.log("\nLESSON:");
console.log("Recovered followers repair history from the leader.");