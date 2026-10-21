
console.log("\n====================");
console.log("HARDENING RAFT");
console.log("====================");

function validateElectionTimeout(timeout) {

    if (timeout < 100) {
        throw Error("Unsafe election timeout");
    }
}

function detectLeaderChurn(elections) {

    if (elections > 5) {
        console.log("WARNING: LEADERSHIP CHURN");
    }
}

function validateMajority(total, online) {
    const majority = Math.floor(total / 2) + 1;
    return online >= majority;
}

try {
    validateElectionTimeout(50);
} 
catch (error) {
    console.log(error.message);
}

detectLeaderChurn(10);

console.log("Majority Available:",validateMajority(5,3));
console.log("\nSuggested Defences");
console.log("- Election timeout validation");
console.log("- Leader churn monitoring");
console.log("- Quorum health checks");
console.log("- Follower lag monitoring");
console.log("- Persistent state verification");